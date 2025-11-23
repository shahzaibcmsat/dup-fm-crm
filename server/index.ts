import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import rateLimit from 'express-rate-limit';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log, debug, info, error as logError } from "./vite";
import { initializeConfig } from "./config-manager";

const app = express();

// Rate limiting: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for static assets
    return !req.path.startsWith('/api');
  },
});

// Auth endpoints need stricter rate limiting: 5 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize configuration system
  await initializeConfig();
  log('✅ Configuration system initialized');

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Only setup Vite in development; in production serve static assets.
  // Also be resilient: if Vite isn't available, fall back to static.
  const isDev = (process.env.NODE_ENV || app.get("env")) === "development";
  if (isDev) {
    try {
      await setupVite(app, server);
    } catch (e: any) {
      log(`Vite dev middleware not available (${e?.message || e}). Falling back to static serving.`, "vite");
      serveStatic(app);
    }
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, () => {
    log(`serving on port ${port}`);
  });

  // Start email sync background job
  startEmailSyncJob();
})();

// Notification functions using database
export async function addEmailNotification(leadId: string, leadName: string, fromEmail: string, subject: string) {
  const { storage } = await import('./storage');
  
  const notificationData = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    leadId,
    leadName,
    fromEmail,
    subject,
    isDismissed: false,
    createdAt: new Date(),
    dismissedAt: null,
  };
  
  const notification = await storage.createNotification(notificationData);
  
  console.log(`🔔 BACKEND: Created notification ${notification.id} for lead ${leadName} (${leadId})`);
  console.log(`   Total notifications in queue: ${await storage.getRecentNotifications().then(n => n.length)}`);
  console.log(`   Dismissed notifications: 0`);
  
  return notification;
}

export async function getRecentNotifications(since?: string) {
  const { storage } = await import('./storage');
  
  const notifications = await storage.getRecentNotifications(since);
  
  console.log(`📊 BACKEND: Getting notifications - Total: ${notifications.length}, After filtering dismissed: ${notifications.length}`);
  
  // Keep only the latest notification per lead (to avoid showing old notifications)
  const latestByLead = new Map<string, typeof notifications[0]>();
  for (const n of notifications) {
    const existing = latestByLead.get(n.leadId);
    if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) {
      latestByLead.set(n.leadId, n);
    }
  }

  // Get array of latest notifications per lead
  const result = Array.from(latestByLead.values());

  console.log(`   Notification IDs: ${result.map(n => n.id).join(', ')}`);

  // Return sorted newest-first
  return result.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function dismissNotification(notificationId: string) {
  const { storage } = await import('./storage');
  await storage.dismissNotification(notificationId);
  console.log(`🔕 BACKEND: Dismissed notification: ${notificationId}`);
}

export async function dismissNotificationsForLead(leadId: string) {
  const { storage } = await import('./storage');
  const count = await storage.dismissNotificationsByLead(leadId);
  console.log(`🔕 BACKEND: Dismissed ${count} notifications for lead: ${leadId}`);
}

export async function clearAllNotifications() {
  const { storage } = await import('./storage');
  const count = await storage.cleanupOldNotifications();
  log(`🧹 Cleaned up ${count} old dismissed notifications`);
}

// Background job to sync emails every 30 seconds for faster notifications
function startEmailSyncJob() {
  const SYNC_INTERVAL = 30 * 1000; // 30 seconds (faster sync for quicker notifications)
  let lastSyncTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // Start from 48h ago (when server is down)

  log('📧 Email sync job started (checking every 30 seconds, 48h lookback)');

  const syncEmails = async () => {
    try {
      const { fetchNewEmails, getInReplyToHeader, getEmailBody, getHeader, isGmailConfigured } = await import('./gmail');
      const { storage } = await import('./storage');
      const { insertEmailSchema } = await import('@shared/schema');

      if (!isGmailConfigured()) {
        return; // Skip if not configured
      }

      log(`🔍 Checking for new emails since ${new Date(lastSyncTime).toLocaleString()}`);
      const newEmails = await fetchNewEmails(lastSyncTime);
      let savedCount = 0;

      if (newEmails.length > 0) {
        log(`📬 Found ${newEmails.length} emails to process`);
      }

      for (const email of newEmails) {
        const fromAddress = getHeader(email, 'From');
        const subject = getHeader(email, 'Subject');
        const messageId = email.id;
        const threadId = email.threadId;
        
        log(`  📧 Processing email from: ${fromAddress}`);
        log(`     Subject: ${subject || '(No Subject)'}`);
        log(`     Message ID: ${messageId}`);
        log(`     Thread ID: ${threadId || 'none'}`);
        
        if (!fromAddress) {
          log(`     ⚠️ No from address, skipping`);
          continue;
        }

        // Extract email address from "Name <email@example.com>" format
        const emailMatch = fromAddress.match(/<(.+?)>/) || [null, fromAddress];
        const cleanFromAddress = emailMatch[1] || fromAddress;

        // Check if we already have this message
        const existing = await storage.getEmailByMessageId(messageId);
        
        if (existing) {
          log(`     ℹ️ Email already exists in database, skipping`);
          continue;
        }

        // Try to find the correct lead by matching conversation thread
        let lead = null;
        const inReplyToHeader = getInReplyToHeader(email);
        
        // First, try to match by thread ID (Gmail's conversation threading)
        if (threadId) {
          log(`     🔍 Looking for existing email with thread ID: ${threadId}`);
          const relatedEmail = await storage.getEmailByConversationId(threadId);
          if (relatedEmail) {
            log(`     ✅ Found related email in thread, using lead: ${relatedEmail.leadId}`);
            lead = await storage.getLead(relatedEmail.leadId);
          }
        }
        
        // If no match by thread, try by email address
        if (!lead) {
          log(`     🔍 No thread match, looking for lead by email address`);
          lead = await storage.getLeadByEmail(cleanFromAddress);
        }
        
        if (lead) {
          log(`     ✅ Matched to lead: ${lead.clientName} (${lead.id})`);
          log(`     💾 Saving new email to database...`);
          
          const emailBody = getEmailBody(email);
          
          const emailData = insertEmailSchema.parse({
            leadId: lead.id,
            subject: subject || '(No Subject)',
            body: emailBody || '',
            direction: 'received',
            messageId: messageId,
            conversationId: threadId || null,
            fromEmail: cleanFromAddress,
            toEmail: process.env.EMAIL_FROM_ADDRESS || null,
            inReplyTo: inReplyToHeader,
          });

          await storage.createEmail(emailData);
          savedCount++;
          
          // Update lead status to "Replied" if they responded
          await storage.updateLeadStatus(lead.id, 'Replied');
          log(`     📨 Saved reply from ${cleanFromAddress} for lead ${lead.clientName}`);
          
          // Add notification for this new reply
          const notification = await addEmailNotification(lead.id, lead.clientName, cleanFromAddress, subject || '(No Subject)');
          log(`     🔔 Created notification ${notification.id} for ${lead.clientName}`);
          const notificationCount = await storage.getRecentNotifications().then(n => n.length);
          log(`     🔔 Total notifications in queue: ${notificationCount}`);
        } else {
          log(`     ⚠️ No matching lead found for email: ${cleanFromAddress}`);
        }
      }

      if (savedCount > 0) {
        log(`✅ Email sync: ${savedCount} new replies saved and ${savedCount} notifications created`);
      } else if (newEmails.length > 0) {
        log(`ℹ️  Email sync: ${newEmails.length} emails checked, none were new or matched leads`);
      }

      lastSyncTime = new Date().toISOString();
    } catch (error: any) {
      log(`❌ Email sync error: ${error.message}`);
      console.error(error);
    }
  };

  // Run immediately on startup
  setTimeout(syncEmails, 5000); // Wait 5 seconds after server start

  // Then run every 30 seconds
  setInterval(syncEmails, SYNC_INTERVAL);
}
