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
export async function addEmailNotification(leadId: string, leadName: string, fromEmail: string, subject: string, emailId: string) {
  const { storage } = await import('./storage');
  
  const notificationData = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    leadId,
    emailId,
    leadName,
    fromEmail,
    subject,
    isDismissed: false,
    createdAt: new Date(),
    dismissedAt: null,
  };
  
  const notification = await storage.createNotification(notificationData);
  
  console.log(`🔔 BACKEND: Created notification ${notification.id} for lead ${leadName} (${leadId}) linked to email ${emailId}`);
  console.log(`   Total notifications in queue: ${await storage.getRecentNotifications().then(n => n.length)}`);
  console.log(`   Dismissed notifications: 0`);
  
  return notification;
}

export async function getRecentNotifications(since?: string, userId?: string) {
  const { storage } = await import('./storage');
  
  const notifications = await storage.getRecentNotifications(since, userId);
  
  const userContext = userId ? `member ${userId}` : 'admin (all leads)';
  console.log(`📊 BACKEND: Getting notifications for ${userContext} - Total: ${notifications.length}`);
  
  // Group notifications by lead and count them
  const notificationsByLead = new Map<string, {
    id: string;
    leadId: string;
    leadName: string;
    fromEmail: string;
    subject: string;
    createdAt: Date;
    count: number;
    notificationIds: string[];
  }>();
  
  for (const n of notifications) {
    const existing = notificationsByLead.get(n.leadId);
    if (!existing) {
      notificationsByLead.set(n.leadId, {
        id: n.id,
        leadId: n.leadId,
        leadName: n.leadName,
        fromEmail: n.fromEmail,
        subject: n.subject,
        createdAt: n.createdAt,
        count: 1,
        notificationIds: [n.id]
      });
    } else {
      existing.count++;
      existing.notificationIds.push(n.id);
      // Keep the latest subject and timestamp
      if (new Date(n.createdAt) > new Date(existing.createdAt)) {
        existing.subject = n.subject;
        existing.createdAt = n.createdAt;
      }
    }
  }

  // Get array of notifications with counts per lead
  const result = Array.from(notificationsByLead.values());

  console.log(`   Grouped into ${result.length} leads with total count: ${result.reduce((sum, n) => sum + n.count, 0)}`);
  console.log(`   Per lead: ${result.map(n => `${n.leadName}: ${n.count}`).join(', ')}`);

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

// Background job to sync emails with Gmail API rate limiting compliance
function startEmailSyncJob() {
  const SYNC_INTERVAL = 30 * 1000; // 30 seconds (Gmail allows frequent polling)
  const MAX_RETRY_DELAY = 5 * 60 * 1000; // Max 5 minutes between retries
  let lastSyncTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // Start from 48h ago (when server is down)
  let consecutiveErrors = 0;
  let backoffDelay = 0;

  log('📧 Email sync job started (30s interval, Gmail API compliant)');

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

      // Update sync time immediately after fetching to prevent reprocessing if server crashes
      const currentSyncTime = new Date().toISOString();

      if (newEmails.length > 0) {
        log(`📬 Found ${newEmails.length} emails to process`);
      }

      for (const email of newEmails) {
        const fromAddress = getHeader(email, 'From');
        const subject = getHeader(email, 'Subject');
        const gmailMessageId = email.id; // Gmail's internal ID
        const threadId = email.threadId; // Gmail's thread ID
        const messageIdHeader = getHeader(email, 'Message-ID'); // Actual Message-ID from headers
        
        log(`  📧 Processing email from: ${fromAddress}`);
        log(`     Subject: ${subject || '(No Subject)'}`);
        log(`     Gmail Message ID: ${gmailMessageId}`);
        log(`     Message-ID Header: ${messageIdHeader || 'none'}`);
        log(`     Thread ID: ${threadId || 'none'}`);
        
        if (!fromAddress) {
          log(`     ⚠️ No from address, skipping`);
          continue;
        }

        // Extract email address from "Name <email@example.com>" format
        const emailMatch = fromAddress.match(/<(.+?)>/) || [null, fromAddress];
        const cleanFromAddress = emailMatch[1] || fromAddress;

        // Check if we already have this message (using Gmail's message ID)
        const existing = await storage.getEmailByMessageId(gmailMessageId);
        
        if (existing) {
          log(`     ℹ️ Email already exists in database, skipping email creation`);
          
          // BUT - check if notification exists for this email
          // This handles cases where email was saved but notification creation failed
          const existingNotification = await storage.getNotificationByEmailId(existing.id);
          
          if (!existingNotification && existing.leadId) {
            // Email exists but notification doesn't - create it now!
            const lead = await storage.getLead(existing.leadId);
            if (lead) {
              const notification = await addEmailNotification(
                lead.id, 
                lead.clientName, 
                cleanFromAddress, 
                existing.subject || '(No Subject)', 
                existing.id
              );
              log(`     🔔 Created missing notification ${notification.id} for existing email ${existing.id}`);
            }
          }
          
          continue;
        }

        // Try to find the correct lead by matching conversation thread AND email address
        let lead = null;
        const inReplyToHeader = getInReplyToHeader(email);
        
        // First, try to match by BOTH thread ID and email address
        // This prevents cross-contamination when same email is used for multiple leads
        if (threadId) {
          log(`     🔍 Looking for existing email with thread ID: ${threadId} AND email: ${cleanFromAddress}`);
          const relatedEmail = await storage.getEmailByConversationIdAndEmail(threadId, cleanFromAddress);
          if (relatedEmail) {
            log(`     ✅ Found related email in thread matching both thread and email, using lead: ${relatedEmail.leadId}`);
            lead = await storage.getLead(relatedEmail.leadId);
          }
        }
        
        // If no match by thread+email, try by email address only
        if (!lead) {
          log(`     🔍 No thread+email match, looking for lead by email address only`);
          lead = await storage.getLeadByEmail(cleanFromAddress);
        }
        
        if (lead) {
          log(`     ✅ Matched to lead: ${lead.clientName} (${lead.id})`);
          log(`     💾 Saving new email to database...`);
          
          const emailBody = getEmailBody(email);
          const referencesHeader = getHeader(email, 'References'); // Get full References chain
          
          log(`     📋 Headers received from webmail:`);
          log(`        Message-ID: ${messageIdHeader}`);
          log(`        In-Reply-To: ${inReplyToHeader || 'none'}`);
          log(`        References: ${referencesHeader || 'none'}`);
          
          const emailData = insertEmailSchema.parse({
            leadId: lead.id,
            subject: subject || '(No Subject)',
            body: emailBody || '',
            direction: 'received',
            messageId: gmailMessageId, // Store Gmail's message ID for tracking
            conversationId: threadId || null, // Store Gmail's thread ID
            fromEmail: cleanFromAddress,
            toEmail: process.env.EMAIL_FROM_ADDRESS || null,
            inReplyTo: messageIdHeader || null, // Store Message-ID header for proper threading
            references: referencesHeader || null, // Store full References chain for threading
          });

          const newEmail = await storage.createEmail(emailData);
          savedCount++;
          
          // Update lead status to "Replied" if they responded
          await storage.updateLeadStatus(lead.id, 'Replied');
          log(`     📨 Saved reply from ${cleanFromAddress} for lead ${lead.clientName}`);
          
          // Check if notification already exists for THIS specific email (not just this lead)
          // This allows multiple notifications for multiple emails from the same lead
          const existingNotification = await storage.getNotificationByEmailId(newEmail.id);
          
          if (!existingNotification) {
            const notification = await addEmailNotification(lead.id, lead.clientName, cleanFromAddress, subject || '(No Subject)', newEmail.id);
            log(`     🔔 Created notification ${notification.id} for ${lead.clientName} linked to email ${newEmail.id}`);
            const notificationCount = await storage.getRecentNotifications().then(n => n.length);
            log(`     🔔 Total notifications in queue: ${notificationCount}`);
          } else {
            log(`     ⚠️ Notification already exists for this email, skipping duplicate`);
          }
        } else {
          log(`     ⚠️ No matching lead found for email: ${cleanFromAddress}`);
        }
      }

      if (savedCount > 0) {
        log(`✅ Email sync: ${savedCount} new replies saved and notifications created`);
      } else if (newEmails.length > 0) {
        log(`ℹ️  Email sync: ${newEmails.length} emails checked, none were new or matched leads`);
      }

      // Use the sync time we captured at the beginning
      lastSyncTime = currentSyncTime;
      consecutiveErrors = 0; // Reset error count on success
      backoffDelay = 0; // Reset backoff
    } catch (error: any) {
      consecutiveErrors++;
      
      // Implement exponential backoff for Gmail API errors (required by Google)
      if (error.code === 429 || error.code === 403 || error.message?.includes('quota')) {
        // Rate limit or quota exceeded - back off exponentially
        backoffDelay = Math.min(Math.pow(2, consecutiveErrors) * 1000, MAX_RETRY_DELAY);
        log(`⚠️ Gmail API rate limit hit, backing off for ${backoffDelay / 1000}s`);
      } else if (error.code === 503 || error.message?.includes('backend')) {
        // Service unavailable - exponential backoff
        backoffDelay = Math.min(Math.pow(2, consecutiveErrors) * 1000, MAX_RETRY_DELAY);
        log(`⚠️ Gmail API unavailable, backing off for ${backoffDelay / 1000}s`);
      } else {
        log(`❌ Email sync error: ${error.message}`);
      }
      
      console.error('Full error:', error);
      
      // Reset after too many errors to prevent permanent failure
      if (consecutiveErrors > 10) {
        log('⚠️ Too many errors, resetting sync state');
        consecutiveErrors = 0;
        backoffDelay = 0;
      }
    }
  };

  // Wrapper to handle backoff delays
  const syncWithBackoff = async () => {
    if (backoffDelay > 0) {
      log(`⏳ Delaying sync for ${backoffDelay / 1000}s due to previous errors`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
    await syncEmails();
  };

  // Run immediately on startup (after 5 seconds)
  setTimeout(syncWithBackoff, 5000);

  // Then run every 30 seconds (Gmail API allows frequent polling)
  setInterval(syncWithBackoff, SYNC_INTERVAL);
}
