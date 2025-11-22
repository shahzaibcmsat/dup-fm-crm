import { google } from 'googleapis';

// Google Sheets service using service account or OAuth credentials
// To use this, you need to set up Google Cloud credentials

interface GoogleSheetsConfig {
  type: 'service_account' | 'oauth';
  credentials?: any;
}

function getGoogleSheetsConfig(): GoogleSheetsConfig {
  // Check for service account credentials
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      return {
        type: 'service_account',
        credentials
      };
    } catch (error) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON');
    }
  }

  // Check for OAuth credentials
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      type: 'oauth',
      credentials: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      }
    };
  }

  return { type: 'service_account' };
}

export async function getGoogleSheetsClient() {
  const config = getGoogleSheetsConfig();

  if (config.type === 'service_account' && config.credentials) {
    const auth = new google.auth.GoogleAuth({
      credentials: config.credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    return google.sheets({ version: 'v4', auth });
  }

  if (config.type === 'oauth' && config.credentials) {
    const oauth2Client = new google.auth.OAuth2(
      config.credentials.client_id,
      config.credentials.client_secret
    );

    oauth2Client.setCredentials({
      refresh_token: config.credentials.refresh_token
    });

    return google.sheets({ version: 'v4', auth: oauth2Client });
  }

  // Return client without auth - will only work for public sheets
  console.warn('No Google Sheets credentials configured. Only public sheets will work.');
  return google.sheets({ version: 'v4' });
}

// Check if Google Sheets is properly configured
export function isGoogleSheetsConfigured() {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || 
           (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN));
}

