import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertLeadSchema, insertEmailSchema, insertCompanySchema } from "@shared/schema";
import { sendEmail, isMicrosoftGraphConfigured, getAuthorizationUrl, exchangeCodeForTokens } from "./outlook";
import { grammarFix, generateAutoReply } from "./groq";
import { getAllConfig, saveConfigToFile, validateConfig } from "./config-manager";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Grammar check endpoint for email composition
  app.post("/api/grammar/fix", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }
      const result = await grammarFix(text);
      res.json(result);
    } catch (error: any) {
      console.error("Grammar fix error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Auto-reply generation endpoint
  app.post("/api/emails/generate-reply", async (req, res) => {
    try {
      const { leadId, currentDraft } = req.body;
      
      if (!leadId) {
        return res.status(400).json({ message: "Lead ID is required" });
      }

      // Get lead details
      const lead = await storage.getLead(leadId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Get conversation history (emails for this lead)
      const emails = await storage.getEmailsByLeadId(leadId);
      
      // Sort by sentAt (oldest first)
      const conversationHistory = emails
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
        .map(email => ({
          direction: email.direction as 'sent' | 'received',
          subject: email.subject,
          body: email.body,
          timestamp: email.sentAt.toISOString()
        }));

      // Generate auto-reply
      const result = await generateAutoReply({
        leadName: lead.clientName,
        leadEmail: lead.email,
        leadDescription: lead.leadDetails || undefined,
        conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
        currentDraft: currentDraft || undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Auto-reply generation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // OAuth authentication routes for Microsoft Graph
  app.get("/api/auth/microsoft", async (req, res) => {
    try {
      const authUrl = getAuthorizationUrl();
      if (!authUrl) {
        return res.status(500).json({ 
          message: "Microsoft Graph not configured. Please set AZURE_CLIENT_ID and AZURE_CLIENT_SECRET" 
        });
      }
      res.redirect(authUrl);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/auth/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send("No authorization code provided");
      }

      const tokenResponse = await exchangeCodeForTokens(code);
      
      // Store the tokens securely (in production, use database)
      // For now, just redirect to success page
      res.send(`
        <html>
          <body>
            <h2>✅ Microsoft Account Connected Successfully!</h2>
            <p>You can now close this window and return to the application.</p>
            <script>setTimeout(() => window.close(), 2000);</script>
          </body>
        </html>
      `);
    } catch (error: any) {
      res.status(500).send(`Authentication failed: ${error.message}`);
    }
  });

  app.get("/api/auth/status", async (req, res) => {
    res.json({
      emailProvider: 'microsoft',
      microsoftGraph: isMicrosoftGraphConfigured(),
      environment: {
        hasClientId: !!process.env.AZURE_CLIENT_ID,
        hasClientSecret: !!process.env.AZURE_CLIENT_SECRET,
        tenantId: process.env.AZURE_TENANT_ID || 'common',
        fromAddress: process.env.EMAIL_FROM_ADDRESS || 'not set'
      }
    });
  });

  // Debug endpoint to test email configuration
  app.get("/api/debug/email-config", async (req, res) => {
    res.json({
      provider: 'microsoft',
      microsoft: {
        configured: isMicrosoftGraphConfigured(),
        clientId: process.env.AZURE_CLIENT_ID ? 'Set (hidden)' : 'Not set',
        clientSecret: process.env.AZURE_CLIENT_SECRET ? 'Set (hidden)' : 'Not set',
        tenantId: process.env.AZURE_TENANT_ID || 'common',
        fromAddress: process.env.EMAIL_FROM_ADDRESS || 'Not set',
        redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:5000/api/auth/callback'
      }
    });
  });

  // Test if the mailbox exists and is accessible
  app.get("/api/debug/test-mailbox", async (req, res) => {
    try {
      const { getGraphClient } = await import("./outlook");
      const client = await getGraphClient();
      
      if (!client) {
        return res.json({ success: false, error: "Microsoft Graph not configured" });
      }

      const fromAddress = process.env.EMAIL_FROM_ADDRESS;
      if (!fromAddress) {
        return res.json({ success: false, error: "EMAIL_FROM_ADDRESS not set" });
      }

      // Try to get the user's mailbox info
      const user = await client.api(`/users/${fromAddress}`).get();
      
      res.json({ 
        success: true, 
        message: "Mailbox exists and is accessible",
        user: {
          displayName: user.displayName,
          mail: user.mail,
          userPrincipalName: user.userPrincipalName
        }
      });
    } catch (error: any) {
      res.json({ 
        success: false, 
        error: error.message,
        code: error.code,
        suggestion: error.code === 'Request_ResourceNotFound' 
          ? 'User/Mailbox does not exist in this tenant'
          : 'Check if user has Exchange Online license'
      });
    }
  });

  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/leads/:id", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/leads", async (req, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(validatedData);
      res.status(201).json(lead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.updateLead(req.params.id, validatedData);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/leads/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      const lead = await storage.updateLeadStatus(req.params.id, status);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/leads/:id", async (req, res) => {
    try {
      const success = await storage.deleteLead(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json({ message: "Lead deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/leads/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Lead IDs array is required" });
      }
      const deletedCount = await storage.deleteLeads(ids);
      res.json({ 
        message: `${deletedCount} lead(s) deleted successfully`,
        count: deletedCount
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/leads/:id/send-email", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      const { subject, body } = req.body;
      if (!subject || !body) {
        return res.status(400).json({ message: "Subject and body are required" });
      }

      // Get existing emails to find conversation thread
      const existingEmails = await storage.getEmailsByLeadId(lead.id);
      const lastEmail = existingEmails.length > 0 
        ? existingEmails.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0]
        : null;

      console.log(`📧 Sending email via Microsoft Graph...`);
      
      if (lastEmail) {
        console.log(`🧵 Found existing conversation - replying to thread`);
        console.log(`   Last Message ID: ${lastEmail.messageId}`);
        console.log(`   Conversation ID: ${lastEmail.conversationId}`);
      }

      // Determine the email subject - add "Re:" only if not already present
      let emailSubject = subject;
      if (lastEmail) {
        const baseSubject = lastEmail.subject.replace(/^Re:\s*/i, '');
        emailSubject = `Re: ${baseSubject}`;
      }

      // Send email using Microsoft Graph
      const result = await sendEmail(
        lead.email, 
        emailSubject, 
        body, 
        undefined, // fromEmail (use default)
        lastEmail?.messageId || undefined // inReplyTo for threading
      );
      
      // Preserve conversation ID from previous emails
      if (lastEmail?.conversationId && !result.conversationId) {
        result.conversationId = lastEmail.conversationId;
      }

      const fromEmail = process.env.EMAIL_FROM_ADDRESS;

      const emailData = insertEmailSchema.parse({
        leadId: lead.id,
        subject: emailSubject,
        body,
        direction: "sent",
        messageId: result.messageId || null,
        conversationId: result.conversationId || null,
        fromEmail: fromEmail || null,
        toEmail: lead.email,
        inReplyTo: lastEmail?.messageId || null,
      });

      const email = await storage.createEmail(emailData);
      
      await storage.updateLeadStatus(lead.id, "Contacted");

      res.json({ success: true, email });
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: error.message || "Failed to send email" });
    }
  });

  app.get("/api/emails/:leadId", async (req, res) => {
    try {
      const emails = await storage.getEmailsByLeadId(req.params.leadId);
      res.json(emails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get recent email notifications
  app.get("/api/notifications/emails", async (req, res) => {
    try {
      const { getRecentNotifications } = await import("./index");
      const since = req.query.since as string | undefined;
      const notifications = getRecentNotifications(since);
      res.json({ notifications });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Sync emails from inbox (check for new replies)
  app.post("/api/emails/sync", async (req, res) => {
    try {
      const { fetchNewEmails, getInReplyToHeader } = await import("./outlook");
      const { addEmailNotification } = await import("./index");
      
      // Get timestamp of last sync (or fetch all recent emails)
      const lastSyncTime = req.body.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const newEmails = await fetchNewEmails(lastSyncTime);
      let savedCount = 0;
      let matchedCount = 0;

      for (const email of newEmails) {
        // Check if this email is a reply to one of our sent emails
        const conversationId = email.conversationId;
        const fromAddress = email.from?.emailAddress?.address;
        
        if (!fromAddress) continue;

        // Try to find a lead with this email address
        const lead = await storage.getLeadByEmail(fromAddress);
        
        if (lead) {
          matchedCount++;
          
          // Check if we already have this message
          const existing = await storage.getEmailByMessageId(email.id);
          
          if (!existing) {
            const emailData = insertEmailSchema.parse({
              leadId: lead.id,
              subject: email.subject || '(No Subject)',
              body: email.body?.content || '',
              direction: 'received',
              messageId: email.id,
              conversationId: conversationId || null,
              fromEmail: fromAddress,
              toEmail: process.env.EMAIL_FROM_ADDRESS || null,
              inReplyTo: getInReplyToHeader(email),
            });

            await storage.createEmail(emailData);
            savedCount++;
            
            // Update lead status to "Replied" if they responded
            await storage.updateLeadStatus(lead.id, "Replied");
            
            // Add notification for this new reply
            addEmailNotification(lead.id, lead.clientName, fromAddress, email.subject || '(No Subject)');
            console.log(`📧 Added notification for ${lead.clientName} - ${email.subject}`);
          }
        }
      }

      res.json({ 
        success: true, 
        checked: newEmails.length,
        matched: matchedCount,
        saved: savedCount,
        lastSync: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error syncing emails:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/import/file", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const leads = data.map((row: any) => {
        const clientName = row["Client Name"] || row["Name"] || row["client_name"] || row["name"];
        const email = row["Email"] || row["email"];
        const leadDetails = row["Lead Details"] || row["Lead"] || row["Description"] || row["lead_details"] || row["description"] || "";

        if (!clientName || !email) {
          throw new Error("Each row must have Client Name and Email columns");
        }

        return {
          clientName: String(clientName).trim(),
          email: String(email).trim(),
          leadDetails: String(leadDetails).trim(),
          status: "New",
        };
      });

      const validatedLeads = leads.map((lead) => insertLeadSchema.parse(lead));
      const createdLeads = await storage.createLeads(validatedLeads);

      res.json({ success: true, count: createdLeads.length });
    } catch (error: any) {
      console.error("Error importing file:", error);
      res.status(400).json({ message: error.message || "Failed to import file" });
    }
  });

  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/companies/:id/leads", async (req, res) => {
    try {
      const leads = await storage.getLeadsByCompany(req.params.id);
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      res.status(201).json(company);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/companies/:id", async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.updateCompany(req.params.id, validatedData);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/companies/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCompany(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Configuration management endpoints
  app.get("/api/config", async (req, res) => {
    try {
      const config = getAllConfig(false); // Don't include full sensitive values
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const updates = req.body;
      
      // Validate configuration
      const validation = validateConfig(updates);
      if (!validation.valid) {
        return res.status(400).json({ 
          message: "Invalid configuration",
          errors: validation.errors 
        });
      }
      
      // Save to .env file and update runtime config
      const success = saveConfigToFile(updates);
      
      if (success) {
        res.json({ 
          success: true, 
          message: "Configuration updated successfully. Some changes may require a server restart." 
        });
      } else {
        res.status(500).json({ 
          message: "Failed to save configuration" 
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
