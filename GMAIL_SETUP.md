# Gmail API Integration Setup

## Overview
This guide will help you connect your Gmail account to the CRM application so you can send emails directly from the app and receive incoming replies.

## Prerequisites
- Gmail account
- Access to Google Cloud Console (free tier works)
- Basic knowledge of OAuth 2.0

---

## Step-by-Step Setup Guide

### Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com
   - Sign in with your Google account

2. **Create a New Project**
   - Click "Select a project" at the top
   - Click "New Project"
   - Enter project name: `CRM Email Integration` (or any name)
   - Click "Create"

### Step 2: Enable Gmail API

1. **Navigate to APIs & Services**
   - In the left sidebar, click "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click on "Gmail API"
   - Click "Enable"

### Step 3: Create OAuth 2.0 Credentials

1. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Select "External" (for Gmail accounts) or "Internal" (for Google Workspace)
   - Click "Create"
   
   Fill in the required fields:
   ```
   App name: CRM Email System
   User support email: your-email@gmail.com
   Developer contact: your-email@gmail.com
   ```
   
   - Click "Save and Continue"
   - On "Scopes" page, click "Add or Remove Scopes"
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
   - Click "Update" then "Save and Continue"
   - On "Test users" page (if External), add your email as a test user
   - Click "Save and Continue"

2. **Create OAuth Client ID**
   - Go to "APIs & Services" > "Credentials"
   - Click "+ Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Name: `CRM Web App`
   
   Authorized redirect URIs:
   ```
   http://localhost:5000/api/auth/callback
   ```
   
   For production, also add:
   ```
   https://yourdomain.com/api/auth/callback
   ```
   
   - Click "Create"

3. **Copy Your Credentials**
   - You'll see a popup with your credentials
   - **Client ID**: Copy this (starts with something like `123456789-abc...apps.googleusercontent.com`)
   - **Client Secret**: Copy this (looks like `GOCSPX-...`)
   - Click "OK"

### Step 4: Get Refresh Token

1. **Update the `.env` file** in your project root:
   ```env
   # Gmail API Configuration
   GMAIL_CLIENT_ID=paste_your_client_id_here
   GMAIL_CLIENT_SECRET=paste_your_client_secret_here
   GMAIL_REDIRECT_URI=http://localhost:5000/api/auth/callback
   EMAIL_FROM_ADDRESS=your-email@gmail.com
   ```

2. **Start your development server**
   ```powershell
   npm run dev
   ```

3. **Authorize your Gmail account**
   - Visit: http://localhost:5000/api/auth/gmail
   - Sign in with your Gmail account
   - Grant the requested permissions
   - You'll be redirected to a page showing your **Refresh Token**
   - Copy the refresh token from the page

4. **Add Refresh Token to `.env`**
   ```env
   GMAIL_REFRESH_TOKEN=paste_your_refresh_token_here
   ```

5. **Restart your server**
   ```powershell
   # Press Ctrl+C to stop
   npm run dev
   ```

### Step 5: Test the Integration

1. **Check authentication status**
   - Visit: http://localhost:5000/api/auth/status
   - Should show: `{"emailProvider": "gmail", "gmail": true, ...}`

2. **Send a test email**
   - Go to your CRM dashboard: http://localhost:5000
   - Click on any lead
   - Click "Send Email"
   - Compose and send
   - Check the terminal - should show "✅ Email sent successfully via Gmail!"

---

## Common Issues & Solutions

### Issue: "Access blocked: This app's request is invalid"
**Solution**: Make sure you've configured the OAuth consent screen properly and added the correct scopes.

### Issue: "redirect_uri_mismatch"
**Solution**: 
- The redirect URI in Google Cloud Console must exactly match the one in your `.env` file
- Check for typos, trailing slashes, http vs https

### Issue: "Invalid grant" or "Token has been expired or revoked"
**Solution**: 
- Your refresh token may have expired
- Go through the authorization flow again to get a new refresh token
- Make sure you selected "access_type: offline" (this is done automatically in the code)

### Issue: "Refresh token not returned"
**Solution**: 
- Revoke access: https://myaccount.google.com/permissions
- Remove your app from the list
- Go through authorization flow again - this forces a new refresh token

### Issue: Gmail quota exceeded
**Solution**: 
- Gmail has sending limits: 100-500 emails per day depending on account type
- For higher volumes, consider Google Workspace
- Monitor your usage in Google Cloud Console

---

## Architecture

### How It Works

1. **OAuth 2.0 Flow**: Your app uses OAuth 2.0 to get permission to access Gmail
2. **Refresh Token**: A long-lived token that can be used to get new access tokens
3. **Access Token**: Short-lived token (1 hour) used to make API calls
4. **Gmail API**: Google's REST API for sending/receiving emails
5. **Threading**: Emails are automatically threaded using Gmail's thread IDs

### Security Notes

- ✅ Never commit secrets to Git (use `.env` file)
- ✅ Keep your Client Secret and Refresh Token secure
- ✅ Use environment variables for all sensitive data
- ✅ Refresh tokens don't expire unless revoked by user
- ✅ Access tokens are automatically refreshed when expired

---

## Gmail API Features Supported

### ✅ Implemented
- Send emails
- Read inbox emails
- Email threading (conversations)
- Reply to emails (preserves thread)
- Fetch new emails for sync
- Background email checking every 30 seconds

### 📋 Available but Not Used
- Labels/folders management
- Email search
- Attachments
- HTML emails
- Draft emails
- Email deletion

---

## Rate Limits & Quotas

### Free Tier Limits (Gmail API)
- **Sending**: 100-500 emails per day (varies by account type)
- **Read requests**: 1 billion requests per day (very generous)
- **Rate limit**: 250 requests per second per user

### Google Workspace Limits
- **Sending**: 2,000 emails per day
- Higher quotas available

Monitor your usage: https://console.cloud.google.com/apis/api/gmail.googleapis.com/quotas

---

## Production Deployment

### For Production URLs

1. **Update OAuth Consent Screen**
   - Go to "Publishing status" in Google Cloud Console
   - Click "Publish App" (if you want public access)
   - Or keep it in Testing mode and add users manually

2. **Add Production Redirect URI**
   ```
   https://yourdomain.com/api/auth/callback
   ```

3. **Update `.env` for production**
   ```env
   GMAIL_REDIRECT_URI=https://yourdomain.com/api/auth/callback
   ```

### Environment Variables

Never expose these in your repository. Use:
- Vercel: Environment Variables in project settings
- Heroku: Config Vars
- AWS: Systems Manager Parameter Store
- Docker: Secrets or environment variables

---

## Troubleshooting Commands

### Test Gmail Connection
```bash
curl http://localhost:5000/api/auth/status
```

### Test Email Configuration
```bash
curl http://localhost:5000/api/debug/email-config
```

### Test Mailbox Access
```bash
curl http://localhost:5000/api/debug/test-mailbox
```

### View Logs
Check your terminal/console for detailed logs. Every email operation logs its status.

---

## Differences from Microsoft Outlook

### Gmail Advantages
- ✅ Simpler OAuth flow (no tenant ID needed)
- ✅ No Exchange Online license required
- ✅ Better free tier quotas
- ✅ More reliable threading
- ✅ Faster API response times

### Gmail Limitations
- ❌ Personal Gmail accounts have lower sending limits (100/day)
- ❌ Google Workspace has costs for higher limits
- ❌ Less integration with enterprise tools

---

## Support Resources

- **Gmail API Documentation**: https://developers.google.com/gmail/api
- **OAuth 2.0 Guide**: https://developers.google.com/identity/protocols/oauth2
- **Google Cloud Console**: https://console.cloud.google.com
- **API Quotas**: https://console.cloud.google.com/apis/api/gmail.googleapis.com/quotas

---

## Migration from Microsoft Outlook

If you're migrating from the previous Microsoft Outlook integration:

1. **Remove old environment variables** from `.env`:
   ```
   AZURE_CLIENT_ID
   AZURE_CLIENT_SECRET
   AZURE_TENANT_ID
   AZURE_REDIRECT_URI
   ```

2. **Add Gmail environment variables** (see Step 4)

3. **Existing emails in database** will remain intact - only new emails will use Gmail

4. **Thread/Conversation IDs** are stored the same way, just using Gmail's thread IDs instead of Microsoft's conversation IDs

---

## Quick Start Summary

1. Create Google Cloud Project
2. Enable Gmail API
3. Create OAuth credentials
4. Add credentials to `.env`
5. Visit `/api/auth/gmail` to authorize
6. Copy refresh token to `.env`
7. Restart server
8. Start sending emails!

**Total setup time**: ~10 minutes

---

## Need Help?

If you encounter issues:
1. Check the terminal console for detailed error messages
2. Verify all environment variables are set correctly
3. Make sure redirect URI exactly matches in both places
4. Try revoking access and re-authorizing
5. Check Google Cloud Console for API errors and quota usage
