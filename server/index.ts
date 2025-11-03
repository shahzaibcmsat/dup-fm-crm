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

// Store recent notifications for client polling
const recentNotifications: Array<{ id: string; leadId: string; leadName: string; fromEmail: string; subject: string; timestamp: string }> = [];

export function addEmailNotification(leadId: string, leadName: string, fromEmail: string, subject: string) {
  const notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    leadId,
    leadName,
    fromEmail,
    subject,
    timestamp: new Date().toISOString()
  };
  recentNotifications.push(notification);
  
  // Keep only last 50 notifications
  if (recentNotifications.length > 50) {
    recentNotifications.shift();
  }
  
  return notification;
}

export function getRecentNotifications(since?: string) {
  if (!since) return recentNotifications;
  
  const sinceDate = new Date(since);
  return recentNotifications.filter(n => new Date(n.timestamp) > sinceDate);
}

// Background job to sync emails every 2 minutes
function startEmailSyncJob() {
  const SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutes
  let lastSyncTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Start from 24h ago

  log('📧 Email sync job started (checking every 2 minutes)');

  const syncEmails = async () => {
    try {
      const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'microsoft';
      
      // Skip email sync if using SendGrid (SendGrid doesn't support fetching emails)
      if (EMAIL_PROVIDER === 'sendgrid') {
        return; // SendGrid only sends emails, cannot receive/fetch
      }

      const { fetchNewEmails, getInReplyToHeader, isMicrosoftGraphConfigured } = await import('./outlook');
      const { storage } = await import('./storage');
      const { insertEmailSchema } = await import('@shared/schema');

      if (!isMicrosoftGraphConfigured()) {
        return; // Skip if not configured
      }

      const newEmails = await fetchNewEmails(lastSyncTime);
      let savedCount = 0;

      for (const email of newEmails) {
        const fromAddress = email.from?.emailAddress?.address;
        if (!fromAddress) continue;

        // Try to find a lead with this email address
        const lead = await storage.getLeadByEmail(fromAddress);
        
        if (lead) {
          // Check if we already have this message
          const existing = await storage.getEmailByMessageId(email.id);
          
          if (!existing) {
            const emailData = insertEmailSchema.parse({
              leadId: lead.id,
              subject: email.subject || '(No Subject)',
              body: email.body?.content || '',
              direction: 'received',
              messageId: email.id,
              conversationId: email.conversationId || null,
              fromEmail: fromAddress,
              toEmail: process.env.EMAIL_FROM_ADDRESS || null,
              inReplyTo: getInReplyToHeader(email),
            });

            await storage.createEmail(emailData);
            savedCount++;
            
            // Update lead status to "Replied" if they responded
            await storage.updateLeadStatus(lead.id, 'Replied');
            log(`📨 Saved reply from ${fromAddress} for lead ${lead.clientName}`);
            
            // Add notification for this new reply
            addEmailNotification(lead.id, lead.clientName, fromAddress, email.subject || '(No Subject)');
          }
        }
      }

      if (savedCount > 0) {
        log(`✅ Email sync: ${savedCount} new replies saved`);
      }

      lastSyncTime = new Date().toISOString();
    } catch (error: any) {
      log(`❌ Email sync error: ${error.message}`);
    }
  };

  // Run immediately on startup
  setTimeout(syncEmails, 5000); // Wait 5 seconds after server start

  // Then run every 2 minutes
  setInterval(syncEmails, SYNC_INTERVAL);
}
