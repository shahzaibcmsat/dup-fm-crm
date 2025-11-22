import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Gmail OAuth configuration
interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
}

// In-memory token storage (for production, use database)
let cachedAccessToken: string | null = null;
let tokenExpiry: number | null = null;
let oauth2Client: OAuth2Client | null = null;

function getGmailConfig(): GmailConfig | null {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:5000/api/auth/callback';
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  console.log('📋 Gmail Configuration Check:');
  console.log('  GMAIL_CLIENT_ID:', clientId ? '✅ Set' : '❌ Not set');
  console.log('  GMAIL_CLIENT_SECRET:', clientSecret ? '✅ Set' : '❌ Not set');
  console.log('  GMAIL_REFRESH_TOKEN:', refreshToken ? '✅ Set' : '❌ Not set');
  console.log('  EMAIL_FROM_ADDRESS:', process.env.EMAIL_FROM_ADDRESS || '❌ Not set');

  if (!clientId || !clientSecret) {
    console.log('❌ Gmail not configured - missing credentials');
    return null;
  }

  return { clientId, clientSecret, redirectUri, refreshToken };
}

// Create OAuth2 client
function createOAuth2Client(): OAuth2Client | null {
  const config = getGmailConfig();
  if (!config) return null;

  const client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );

  // Set refresh token if available
  if (config.refreshToken) {
    client.setCredentials({
      refresh_token: config.refreshToken,
    });
  }

  return client;
}

// Get access token
async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid
  if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
    console.log('🔑 Using cached access token');
    return cachedAccessToken;
  }

  if (!oauth2Client) {
    oauth2Client = createOAuth2Client();
  }

  if (!oauth2Client) {
    console.log('❌ OAuth2 client not created - check GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET');
    return null;
  }

  try {
    console.log('🔄 Acquiring new access token from Google...');
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (credentials.access_token) {
      cachedAccessToken = credentials.access_token;
      tokenExpiry = credentials.expiry_date || Date.now() + 3600000;
      console.log('✅ Access token acquired successfully');
      return credentials.access_token;
    }
  } catch (error: any) {
    console.error('❌ Failed to acquire access token:', error.message);
  }

  return null;
}

// Get authorization URL for user consent
export function getAuthorizationUrl(): string | null {
  const config = getGmailConfig();
  if (!config) return null;

  const client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );

  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
  ];

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent to get refresh token
  });

  return authUrl;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<any> {
  const config = getGmailConfig();
  if (!config) {
    throw new Error('Gmail not configured');
  }

  const client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );

  try {
    const { tokens } = await client.getToken(code);
    console.log('✅ Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
    });
    
    // Store refresh token (in production, save to database)
    if (tokens.refresh_token) {
      console.log('📝 Refresh Token (save this to .env as GMAIL_REFRESH_TOKEN):');
      console.log(tokens.refresh_token);
    }
    
    client.setCredentials(tokens);
    oauth2Client = client;
    
    return tokens;
  } catch (error) {
    console.error('Failed to exchange code for tokens:', error);
    throw error;
  }
}

// Create Gmail client
async function getGmailClient() {
  if (!oauth2Client) {
    oauth2Client = createOAuth2Client();
  }

  if (!oauth2Client) return null;

  // Refresh token if needed
  await getAccessToken();

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Encode email message for Gmail API with optional attachments
function encodeEmail(
  to: string, 
  subject: string, 
  body: string, 
  fromEmail?: string, 
  inReplyTo?: string, 
  references?: string,
  attachments?: Array<{ filename: string; content: string; mimeType: string }>
): string {
  const from = fromEmail || process.env.EMAIL_FROM_ADDRESS || 'me';
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2)}`;
  
  let email = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ];

  // Add threading headers if replying
  if (inReplyTo) {
    email.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    email.push(`References: ${references}`);
  }

  // If attachments, use multipart, otherwise simple text
  if (attachments && attachments.length > 0) {
    email.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    email.push('');
    
    // Text body part
    email.push(`--${boundary}`);
    email.push('Content-Type: text/plain; charset=utf-8');
    email.push('');
    email.push(body);
    email.push('');
    
    // Attachment parts
    for (const attachment of attachments) {
      email.push(`--${boundary}`);
      email.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
      email.push('Content-Transfer-Encoding: base64');
      email.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      email.push('');
      email.push(attachment.content); // Should already be base64 encoded
      email.push('');
    }
    
    email.push(`--${boundary}--`);
  } else {
    email.push('Content-Type: text/plain; charset=utf-8');
    email.push('');
    email.push(body);
  }

  const emailString = email.join('\r\n');
  return Buffer.from(emailString).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Send email using Gmail API with optional attachments
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  fromEmail?: string,
  inReplyTo?: string,
  attachments?: Array<{ filename: string; content: string; mimeType: string }>
): Promise<{
  success: boolean;
  message: string;
  details?: any;
  messageId?: string;
  threadId?: string;
}> {
  console.log("\n📧 ========== EMAIL SEND ATTEMPT ==========");
  console.log("To:", to);
  console.log("Subject:", subject);
  console.log("From:", fromEmail || process.env.EMAIL_FROM_ADDRESS);
  if (inReplyTo) console.log("🧵 In-Reply-To:", inReplyTo);

  const gmail = await getGmailClient();
  if (!gmail) {
    console.log("⚠️  No Gmail client available - logging email instead");
    console.log("=== EMAIL SENT (No Gmail configured) ===");
    console.log(`From: ${fromEmail || "noreply@example.com"}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body}`);
    console.log("===================================================\n");
    return { 
      success: true, 
      message: "Email logged (Gmail not configured)", 
      details: { to, subject, body } 
    };
  }

  try {
    let threadId: string | undefined;
    let references: string | undefined;

    // If replying, try to get the original message to extract thread info
    if (inReplyTo) {
      try {
        const originalMessage = await gmail.users.messages.get({
          userId: 'me',
          id: inReplyTo,
          format: 'metadata',
          metadataHeaders: ['Message-ID', 'References', 'In-Reply-To'],
        });

        threadId = originalMessage.data.threadId || undefined;
        
        // Build References header (includes original References + original Message-ID)
        const originalHeaders = originalMessage.data.payload?.headers || [];
        const originalMessageId = originalHeaders.find(h => h.name?.toLowerCase() === 'message-id')?.value;
        const originalReferences = originalHeaders.find(h => h.name?.toLowerCase() === 'references')?.value;
        
        if (originalMessageId) {
          references = originalReferences 
            ? `${originalReferences} ${originalMessageId}`
            : originalMessageId;
        }
      } catch (err) {
        console.warn("⚠️ Could not fetch original message, sending without thread context:", (err as any)?.message);
      }
    }

    const raw = encodeEmail(to, subject, body, fromEmail, inReplyTo, references, attachments);

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId, // Gmail will automatically thread if this is provided
      },
    });

    console.log("✅ Email sent successfully via Gmail!");
    console.log("   Message ID:", response.data.id);
    console.log("   Thread ID:", response.data.threadId);
    console.log("=========================================\n");

    return {
      success: true,
      message: "Email sent via Gmail",
      details: { to, subject, from: fromEmail || process.env.EMAIL_FROM_ADDRESS },
      messageId: response.data.id || undefined,
      threadId: response.data.threadId || undefined,
    };
  } catch (error: any) {
    console.error("❌ Failed to send email via Gmail");
    console.error("   Error message:", error.message);
    console.error("   Error code:", error.code);
    if (error.errors) {
      console.error("   Errors:", JSON.stringify(error.errors, null, 2));
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
  const gmail = await getGmailClient();

  if (!gmail) {
    console.log('⚠️ Cannot fetch emails - Gmail client not configured');
    return [];
  }

  try {
    console.log('📬 Fetching new emails from inbox...');
    
    let query = 'in:inbox';
    if (sinceDateTime) {
      const sinceDate = new Date(sinceDateTime);
      const dateStr = Math.floor(sinceDate.getTime() / 1000);
      query += ` after:${dateStr}`;
    }

    // First, get list of message IDs
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50,
    });

    const messages = listResponse.data.messages || [];
    console.log(`📫 Found ${messages.length} emails`);

    if (messages.length === 0) {
      return [];
    }

    // Fetch full message details
    const fullMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          const fullMsg = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'full',
          });
          return fullMsg.data;
        } catch (err) {
          console.error(`Failed to fetch message ${msg.id}:`, err);
          return null;
        }
      })
    );

    // Parse messages into a consistent format
    const parsedMessages = fullMessages.filter(Boolean).map((msg: any) => {
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value;

      // Get body
      let body = '';
      if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
      } else if (msg.payload?.parts) {
        const textPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeader('Subject') || '(No Subject)',
        from: {
          emailAddress: {
            address: getHeader('From')?.match(/<(.+)>/)?.[1] || getHeader('From'),
          },
        },
        to: getHeader('To'),
        body: {
          content: body,
        },
        receivedDateTime: new Date(parseInt(msg.internalDate || '0')).toISOString(),
        isRead: !msg.labelIds?.includes('UNREAD'),
        internetMessageHeaders: headers,
      };
    });

    return parsedMessages;
  } catch (error: any) {
    console.error('❌ Failed to fetch emails:', error.message);
    return [];
  }
}

// Get specific email by ID
export async function getEmailById(messageId: string): Promise<any | null> {
  const gmail = await getGmailClient();

  if (!gmail) {
    return null;
  }

  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const msg = response.data;
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value;

    // Get body
    let body = '';
    if (msg.payload?.body?.data) {
      body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
    } else if (msg.payload?.parts) {
      const textPart = msg.payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    }

    return {
      id: msg.id,
      threadId: msg.threadId,
      subject: getHeader('Subject') || '(No Subject)',
      from: {
        emailAddress: {
          address: getHeader('From')?.match(/<(.+)>/)?.[1] || getHeader('From'),
        },
      },
      body: {
        content: body,
      },
      receivedDateTime: new Date(parseInt(msg.internalDate || '0')).toISOString(),
      internetMessageHeaders: headers,
    };
  } catch (error: any) {
    console.error(`❌ Failed to get email ${messageId}:`, error.message);
    return null;
  }
}

// Extract In-Reply-To header from message
export function getInReplyToHeader(message: any): string | null {
  if (!message.internetMessageHeaders) return null;
  
  const inReplyToHeader = message.internetMessageHeaders.find(
    (h: any) => h.name?.toLowerCase() === 'in-reply-to'
  );
  
  return inReplyToHeader?.value || null;
}
