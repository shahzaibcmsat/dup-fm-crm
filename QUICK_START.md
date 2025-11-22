# Quick Start: Gmail API Setup

Get your CRM email system running with Gmail in under 15 minutes!

## Prerequisites
- Gmail account (or Google Workspace)
- Node.js 18+ installed
- Git installed

## Setup Steps

### 1. Install Dependencies (1 min)
```bash
npm install
```

### 2. Create Google Cloud Project (3 min)

1. Go to https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Name: "CRM Email" → Create
4. Wait for project creation

### 3. Enable Gmail API (1 min)

1. Click "APIs & Services" → "Library"
2. Search: "Gmail API"
3. Click "Gmail API" → Enable

### 4. Configure OAuth (3 min)

1. **OAuth Consent Screen**:
   - Click "APIs & Services" → "OAuth consent screen"
   - Select "External" → Create
   - App name: "CRM Email"
   - User support email: your-email@gmail.com
   - Developer contact: your-email@gmail.com
   - Save and Continue
   
2. **Add Scopes**:
   - Click "Add or Remove Scopes"
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
   - Update → Save and Continue
   
3. **Test Users** (if External):
   - Add your Gmail as test user
   - Save and Continue

### 5. Create Credentials (2 min)

1. Click "APIs & Services" → "Credentials"
2. Click "+ Create Credentials" → "OAuth client ID"
3. Application type: "Web application"
4. Name: "CRM Web App"
5. Authorized redirect URIs:
   ```
   http://localhost:5000/api/auth/callback
   ```
6. Create
7. **COPY** Client ID and Client Secret (you'll need these!)

### 6. Configure Environment (2 min)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add:
   ```env
   GMAIL_CLIENT_ID=paste-your-client-id-here
   GMAIL_CLIENT_SECRET=paste-your-client-secret-here
   EMAIL_FROM_ADDRESS=your-email@gmail.com
   DATABASE_URL=your-postgres-connection-string
   ```

### 7. Get Refresh Token (2 min)

1. Start server:
   ```bash
   npm run dev
   ```

2. Visit in browser:
   ```
   http://localhost:5000/api/auth/gmail
   ```

3. Sign in with Gmail → Grant permissions

4. Copy the **Refresh Token** from the page

5. Add to `.env`:
   ```env
   GMAIL_REFRESH_TOKEN=paste-refresh-token-here
   ```

6. Restart server:
   ```bash
   # Press Ctrl+C, then:
   npm run dev
   ```

### 8. Test It! (1 min)

1. Open: http://localhost:5000

2. Click on any lead → "Send Email"

3. Send a test email

4. Check terminal for: "✅ Email sent successfully via Gmail!"

## Done! 🎉

Your CRM is now connected to Gmail!

## What's Next?

- **Reply to an email** from another account to test incoming emails
- **Check notifications** - bell icon shows new replies
- **View email threads** - click on a lead to see conversation
- **Auto-sync** runs every 30 seconds automatically

## Need Help?

- **Full Setup Guide**: See `GMAIL_SETUP.md`
- **Migration Guide**: See `MIGRATION_TO_GMAIL.md`
- **Issues?** Check server console for error messages
- **Debug**: Visit `http://localhost:5000/api/debug/email-config`

## Common Issues

### "Refresh token not shown"
- Make sure you selected "access_type: offline" (done automatically)
- Try revoking access at https://myaccount.google.com/permissions
- Go through authorization flow again

### "redirect_uri_mismatch"
- Redirect URI must exactly match in Google Cloud Console and `.env`
- Check for typos, extra slashes, http vs https

### "Invalid grant"
- Refresh token expired (rare)
- Get a new refresh token by re-authorizing

## Quota Limits

- **Personal Gmail**: 100-500 emails/day
- **Google Workspace**: 2,000 emails/day
- **API Reads**: 1 billion/day (very generous)

Monitor usage: https://console.cloud.google.com/apis/api/gmail.googleapis.com/quotas

---

**Total Time**: ~15 minutes  
**Difficulty**: Easy  
**Cost**: Free (Gmail API)

Enjoy your Gmail-powered CRM! 📧
