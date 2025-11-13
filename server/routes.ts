import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { insertLeadSchema, insertEmailSchema, insertCompanySchema, insertInventorySchema } from "@shared/schema";
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

  app.patch("/api/leads/:id/notes", async (req, res) => {
    try {
      const { notes } = req.body;
      if (notes === undefined) {
        return res.status(400).json({ message: "Notes field is required" });
      }
      const lead = await storage.updateLeadNotes(req.params.id, notes);
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

  app.post("/api/leads/bulk-assign-company", async (req, res) => {
    try {
      const { leadIds, companyId } = req.body;
      console.log("📋 Bulk assign company request:", { leadIds, companyId });
      
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ message: "Lead IDs array is required" });
      }
      
      // Update all leads with the company ID (or null to remove)
      const updatePromises = leadIds.map(async (leadId) => {
        console.log(`  Updating lead ${leadId} with companyId: ${companyId}`);
        const result = await storage.updateLeadCompany(leadId, companyId || null);
        console.log(`  Updated lead ${leadId}:`, result);
        return result;
      });
      
      const results = await Promise.all(updatePromises);
      console.log("✅ All leads updated:", results.length);
      
      res.json({ 
        message: `${leadIds.length} lead(s) assigned to company successfully`,
        count: leadIds.length
      });
    } catch (error: any) {
      console.error("❌ Error assigning company:", error);
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
      console.log(`📡 Notification request - since: ${since || 'all'}, returning: ${notifications.length} notifications`);
      if (notifications.length > 0) {
        console.log(`   Notification IDs: ${notifications.map(n => n.id).join(', ')}`);
      }
      res.json({ notifications });
    } catch (error: any) {
      console.error('❌ Error fetching notifications:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dismiss notifications for a specific lead (when user views the lead)
  app.post("/api/notifications/dismiss/:leadId", async (req, res) => {
    try {
      const { dismissNotificationsForLead } = await import("./index");
      const { leadId } = req.params;
      console.log(`🔕 Dismissing notifications for lead: ${leadId}`);
      dismissNotificationsForLead(leadId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dismiss a specific notification by ID
  app.post("/api/notifications/dismiss-id/:notificationId", async (req, res) => {
    try {
      const { dismissNotification } = await import("./index");
      const { notificationId } = req.params;
      dismissNotification(notificationId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clear all notifications (admin action from Settings)
  app.post("/api/notifications/clear", async (req, res) => {
    try {
      const { clearAllNotifications } = await import("./index");
      clearAllNotifications();
      res.json({ success: true, message: "All notifications cleared" });
    } catch (error: any) {
      console.error("Error clearing notifications:", error);
      res.status(500).json({ message: error.message || "Failed to clear notifications" });
    }
  });

  // Sync emails from inbox (check for new replies)
  app.post("/api/emails/sync", async (req, res) => {
    try {
      const { fetchNewEmails, getInReplyToHeader } = await import("./outlook");
      const { addEmailNotification } = await import("./index");
      
      // Get timestamp of last sync (or fetch all recent emails)
      const lastSyncTime = req.body.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      console.log(`🔄 Manual sync requested since ${new Date(lastSyncTime).toLocaleString()}`);
      const newEmails = await fetchNewEmails(lastSyncTime);
      let savedCount = 0;
      let matchedCount = 0;

      for (const email of newEmails) {
        // Check if this email is a reply to one of our sent emails
        const conversationId = email.conversationId;
        const fromAddress = email.from?.emailAddress?.address;
        
        console.log(`  📧 Processing email from: ${fromAddress}`);
        console.log(`     Subject: ${email.subject || '(No Subject)'}`);
        console.log(`     Message ID: ${email.id}`);
        console.log(`     Conversation ID: ${conversationId || 'none'}`);
        
        if (!fromAddress) {
          console.log(`     No from address, skipping`);
          continue;
        }

        // Check if we already have this message
        const existing = await storage.getEmailByMessageId(email.id);
        
        if (existing) {
          console.log(`     Email already exists in database, skipping`);
          continue;
        }

        // Try to find the correct lead by matching conversation thread
        let lead = null;
        const inReplyToHeader = getInReplyToHeader(email);
        
        // First, try to match by conversation thread (most accurate)
        if (conversationId) {
          console.log(`     Looking for existing email with conversation ID: ${conversationId}`);
          const relatedEmail = await storage.getEmailByConversationId(conversationId);
          if (relatedEmail) {
            console.log(`     Found related email in conversation, using lead: ${relatedEmail.leadId}`);
            lead = await storage.getLead(relatedEmail.leadId);
            matchedCount++;
          }
        }
        
        // If no match by conversation, try by email address
        if (!lead) {
          console.log(`     No conversation match, looking for lead by email address`);
          lead = await storage.getLeadByEmail(fromAddress);
          if (lead) {
            matchedCount++;
          }
        }
        
        if (lead) {
          console.log(`     Matched to lead: ${lead.clientName} (${lead.id})`);
          console.log(`     Saving new email to database...`);
          
          const emailData = insertEmailSchema.parse({
            leadId: lead.id,
            subject: email.subject || '(No Subject)',
            body: email.body?.content || '',
            direction: 'received',
            messageId: email.id,
            conversationId: conversationId || null,
            fromEmail: fromAddress,
            toEmail: process.env.EMAIL_FROM_ADDRESS || null,
            inReplyTo: inReplyToHeader,
          });

          await storage.createEmail(emailData);
          savedCount++;
          
          // Update lead status to "Replied" if they responded
          await storage.updateLeadStatus(lead.id, "Replied");
          
          // Add notification for this new reply
          const notification = addEmailNotification(lead.id, lead.clientName, fromAddress, email.subject || '(No Subject)');
          console.log(`     Created notification ${notification.id} for ${lead.clientName}`);
        } else {
          console.log(`     No matching lead found for email: ${fromAddress}`);
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
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      console.log(`📊 Processing ${rawData.length} rows from Excel file`);
      
      if (rawData.length === 0) {
        return res.status(400).json({ message: "Excel file is empty" });
      }

      // Log the actual column names from the Excel file
      const firstRow = rawData[0] as any;
      const actualColumns = Object.keys(firstRow);
      console.log("📋 Detected columns in Excel:", actualColumns);

      // Helper function to find value from row using case-insensitive column matching
      const getColumnValue = (row: any, possibleNames: string[]): string => {
        // First try exact match
        for (const name of possibleNames) {
          if (row[name]) return String(row[name]).trim();
        }
        
        // Then try case-insensitive match
        const rowKeys = Object.keys(row);
        for (const name of possibleNames) {
          const lowerName = name.toLowerCase();
          const matchingKey = rowKeys.find(key => key.toLowerCase() === lowerName);
          if (matchingKey && row[matchingKey]) {
            return String(row[matchingKey]).trim();
          }
        }
        
        return "";
      };

      const leads = rawData
        .map((row: any, index: number) => {
          // Get values using case-insensitive matching
          const clientName = getColumnValue(row, [
            "Name", "Client Name", "client_name", "name", "CLIENT NAME", "NAME"
          ]);
          
          const email = getColumnValue(row, [
            "Email", "email", "EMAIL", "E-mail", "e-mail"
          ]);
          
          const phone = getColumnValue(row, [
            "Phone Number", "Phone", "phone", "phone_number", "PHONE NUMBER", "PHONE"
          ]);
          
          const subject = getColumnValue(row, [
            "Subject", "subject", "SUBJECT"
          ]);
          
          const leadDetails = getColumnValue(row, [
            "Lead Description", "Lead Details", "Description", 
            "lead_details", "description", "LEAD DESCRIPTION", "DESCRIPTION"
          ]);

          // Skip rows without name or email
          if (!clientName || !email) {
            console.log(`⚠️ Skipping row ${index + 2}: Missing name or email`, { 
              clientName: clientName || '(empty)', 
              email: email || '(empty)',
              rowData: row 
            });
            return null;
          }

          // Validate email format
          if (!email.includes('@')) {
            console.log(`⚠️ Skipping row ${index + 2}: Invalid email format: ${email}`);
            return null;
          }

          console.log(`✅ Row ${index + 2}: ${clientName} <${email}>`);

          return {
            clientName,
            email,
            phone: phone || null,
            subject: subject || null,
            leadDetails: leadDetails || "",
            status: "New",
          };
        })
        .filter((lead): lead is NonNullable<typeof lead> => lead !== null);

      if (leads.length === 0) {
        return res.status(400).json({ 
          message: "No valid leads found. Ensure your Excel has 'Name' and 'Email' columns with data. Detected columns: " + actualColumns.join(", ")
        });
      }

      console.log(`✅ Found ${leads.length} valid leads to import`);

      // Get all existing emails from database for duplicate detection
      const existingLeads = await storage.getAllLeads();
      const existingEmails = new Set(existingLeads.map(lead => lead.email.toLowerCase()));

      // Detect duplicates within the file itself
      const emailCount = new Map<string, number>();
      leads.forEach(lead => {
        const email = lead.email.toLowerCase();
        emailCount.set(email, (emailCount.get(email) || 0) + 1);
      });

      const duplicatesWithinFile = Array.from(emailCount.entries())
        .filter(([_, count]) => count > 1)
        .map(([email]) => email);

      // Track duplicates for reporting only (still import them)
      const duplicateEmails: string[] = [];
      const fileInternalDuplicates: string[] = [];
      const processedFileEmails = new Set<string>();

      leads.forEach((lead) => {
        const emailLower = lead.email.toLowerCase();
        
        // Check if email already exists in database
        if (existingEmails.has(emailLower)) {
          duplicateEmails.push(lead.email);
        }
        
        // Check if this email appears multiple times in the file
        if (duplicatesWithinFile.includes(emailLower)) {
          if (!processedFileEmails.has(emailLower)) {
            processedFileEmails.add(emailLower);
            fileInternalDuplicates.push(lead.email);
          }
        }
      });

      console.log(`📊 Import Summary:`);
      console.log(`   - Total leads to import: ${leads.length}`);
      console.log(`   - Database duplicates found: ${duplicateEmails.length}`);
      console.log(`   - File internal duplicates: ${fileInternalDuplicates.length}`);

      // Import ALL leads (including duplicates)
      const validatedLeads = leads.map((lead) => insertLeadSchema.parse(lead));
      const createdLeads = await storage.createLeads(validatedLeads);
      const createdCount = createdLeads.length;
      
      console.log(`✅ Successfully imported ${createdCount} leads`);

      res.json({ 
        success: true, 
        total: leads.length,
        imported: createdCount,
        duplicates: duplicateEmails.length,
        rejected: leads.length - createdCount,
        summary: {
          totalRows: rawData.length,
          validRows: leads.length,
          newLeads: createdCount,
          duplicateLeads: duplicateEmails.length,
          invalidRows: rawData.length - leads.length,
          duplicateEmails: duplicateEmails,
          fileInternalDuplicates: fileInternalDuplicates,
          rejectedCount: leads.length - createdCount
        }
      });
    } catch (error: any) {
      console.error("❌ Error importing file:", error);
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

  // Inventory management endpoints
  app.post("/api/migrate/inventory-schema", async (req, res) => {
    try {
      const { db } = await import('./db');
      const { sql: execSql } = await import('drizzle-orm');
      
      const migrationSQL = `
        -- Drop existing inventory table if exists
        DROP TABLE IF EXISTS inventory CASCADE;

        -- Create new inventory table with Excel column structure
        CREATE TABLE inventory (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          product_heading TEXT,
          product TEXT NOT NULL,
          boxes INTEGER DEFAULT 0,
          sq_ft_per_box TEXT DEFAULT '0',
          total_sq_ft TEXT DEFAULT '0',
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        -- Create indexes for better performance
        CREATE INDEX idx_inventory_product ON inventory(product);
        CREATE INDEX idx_inventory_heading ON inventory(product_heading);
      `;
      
      await db.execute(execSql.raw(migrationSQL));
      
      res.json({ success: true, message: 'Inventory schema migration completed' });
    } catch (error: any) {
      console.error('Migration error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/inventory", async (req, res) => {
    try {
      const items = await storage.getAllInventory();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/inventory/:id", async (req, res) => {
    try {
      const item = await storage.getInventoryItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const validated = insertInventorySchema.parse(req.body);
      const item = await storage.createInventoryItem(validated);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/inventory/:id", async (req, res) => {
    try {
      const validated = insertInventorySchema.parse(req.body);
      const item = await storage.updateInventoryItem(req.params.id, validated);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteInventoryItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/inventory/bulk-delete", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Invalid request: ids must be an array" });
      }
      const count = await storage.deleteInventoryItems(ids);
      res.json({ success: true, count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/inventory/import", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Get the target category from query parameter (if specified)
      const targetCategory = req.query.category as string | undefined || null;
      
      // Debug logging
      console.log(`\n========== INVENTORY IMPORT DEBUG ==========`);
      console.log(`📁 Query params:`, req.query);
      console.log(`📁 Target category: "${targetCategory}"`);
      console.log(`📁 Is targetCategory truthy?`, !!targetCategory);
      console.log(`📁 Target category type:`, typeof targetCategory);
      console.log(`===========================================\n`);

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

      console.log(`📊 Processing ${rawData.length} rows from inventory Excel file`);

      const items: any[] = [];
      // IMPORTANT: If targetCategory is specified, NEVER use currentHeading from Excel
      // If no targetCategory, start with null and let Excel headings populate it
      let currentHeading: string | null = null;

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const rowNumber = i + 2;

        const getColumnValue = (possibleNames: string[]): string | undefined => {
          for (const name of possibleNames) {
            const value = row[name];
            if (value !== undefined && value !== null && value !== "") {
              return String(value).trim();
            }
          }
          return undefined;
        };

        const product = getColumnValue(["PRODUCT", "Product", "product"]);
        
        // Skip empty rows
        if (!product || product === "") {
          continue;
        }

        // Parse data values first
        const boxes = getColumnValue(["Boxes", "boxes", "BOXES"]);
        const sqFtBox = getColumnValue(["Sq Ft/box", "sq_ft_box", "Sq Ft/Box", "SQ FT/BOX"]);

        // If target category IS specified, skip ALL heading rows (don't process them at all)
        if (targetCategory) {
          // Skip rows that look like headings (no data)
          if (!boxes && !sqFtBox) {
            console.log(`⏭️  [TARGET MODE] Skipping heading row: ${product}`);
            continue;
          }
        }
        // If NO target category, use Excel heading logic
        else {
          // If product exists but no numeric data, treat as heading
          if (!boxes && !sqFtBox) {
            currentHeading = product;
            console.log(`📋 [EXCEL MODE] Section Header: ${currentHeading}`);
            continue;
          }
        }

        const boxesValue = boxes || null;
        const sqFtBoxValue = sqFtBox || null;
        const totalSqFt = getColumnValue(["Tot Sq Ft", "total_sq_ft", "Total Sq Ft", "TOT SQ FT"]) || null;
        
        // Extract notes from product name (anything in parentheses)
        let productName = product;
        let notes = null;
        const notesMatch = product.match(/\(([^)]+)\)/);
        if (notesMatch) {
          notes = notesMatch[1];
          productName = product.replace(/\s*\([^)]+\)\s*/g, '').trim();
        }

        // CRITICAL: If targetCategory is specified, ALWAYS use it. Never use currentHeading.
        // Only use currentHeading if NO targetCategory was specified
        let finalCategory: string | null;
        if (targetCategory) {
          finalCategory = targetCategory;  // Always use target
        } else {
          finalCategory = currentHeading;  // Use Excel heading
        }

        const item = {
          productHeading: finalCategory,
          product: productName,
          boxes: boxesValue,
          sqFtPerBox: sqFtBoxValue,
          totalSqFt: totalSqFt,
          notes: notes,
        };

        console.log(`✅ Row ${rowNumber}: "${item.product}" → Category: "${item.productHeading}" ${targetCategory ? '[FORCED]' : '[FROM EXCEL]'}`);
        items.push(item);
      }

      if (items.length === 0) {
        return res.status(400).json({ 
          message: "No valid items found. Ensure your Excel has 'PRODUCT' and 'Boxes' columns with data."
        });
      }

      console.log(`✅ Found ${items.length} valid items to import`);

      const validatedItems = items.map((item) => insertInventorySchema.parse(item));
      const createdItems = await storage.createInventoryItems(validatedItems);

      console.log(`🎉 Successfully imported ${createdItems.length} items`);
      res.json({ 
        success: true, 
        total: items.length,
        imported: createdItems.length
      });
    } catch (error: any) {
      console.error("❌ Error importing inventory file:", error);
      res.status(400).json({ message: error.message || "Failed to import file" });
    }
  });

  // Migration endpoint to update inventory schema
  app.post("/api/migrate-inventory", async (req, res) => {
    try {
      console.log("🔧 Running inventory schema migration...");
      
      await db.execute(sql`DROP TABLE IF EXISTS inventory CASCADE`);
      console.log("✅ Dropped old inventory table");
      
      await db.execute(sql`
        CREATE TABLE inventory (
          id SERIAL PRIMARY KEY,
          product TEXT NOT NULL,
          boxes TEXT,
          sq_ft_per_box TEXT,
          total_sq_ft TEXT,
          product_heading TEXT,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      console.log("✅ Created new inventory table");
      
      await db.execute(sql`CREATE INDEX idx_inventory_product ON inventory(product)`);
      await db.execute(sql`CREATE INDEX idx_inventory_product_heading ON inventory(product_heading)`);
      console.log("✅ Created indexes");
      
      res.json({ success: true, message: "Migration completed successfully" });
    } catch (error: any) {
      console.error("❌ Migration failed:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Migration endpoint to add notes column to leads table
  app.post("/api/migrate/add-notes-to-leads", async (req, res) => {
    try {
      console.log("🔄 Running migration: add notes column to leads table");
      
      // Check if column already exists
      const result = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'notes'
      `);
      
      if (result.rows && result.rows.length > 0) {
        console.log("ℹ️ Notes column already exists");
        return res.json({ success: true, message: "Notes column already exists" });
      }
      
      // Add notes column
      await db.execute(sql`
        ALTER TABLE leads 
        ADD COLUMN notes TEXT
      `);
      
      console.log("✅ Successfully added notes column to leads table");
      res.json({ success: true, message: "Migration completed successfully" });
    } catch (error: any) {
      console.error("❌ Migration failed:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

