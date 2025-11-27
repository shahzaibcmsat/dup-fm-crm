import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { debug, info, error as logError } from './vite';

// Gmail OAuth configuration
interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}

function getGmailConfig(): GmailConfig | null {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/auth/callback';
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log('⚠️  Gmail not configured - missing credentials');
    return null;
  }

  return { clientId, clientSecret, redirectUri, refreshToken };
}

// Create OAuth2 client
function createOAuth2Client(): OAuth2Client | null {
  const config = getGmailConfig();
  if (!config) return null;

  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: config.refreshToken,
  });

  return oauth2Client;
}

// Send email using Gmail API
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  fromEmail?: string,
  inReplyTo?: string,
  threadId?: string,
  references?: string
): Promise<{
  success: boolean;
  message: string;
  details?: any;
  messageId?: string;
  conversationId?: string;
  messageIdHeader?: string;
}> {
  console.log("\n📧 ========== GMAIL SEND ATTEMPT ==========");
  console.log("To:", to);
  console.log("Subject:", subject);
  console.log("From:", fromEmail || process.env.EMAIL_FROM_ADDRESS);
  if (inReplyTo) console.log("🧵 In-Reply-To:", inReplyTo);

  const oauth2Client = createOAuth2Client();
  if (!oauth2Client) {
    console.log("⚠️  No Gmail OAuth client available - logging email instead");
    console.log("=== EMAIL SENT (No Gmail configured) ===");
    console.log(`From: ${fromEmail || "noreply@example.com"}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.log("=========================================\n");
    return { 
      success: true, 
      message: "Email logged (Gmail not configured)", 
      details: { to, subject, body } 
    };
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const sendFromUser = fromEmail || process.env.EMAIL_FROM_ADDRESS || 'me';

    // Create email message in RFC 2822 format
    const messageParts = [
      `From: ${sendFromUser}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
    ];

    // Add In-Reply-To and References headers for proper threading across all email clients
    if (inReplyTo) {
      messageParts.push(`In-Reply-To: ${inReplyTo}`);
      
      // Build References chain: include all previous Message-IDs
      // Format: oldest-message-id ... newest-message-id
      // Do NOT duplicate inReplyTo if it's already at the end of the references chain
      if (references) {
        // Check if inReplyTo is already the last item in the references chain
        const referencesIds = references.trim().split(/\s+/);
        const lastRefId = referencesIds[referencesIds.length - 1];
        
        if (lastRefId === inReplyTo) {
          // Already at the end, don't duplicate
          messageParts.push(`References: ${references}`);
        } else {
          // Not at the end, append it
          messageParts.push(`References: ${references} ${inReplyTo}`);
        }
      } else {
        // No previous chain, just use inReplyTo
        messageParts.push(`References: ${inReplyTo}`);
      }
    }

    messageParts.push('');
    messageParts.push(body);

    const message = messageParts.join('\n');

    // Encode message in base64url format
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: threadId || undefined, // Use existing thread ID to maintain conversation
      },
    });

    console.log('✅ Email sent successfully via Gmail');
    console.log('   Gmail Message ID:', response.data.id);
    console.log('   Gmail Thread ID:', response.data.threadId);

    // Fetch the sent message to get the actual Message-ID header
    let messageIdHeader = null;
    if (response.data.id) {
      try {
        const sentMessage = await gmail.users.messages.get({
          userId: 'me',
          id: response.data.id,
          format: 'full',
        });
        messageIdHeader = getHeader(sentMessage.data, 'Message-ID');
        console.log('   Message-ID Header:', messageIdHeader || 'not found');
      } catch (err) {
        console.log('   ⚠️ Could not fetch Message-ID header');
      }
    }
    console.log("=========================================\n");

    return {
      success: true,
      message: "Email sent via Gmail",
      details: { to, subject, from: sendFromUser },
      messageId: response.data.id || undefined,
      conversationId: response.data.threadId || undefined,
      messageIdHeader: messageIdHeader || undefined, // Return the actual Message-ID header
    };
  } catch (error: any) {
    console.error("❌ Failed to send email via Gmail");
    console.error("   Error:", error.message);
    if (error.response?.data) {
      console.error("   Details:", JSON.stringify(error.response.data, null, 2));
    }
    console.log("=========================================\n");
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// Check if Gmail is configured
export function isGmailConfigured(): boolean {
  return getGmailConfig() !== null;
}

// Fetch new emails from inbox
export async function fetchNewEmails(sinceDateTime?: string): Promise<any[]> {
  const oauth2Client = createOAuth2Client();
  
  if (!oauth2Client) {
    console.log('⚠️ Cannot fetch emails - Gmail not configured');
    return [];
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log('📬 Fetching new emails from Gmail inbox...');

    // Build query
    let query = 'in:inbox';
    if (sinceDateTime) {
      const date = new Date(sinceDateTime);
      const formattedDate = date.toISOString().split('T')[0].replace(/-/g, '/');
      query += ` after:${formattedDate}`;
    }

    // List messages
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50,
    });

    const messages = listResponse.data.messages || [];
    console.log(`📫 Found ${messages.length} emails`);

    // Fetch full details for each message
    const fullMessages = [];
    for (const message of messages) {
      if (message.id) {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });
        fullMessages.push(fullMessage.data);
      }
    }

    return fullMessages;
  } catch (error: any) {
    console.error('❌ Failed to fetch emails:', error.message);
    return [];
  }
}

// Get specific email by ID
export async function getEmailById(messageId: string): Promise<any | null> {
  const oauth2Client = createOAuth2Client();
  
  if (!oauth2Client) {
    return null;
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    
    return response.data;
  } catch (error: any) {
    console.error(`❌ Failed to get email ${messageId}:`, error.message);
    return null;
  }
}

// Extract header value from Gmail message
export function getHeader(message: any, headerName: string): string | null {
  if (!message.payload?.headers) return null;
  
  const header = message.payload.headers.find(
    (h: any) => h.name.toLowerCase() === headerName.toLowerCase()
  );
  
  return header?.value || null;
}

// Get In-Reply-To header from message
export function getInReplyToHeader(message: any): string | null {
  return getHeader(message, 'In-Reply-To');
}

// Get Message-ID header from message (for threading)
export function getMessageIdHeader(message: any): string | null {
  return getHeader(message, 'Message-ID');
}

// Extract email body from Gmail message
export function getEmailBody(message: any): string {
  if (!message.payload) return '';

  // Check for plain text in parts
  const findTextPart = (parts: any[]): string => {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.parts) {
        const text = findTextPart(part.parts);
        if (text) return text;
      }
    }
    return '';
  };

  // If body is directly in payload
  if (message.payload.body?.data) {
    return Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  }

  // Search in parts
  if (message.payload.parts) {
    return findTextPart(message.payload.parts);
  }

  return '';
}
