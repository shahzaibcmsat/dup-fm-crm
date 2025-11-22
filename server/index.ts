import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeConfig } from "./config-manager";

const app = express();

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

// Notification functions using database storage
export async function addEmailNotification(leadId: string, leadName: string, fromEmail: string, subject: string) {
  const { storage } = await import('./storage');
  
  const notification = await storage.createNotification({
    leadId,
    leadName,
    fromEmail,
    subject,
    dismissed: 0
  });
  
  console.log(`🔔 BACKEND: Created notification ${notification.id} for lead ${leadName} (${leadId})`);
  
  return {
    id: notification.id,
    leadId: notification.leadId,
    leadName: notification.leadName,
    fromEmail: notification.fromEmail,
    subject: notification.subject,
    timestamp: notification.createdAt.toISOString()
  };
}

export async function getRecentNotifications(since?: string) {
  const { storage } = await import('./storage');
  
  const notifications = await storage.getRecentNotifications(since);
  
  console.log(`📊 BACKEND: Getting notifications - Found: ${notifications.length}`);
  if (since) {
    console.log(`   Filtered by since ${since}`);
  }
  
  return notifications.map(n => ({
    id: n.id,
    leadId: n.leadId,
    leadName: n.leadName,
    fromEmail: n.fromEmail,
    subject: n.subject,
    timestamp: n.createdAt.toISOString()
  }));
}

export async function dismissNotification(notificationId: string) {
  const { storage } = await import('./storage');
  
  await storage.dismissNotification(notificationId);
  console.log(`🔕 BACKEND: Dismissed notification: ${notificationId}`);
}

export async function dismissNotificationsForLead(leadId: string) {
  const { storage } = await import('./storage');
  
  const count = await storage.dismissNotificationsForLead(leadId);
  console.log(`🔕 BACKEND: Dismissed ${count} notifications for lead: ${leadId}`);
}

export async function clearAllNotifications() {
  const { storage } = await import('./storage');
  
  await storage.clearAllNotifications();
  log('🧹 All notifications cleared');
}

// Background job to sync emails every 30 seconds for faster notifications
function startEmailSyncJob() {
  const SYNC_INTERVAL = 30 * 1000; // 30 seconds (faster sync for quicker notifications)
  let lastSyncTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // Start from 48h ago

  log('📧 Email sync job started (checking every 30 seconds)');

  const syncEmails = async () => {
    try {
      const { fetchNewEmails, getInReplyToHeader, isGmailConfigured } = await import('./gmail');
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
        const fromAddress = email.from?.emailAddress?.address;
        log(`  📧 Processing email from: ${fromAddress}`);
        log(`     Subject: ${email.subject || '(No Subject)'}`);
        log(`     Message ID: ${email.id}`);
        log(`     Conversation ID: ${email.conversationId || 'none'}`);
        log(`     Received Time: ${email.receivedDateTime}`);
        
        if (!fromAddress) {
          log(`     ⚠️ No from address, skipping`);
          continue;
        }

        // Check if we already have this message
        const existing = await storage.getEmailByMessageId(email.id);
        
        if (existing) {
          log(`     ℹ️ Email already exists in database, skipping`);
          continue;
        }

        // Try to find the correct lead by matching conversation thread
        let lead = null;
        const threadId = email.threadId;
        const inReplyToHeader = getInReplyToHeader(email);
        
        // First, try to match by thread (most accurate)
        if (threadId) {
          log(`     🔍 Looking for existing email with thread ID: ${threadId}`);
          const relatedEmail = await storage.getEmailByConversationId(threadId);
          if (relatedEmail) {
            log(`     ✅ Found related email in thread, using lead: ${relatedEmail.leadId}`);
            lead = await storage.getLead(relatedEmail.leadId);
          }
        }
        
        // If no match by conversation, try by email address
        if (!lead) {
          log(`     🔍 No conversation match, looking for lead by email address`);
          lead = await storage.getLeadByEmail(fromAddress);
        }
        
        if (lead) {
          log(`     ✅ Matched to lead: ${lead.clientName} (${lead.id})`);
          log(`     💾 Saving new email to database...`);
          
          const emailData = insertEmailSchema.parse({
            leadId: lead.id,
            subject: email.subject || '(No Subject)',
            body: email.body?.content || '',
            direction: 'received',
            messageId: email.id,
            conversationId: threadId || null,
            fromEmail: fromAddress,
            toEmail: process.env.EMAIL_FROM_ADDRESS || null,
            inReplyTo: inReplyToHeader,
          });

          await storage.createEmail(emailData);
          savedCount++;
          
          // Update lead status to "Replied" if they responded
          await storage.updateLeadStatus(lead.id, 'Replied');
          log(`     📨 Saved reply from ${fromAddress} for lead ${lead.clientName}`);
          
          // Add notification for this new reply
          const notification = await addEmailNotification(lead.id, lead.clientName, fromAddress, email.subject || '(No Subject)');
          log(`     🔔 Created notification ${notification.id} for ${lead.clientName}`);
        } else {
          log(`     ⚠️ No matching lead found for email: ${fromAddress}`);
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
