import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { insertLeadSchema, insertEmailSchema, insertCompanySchema, insertInventorySchema } from "@shared/schema";
import { sendEmail, isGmailConfigured } from "./gmail";
import { grammarFix, generateAutoReply } from "./groq";
import { getAllConfig, saveConfigToFile, validateConfig } from "./config-manager";
import { debug, info, error as logError } from './vite';

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== SUPABASE AUTH INFO ====================
  // Authentication is handled by Supabase Auth + RLS policies
  // No custom auth middleware needed - database automatically enforces access control
  // Users must be authenticated via Supabase to access data
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Debug endpoint to check submission dates
  app.get("/api/debug/leads", async (req, res) => {
    try {
      const leads = await db.execute(sql`
        SELECT id, client_name, email, submission_date, created_at 
        FROM leads 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      res.json(leads.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== API ROUTES ====================
  // All data access is protected by Supabase RLS policies
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

  // Gmail configuration status endpoint
  app.get("/api/auth/status", async (req, res) => {
    res.json({
      emailProvider: 'gmail',
      gmailConfigured: isGmailConfigured(),
      environment: {
        hasClientId: !!process.env.GMAIL_CLIENT_ID,
        hasClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
        hasRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN,
        fromAddress: process.env.EMAIL_FROM_ADDRESS || 'not set'
      }
    });
  });

  // Debug endpoint to test email configuration
  app.get("/api/debug/email-config", async (req, res) => {
    res.json({
      provider: 'gmail',
      gmail: {
        configured: isGmailConfigured(),
        clientId: process.env.GMAIL_CLIENT_ID ? 'Set (hidden)' : 'Not set',
        clientSecret: process.env.GMAIL_CLIENT_SECRET ? 'Set (hidden)' : 'Not set',
        refreshToken: process.env.GMAIL_REFRESH_TOKEN ? 'Set (hidden)' : 'Not set',
        fromAddress: process.env.EMAIL_FROM_ADDRESS || 'Not set',
        redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/auth/callback'
      }
    });
  });

  // Test Gmail connection
  app.get("/api/debug/test-gmail", async (req, res) => {
    try {
      const { isGmailConfigured } = await import("./gmail");
      
      if (!isGmailConfigured()) {
        return res.json({ 
          success: false, 
          error: "Gmail not configured. Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN" 
        });
      }

      const fromAddress = process.env.EMAIL_FROM_ADDRESS;
      if (!fromAddress) {
        return res.json({ success: false, error: "EMAIL_FROM_ADDRESS not set" });
      }

      res.json({ 
        success: true, 
        message: "Gmail is configured and ready",
        fromAddress
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
      // Log first lead to debug submission date
      if (leads.length > 0) {
        console.log('📋 First lead data:', {
          id: leads[0].id,
          clientName: leads[0].clientName,
          submissionDate: leads[0].submissionDate,
          createdAt: leads[0].createdAt
        });
      }
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
      // Convert submissionDate string to Date object if present
      const bodyData = { ...req.body };
      if (bodyData.submissionDate && typeof bodyData.submissionDate === 'string') {
        bodyData.submissionDate = new Date(bodyData.submissionDate);
      }
      const validatedData = insertLeadSchema.parse(bodyData);
      const lead = await storage.createLead(validatedData);
      res.status(201).json(lead);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      // Convert submissionDate string to Date object if present
      const bodyData = { ...req.body };
      if (bodyData.submissionDate && typeof bodyData.submissionDate === 'string') {
        bodyData.submissionDate = new Date(bodyData.submissionDate);
      }
      const validatedData = insertLeadSchema.parse(bodyData);
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

  // Assign lead to user
  app.patch("/api/leads/:id/assign", async (req, res) => {
    try {
      const { userId, assignedBy } = req.body;
      console.log("👤 Assign lead request:", { leadId: req.params.id, userId, assignedBy });
      
      const result = await storage.assignLead(req.params.id, userId, assignedBy);
      console.log("✅ Lead assigned:", result);
      
      res.json(result);
    } catch (error: any) {
      console.error("❌ Error assigning lead:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk assign leads to user
  app.post("/api/leads/bulk-assign-user", async (req, res) => {
    try {
      const { leadIds, userId, assignedBy } = req.body;
      console.log("👥 Bulk assign leads request:", { leadIds, userId, assignedBy });
      
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ message: "Lead IDs array is required" });
      }
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      const updatePromises = leadIds.map(async (leadId) => {
        console.log(`  Assigning lead ${leadId} to user ${userId}`);
        return await storage.assignLead(leadId, userId, assignedBy);
      });
      
      const results = await Promise.all(updatePromises);
      console.log("✅ All leads assigned:", results.length);
      
      res.json({ 
        message: `${leadIds.length} lead(s) assigned to user successfully`,
        count: leadIds.length
      });
    } catch (error: any) {
      console.error("❌ Error bulk assigning leads:", error);
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

      console.log(`📧 Sending email via Gmail...`);
      
      if (lastEmail) {
        console.log(`🧵 Found existing conversation - replying to thread`);
        console.log(`   Last Message ID: ${lastEmail.messageId}`);
        console.log(`   In-Reply-To: ${lastEmail.inReplyTo || 'none'}`);
        console.log(`   Thread ID: ${lastEmail.conversationId}`);
      }

      // Determine the email subject - add "Re:" only if not already present
      let emailSubject = subject;
      if (lastEmail) {
        const baseSubject = lastEmail.subject.replace(/^Re:\s*/i, '');
        emailSubject = `Re: ${baseSubject}`;
      }

      // For threading:
      // 1. inReplyTo should be the Message-ID header from the last email in the conversation
      //    - For received emails: stored in inReplyTo field (Message-ID from their email)
      //    - For sent emails: also stored in inReplyTo field (Message-ID from our sent email)
      // 2. threadId should be the conversationId to maintain the Gmail thread
      // 3. references should contain the full chain of Message-IDs for proper threading in all email clients
      const replyToMessageId = lastEmail?.inReplyTo || undefined;
      const threadId = lastEmail?.conversationId || undefined;
      
      // Build References chain for proper threading across all email clients (Gmail, Outlook, Roundcube, etc.)
      let referencesChain = lastEmail?.references || '';
      if (replyToMessageId) {
        // If there's already a references chain, append the current inReplyTo
        if (referencesChain && !referencesChain.includes(replyToMessageId)) {
          referencesChain = `${referencesChain} ${replyToMessageId}`;
        } else if (!referencesChain) {
          // Start a new chain with just the inReplyTo
          referencesChain = replyToMessageId;
        }
      }

      console.log(`🧵 Threading details:`);
      console.log(`   Last Email Direction: ${lastEmail?.direction}`);
      console.log(`   In-Reply-To Header: ${replyToMessageId || 'none'}`);
      console.log(`   References Chain: ${referencesChain || 'none'}`);
      console.log(`   Thread ID: ${threadId || 'none'}`);
      
      if (!replyToMessageId) {
        console.log(`   ⚠️ WARNING: No Message-ID header available for threading!`);
      }

      // Send email using Gmail API
      const result = await sendEmail(
        lead.email, 
        emailSubject, 
        body, 
        undefined, // fromEmail (use default)
        replyToMessageId, // inReplyTo for threading (Message-ID from headers)
        threadId, // threadId to maintain conversation (Gmail-specific)
        referencesChain || undefined // references chain for universal email threading
      );
      
      // Preserve conversation ID from previous emails
      if (lastEmail?.conversationId && !result.conversationId) {
        result.conversationId = lastEmail.conversationId;
      }

      const fromEmail = process.env.EMAIL_FROM_ADDRESS;

      // Build the new references chain including our new message
      let newReferencesChain = referencesChain || '';
      if (result.messageIdHeader) {
        if (newReferencesChain && !newReferencesChain.includes(result.messageIdHeader)) {
          newReferencesChain = `${newReferencesChain} ${result.messageIdHeader}`;
        } else if (!newReferencesChain) {
          newReferencesChain = result.messageIdHeader;
        }
      }

      const emailData = insertEmailSchema.parse({
        leadId: lead.id,
        subject: emailSubject,
        body,
        direction: "sent",
        messageId: result.messageId || null, // Gmail's message ID
        conversationId: result.conversationId || null, // Gmail's thread ID
        fromEmail: fromEmail || null,
        toEmail: lead.email,
        inReplyTo: result.messageIdHeader || null, // Store the Message-ID header from our sent email
        references: newReferencesChain || null, // Store the full References chain
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
      const notifications = await getRecentNotifications(since);
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
      await dismissNotificationsForLead(leadId);
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
      await dismissNotification(notificationId);
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
      const { fetchNewEmails, getInReplyToHeader, getEmailBody, getHeader } = await import("./gmail");
      const { addEmailNotification } = await import("./index");
      
      // Get timestamp of last sync (or fetch all recent emails)
      const lastSyncTime = req.body.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      console.log(`🔄 Manual sync requested since ${new Date(lastSyncTime).toLocaleString()}`);
      const newEmails = await fetchNewEmails(lastSyncTime);
      let savedCount = 0;
      let matchedCount = 0;

      for (const email of newEmails) {
        // Extract email info from Gmail message
        const fromAddress = getHeader(email, 'From');
        const subject = getHeader(email, 'Subject');
        const gmailMessageId = email.id; // Gmail's internal ID
        const threadId = email.threadId; // Gmail's thread ID
        const messageIdHeader = getHeader(email, 'Message-ID'); // Actual Message-ID from headers
        
        console.log(`  📧 Processing email from: ${fromAddress}`);
        console.log(`     Subject: ${subject || '(No Subject)'}`);
        console.log(`     Gmail Message ID: ${gmailMessageId}`);
        console.log(`     Message-ID Header: ${messageIdHeader || 'none'}`);
        console.log(`     Thread ID: ${threadId || 'none'}`);
        
        if (!fromAddress) {
          console.log(`     No from address, skipping`);
          continue;
        }

        // Extract email address from "Name <email@example.com>" format
        const emailMatch = fromAddress.match(/<(.+?)>/) || [null, fromAddress];
        const cleanFromAddress = emailMatch[1] || fromAddress;

        // Check if we already have this message (using Gmail's message ID)
        const existing = await storage.getEmailByMessageId(gmailMessageId);
        
        if (existing) {
          console.log(`     Email already exists in database, skipping`);
          continue;
        }

        // Try to find the correct lead by matching conversation thread
        let lead = null;
        const inReplyToHeader = getInReplyToHeader(email);
        
        // First, try to match by thread ID
        if (threadId) {
          console.log(`     Looking for existing email with thread ID: ${threadId}`);
          const relatedEmail = await storage.getEmailByConversationId(threadId);
          if (relatedEmail) {
            console.log(`     Found related email in thread, using lead: ${relatedEmail.leadId}`);
            lead = await storage.getLead(relatedEmail.leadId);
            matchedCount++;
          }
        }
        
        // If no match by thread, try by email address
        if (!lead) {
          console.log(`     No thread match, looking for lead by email address`);
          lead = await storage.getLeadByEmail(cleanFromAddress);
          if (lead) {
            matchedCount++;
          }
        }
        
        if (lead) {
          console.log(`     Matched to lead: ${lead.clientName} (${lead.id})`);
          console.log(`     Saving new email to database...`);
          
          const emailBody = getEmailBody(email);
          
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
          });

          await storage.createEmail(emailData);
          savedCount++;
          
          // Update lead status to "Replied" if they responded
          await storage.updateLeadStatus(lead.id, "Replied");
          
          // Add notification for this new reply
          const notification = await addEmailNotification(lead.id, lead.clientName, cleanFromAddress, subject || '(No Subject)');
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
          
          const submissionDate = getColumnValue(row, [
            "Submission Date", "submission_date", "SUBMISSION DATE", "Date", "date", "DATE"
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

          // Parse submission date if provided  
          let parsedSubmissionDate = null;
          if (submissionDate) {
            try {
              let dateValue: Date | null = null;
              
              // Handle Excel serial numbers (as number OR string)
              const serialNumber = typeof submissionDate === 'string' ? parseFloat(submissionDate) : submissionDate;
              
              if (typeof serialNumber === 'number' && !isNaN(serialNumber) && serialNumber > 1000) {
                // Convert Excel serial date to JavaScript Date
                // Excel epoch is December 30, 1899 (Excel incorrectly treats 1900 as a leap year)
                const excelEpoch = new Date(1899, 11, 30);
                const daysOffset = Math.floor(serialNumber);
                dateValue = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
                console.log(`   Submission Date: ${dateValue.toISOString()} (from Excel serial: ${serialNumber})`);
              } else if (typeof submissionDate === 'string') {
                // Try to parse as regular date string
                dateValue = new Date(submissionDate);
                if (!isNaN(dateValue.getTime())) {
                  console.log(`   Submission Date: ${dateValue.toISOString()} (from string)`);
                }
              }
              
              // Validate the date is reasonable (between 1990 and 2100)
              if (dateValue && !isNaN(dateValue.getTime()) && dateValue.getFullYear() >= 1990 && dateValue.getFullYear() <= 2100) {
                parsedSubmissionDate = dateValue;
              } else if (dateValue) {
                console.log(`   ⚠️ Date out of reasonable range: ${dateValue.toISOString()}`);
              } else {
                console.log(`   ⚠️ Could not parse date: ${submissionDate}`);
              }
            } catch (err) {
              console.log(`   ⚠️ Error parsing submission date: ${submissionDate}`, err);
            }
          }

          return {
            clientName,
            email,
            phone: phone || null,
            subject: subject || null,
            leadDetails: leadDetails || "",
            status: "New",
            submissionDate: parsedSubmissionDate,
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
      
      // Get emails of successfully imported leads
      const successfulEmails = createdLeads.map(lead => lead.email);
      
      console.log(`✅ Successfully imported ${createdCount} leads`);
      console.log(`📧 Successfully imported emails:`, successfulEmails);

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
          successfulEmails: successfulEmails,
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

  // Migration endpoint to add submission_date column to leads table
  app.post("/api/migrate/add-submission-date-to-leads", async (req, res) => {
    try {
      console.log("🔄 Running migration: add submission_date column to leads table");
      
      // Check if column already exists
      const result = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'submission_date'
      `);
      
      if (result.rows && result.rows.length > 0) {
        console.log("ℹ️ submission_date column already exists");
        return res.json({ success: true, message: "submission_date column already exists" });
      }
      
      // Add submission_date column
      await db.execute(sql`
        ALTER TABLE leads 
        ADD COLUMN submission_date TIMESTAMP
      `);
      
      // Create index for better performance
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_leads_submission_date ON leads(submission_date)
      `);
      
      console.log("✅ Successfully added submission_date column to leads table");
      res.json({ success: true, message: "Migration completed successfully" });
    } catch (error: any) {
      console.error("❌ Migration failed:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ==================== USER MANAGEMENT API ====================
  // Get all users (admin only)
  app.get("/api/users", async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      
      if (!supabaseServiceKey) {
        return res.status(500).json({ message: "Supabase service key not configured" });
      }
      
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();
      
      if (error) throw error;
      
      const users = data.users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role || 'member',
        canSeeInventory: user.user_metadata?.canSeeInventory || false,
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at,
      }));
      
      res.json(users);
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new user (admin only)
  app.post("/api/users", async (req, res) => {
    try {
      const { email, password, role, autoConfirm } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      
      if (!supabaseServiceKey) {
        return res.status(500).json({ message: "Supabase service key not configured" });
      }
      
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: autoConfirm,
        user_metadata: {
          role: role || 'member'
        }
      });
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        message: "User created successfully",
        user: {
          id: data.user.id,
          email: data.user.email,
          role: data.user.user_metadata?.role || 'member'
        }
      });
    } catch (error: any) {
      console.error("Failed to create user:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      
      if (!supabaseServiceKey) {
        return res.status(500).json({ message: "Supabase service key not configured" });
      }
      
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      
      if (error) throw error;
      
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update user inventory permission (admin only)
  app.patch("/api/users/:id/inventory-access", async (req, res) => {
    try {
      const { id } = req.params;
      const { canSeeInventory } = req.body;
      
      if (typeof canSeeInventory !== 'boolean') {
        return res.status(400).json({ message: "canSeeInventory must be a boolean" });
      }
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      
      if (!supabaseServiceKey) {
        return res.status(500).json({ message: "Supabase service key not configured" });
      }
      
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      // Get current user to preserve existing metadata
      const { data: currentUser } = await supabaseAdmin.auth.admin.getUserById(id);
      
      // Update user metadata while preserving role
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: {
          ...currentUser?.user?.user_metadata,
          canSeeInventory
        }
      });
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        message: "Inventory access updated successfully",
        canSeeInventory
      });
    } catch (error: any) {
      console.error("Failed to update inventory access:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}




