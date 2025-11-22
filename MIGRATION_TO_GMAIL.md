# Migration Guide: Microsoft Outlook to Gmail API

This guide helps you migrate from the Microsoft Outlook/Azure AD email integration to Gmail API.

## Why Migrate to Gmail?

### Advantages
- ✅ **Simpler Setup**: No complex Azure AD tenant configuration
- ✅ **Better Free Tier**: Gmail API has generous quotas for free
- ✅ **No License Required**: Works with any Gmail account (no Exchange Online needed)
- ✅ **Faster**: Gmail API typically has better response times
- ✅ **More Reliable Threading**: Gmail's native threading is more robust

### Considerations
- ⚠️ Personal Gmail accounts limited to 100-500 emails/day
- ⚠️ Google Workspace needed for higher limits (2000/day)
- ⚠️ Different OAuth flow (but simpler)

## Migration Steps

### Step 1: Backup Your Current Configuration

Save your current `.env` file values somewhere safe (just in case):
```env
# OLD Microsoft/Azure Configuration
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=...
AZURE_REDIRECT_URI=...
EMAIL_FROM_ADDRESS=...
```

### Step 2: Remove Microsoft Dependencies

The system has been updated to use Gmail. You can now:

1. **Remove old environment variables** from `.env`:
   - Remove `AZURE_CLIENT_ID`
   - Remove `AZURE_CLIENT_SECRET`
   - Remove `AZURE_TENANT_ID`
   - Remove `AZURE_REDIRECT_URI`
   
2. **Keep these**:
   - Keep `EMAIL_FROM_ADDRESS` (update to Gmail address)
   - Keep `DATABASE_URL` (unchanged)
   - Keep `GROQ_API_KEY` (unchanged)

### Step 3: Set Up Gmail API

Follow the complete guide in `GMAIL_SETUP.md`. Quick summary:

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create new project
   - Enable Gmail API

2. **Create OAuth Credentials**
   - Create OAuth consent screen
   - Add scopes: `gmail.send`, `gmail.readonly`, `gmail.modify`
   - Create OAuth 2.0 Client ID (Web application)
   - Add redirect URI: `http://localhost:5000/api/auth/callback`

3. **Get Your Credentials**
   - Copy Client ID
   - Copy Client Secret

### Step 4: Configure Environment Variables

Update your `.env` file:

```env
# Gmail API Configuration
GMAIL_CLIENT_ID=123456789-abc...apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-...
GMAIL_REDIRECT_URI=http://localhost:5000/api/auth/callback
EMAIL_FROM_ADDRESS=your-email@gmail.com

# (Keep these unchanged)
DATABASE_URL=postgresql://...
GROQ_API_KEY=gsk_...
PORT=5000
NODE_ENV=development
```

### Step 5: Authorize Gmail Account

1. **Start your server**:
   ```bash
   npm run dev
   ```

2. **Visit the authorization URL**:
   ```
   http://localhost:5000/api/auth/gmail
   ```

3. **Sign in with Gmail**:
   - Choose your Gmail account
   - Grant the requested permissions
   - You'll see a page with your **Refresh Token**

4. **Copy the Refresh Token** and add to `.env`:
   ```env
   GMAIL_REFRESH_TOKEN=1//0gF...very-long-token
   ```

5. **Restart your server**:
   ```bash
   # Press Ctrl+C, then:
   npm run dev
   ```

### Step 6: Verify Everything Works

1. **Check authentication status**:
   ```
   http://localhost:5000/api/auth/status
   ```
   
   Should show:
   ```json
   {
     "emailProvider": "gmail",
     "gmail": true,
     "environment": {
       "hasClientId": true,
       "hasClientSecret": true,
       "hasRefreshToken": true,
       "fromAddress": "your-email@gmail.com"
     }
   }
   ```

2. **Test email sending**:
   - Go to your CRM dashboard
   - Click on a lead
   - Send a test email
   - Check terminal for "✅ Email sent successfully via Gmail!"

3. **Test email receiving**:
   - Reply to the email from another account
   - Wait ~30 seconds (auto-sync interval)
   - Check for notification bell in header
   - Or manually sync: Settings → Sync Emails

## What Happens to Existing Data?

### ✅ Safe - No Data Loss
- All existing leads remain unchanged
- All existing emails in database remain unchanged
- All email history is preserved
- Thread/conversation tracking continues to work

### 📝 Technical Details
- Database schema remains identical
- `messageId` now stores Gmail message IDs (not Microsoft IDs)
- `conversationId` now stores Gmail thread IDs (not Microsoft conversation IDs)
- Old emails keep their old IDs, new emails get Gmail IDs
- Both systems are compatible at the database level

## Comparison Chart

| Feature | Microsoft Outlook | Gmail API |
|---------|------------------|-----------|
| Setup Complexity | ⭐⭐⭐⭐ (Complex) | ⭐⭐ (Simple) |
| Free Tier Sending | 100/day | 100-500/day |
| Paid Tier Sending | 2000/day (M365) | 2000/day (Workspace) |
| OAuth Flow | Complex (tenant-based) | Simple (account-based) |
| Threading | Good | Excellent |
| API Speed | Good | Excellent |
| License Required | Exchange Online | None |
| Enterprise Features | Excellent | Good |

## Rollback (If Needed)

If you need to rollback to Microsoft Outlook:

1. Restore your old `.env` values
2. Reinstall old packages:
   ```bash
   npm install @microsoft/microsoft-graph-client@^3.0.7 @azure/msal-node@^3.8.0
   ```
3. Restore old `server/outlook.ts` file from git history
4. Restore old routes from git history

Note: The system was designed to make rollback easy, but Gmail is recommended for most users.

## Common Migration Issues

### Issue: "Refresh token not provided"
**Solution**: Make sure you went through the OAuth flow and copied the refresh token to `.env`

### Issue: "redirect_uri_mismatch"
**Solution**: Redirect URI in Google Cloud Console must exactly match the one in `.env`

### Issue: Old emails not threading with new ones
**Solution**: This is expected - old emails use Microsoft thread IDs, new ones use Gmail thread IDs. They won't thread together, but both work independently.

### Issue: Gmail quota exceeded
**Solution**: 
- Personal Gmail: 100-500 emails/day limit
- Upgrade to Google Workspace for 2000/day
- Wait 24 hours for quota reset

## Testing Checklist

After migration, verify:

- [ ] Can send emails to leads
- [ ] Can receive email replies
- [ ] Email threading works (reply to a sent email)
- [ ] Notifications appear when receiving replies
- [ ] Background sync works (30-second interval)
- [ ] Settings page shows "Gmail Connected"
- [ ] No errors in server console

## Support

If you encounter issues:

1. **Check server logs**: Look for detailed error messages in terminal
2. **Verify environment variables**: Use `/api/debug/email-config`
3. **Test mailbox access**: Use `/api/debug/test-mailbox`
4. **Check Google Cloud Console**: Look for API errors and quota usage
5. **Review Gmail Setup Guide**: See `GMAIL_SETUP.md`

## Migration Complete! 🎉

You're now using Gmail API for all email operations. Enjoy the simpler setup and better performance!

---

**Need help?** Check:
- `GMAIL_SETUP.md` - Complete setup instructions
- `README.md` - General documentation
- Server console - Detailed error logs
