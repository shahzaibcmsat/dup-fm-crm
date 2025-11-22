# Email Not Sending - Debugging Guide

## Step-by-Step Troubleshooting

### Step 1: Check Configuration
Visit: http://localhost:5000/api/debug/email-config

You should see:
```json
{
  "configured": true,
  "clientId": "Set (hidden)",
  "clientSecret": "Set (hidden)",
  "tenantId": "common",
  "fromAddress": "YourEmail@domain.com",
  "redirectUri": "http://localhost:5000/api/auth/callback"
}
```

**If you see "Not set" for any field:**
- Your `.env` file is not being loaded correctly
- Make sure the server was restarted after updating `.env`

### Step 2: Send a Test Email
1. Go to http://localhost:5000
2. Click on a lead
3. Click "Send Email"
4. Fill in subject and body
5. Click "Send"
6. **Watch the terminal console** for detailed logs

### Step 3: Interpret the Logs

#### If you see this:
```
⚠️  No Microsoft Graph client available - logging email instead
=== EMAIL SENT (No Microsoft Graph configured) ===
```
**Problem**: Environment variables not loaded
**Solution**: Check `.env` file and restart server

#### If you see this:
```
📧 ========== EMAIL SEND ATTEMPT ==========
📤 Attempting to send via Microsoft Graph...
❌ Failed to acquire access token
Error: invalid_client
```
**Problem**: Wrong Client Secret or Client ID
**Solution**: 
1. Go to Azure Portal
2. Verify Client ID matches
3. Create NEW client secret
4. Update `.env` with new secret

#### If you see this:
```
❌ Failed to send email via Microsoft Graph
Error code: ErrorAccessDenied
Error message: Access is denied
```
**Problem**: Missing API permissions or admin consent
**Solution**: Go to Azure Portal → API Permissions → Grant admin consent

#### If you see this:
```
❌ Failed to send email via Microsoft Graph
Error code: MailboxNotEnabledForRESTAPI
```
**Problem**: Email address doesn't have a mailbox
**Solution**: Use a real Microsoft 365 mailbox email in `EMAIL_FROM_ADDRESS`

#### If you see this:
```
❌ Failed to send email via Microsoft Graph
Error code: ResourceNotFound
Error message: User not found
```
**Problem**: The `EMAIL_FROM_ADDRESS` doesn't exist in your tenant
**Solution**: Use a valid user email from your Microsoft 365 organization

### Step 4: Common Azure Setup Issues

#### Issue: "invalid_client"
**Causes:**
- Wrong Client Secret (most common)
- Client Secret expired
- Wrong Client ID
- Wrong Tenant ID

**Fix:**
1. Azure Portal → App registrations → Your App
2. Go to "Certificates & secrets"
3. Delete old secret
4. Create new secret
5. Copy the VALUE (not Secret ID)
6. Update `.env` file:
   ```
   AZURE_CLIENT_SECRET=paste_new_secret_value_here
   ```
7. Restart server

#### Issue: "insufficient_privileges" or "Access Denied"
**Causes:**
- API permissions not granted
- Admin consent not given

**Fix:**
1. Azure Portal → App registrations → Your App
2. Go to "API permissions"
3. Should have:
   - `Mail.Send` (Application permission)
   - Status should show green checkmark "Granted for..."
4. If not granted, click "Grant admin consent for [Org]"
5. Wait 5 minutes for changes to propagate

#### Issue: "Mailbox not enabled"
**Causes:**
- Using personal Microsoft account instead of M365
- Email doesn't have Exchange Online license
- Email is a distribution list, not a mailbox

**Fix:**
- Use a real Microsoft 365 user mailbox
- Verify the user has Exchange Online license
- Test with your own email first

### Step 5: Verify Azure Configuration

**Required Setup:**
1. **App Registration created**
   - Name: CRM Email Sender
   - Supported accounts: Single/Multi-tenant

2. **Client Secret created**
   - Not expired
   - Value copied to `.env`

3. **API Permissions configured**
   - `Mail.Send` (Application permission) ✅
   - Admin consent granted ✅

4. **Redirect URI set**
   - Platform: Web
   - URI: http://localhost:5000/api/auth/callback

### Step 6: Test with Different Tenant ID

If using "common" doesn't work, try your specific tenant ID:

1. Azure Portal → Azure Active Directory
2. Copy "Tenant ID"
3. Update `.env`:
   ```
   AZURE_TENANT_ID=paste_your_actual_tenant_id_here
   ```
4. Restart server

### Step 7: Check Email From Address

The `EMAIL_FROM_ADDRESS` must be:
- ✅ A real user in your Microsoft 365 organization
- ✅ Have an Exchange Online mailbox
- ✅ Have valid license
- ❌ NOT a shared mailbox (unless configured differently)
- ❌ NOT a distribution list
- ❌ NOT @outlook.com or @hotmail.com (use M365 only)

### Step 8: Test Token Acquisition Separately

Add this test endpoint in `server/routes.ts`:

```typescript
app.get("/api/test/token", async (req, res) => {
  try {
    const client = await getGraphClient();
    if (client) {
      res.json({ success: true, message: "Token acquired successfully!" });
    } else {
      res.json({ success: false, message: "Failed to get token" });
    }
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});
```

Visit: http://localhost:5000/api/test/token

### Detailed Log Analysis

When you send an email, you should see this sequence:

1. **Configuration Check**
```
📋 Microsoft Graph Configuration Check:
  AZURE_CLIENT_ID: ✅ Set
  AZURE_CLIENT_SECRET: ✅ Set
  AZURE_TENANT_ID: common
  EMAIL_FROM_ADDRESS: ✅ Set
```

2. **Token Acquisition**
```
🔄 Acquiring new access token from Microsoft...
✅ Access token acquired successfully
```

3. **Email Send**
```
📧 ========== EMAIL SEND ATTEMPT ==========
To: recipient@email.com
Subject: Test
From: sender@yourdomain.com
📤 Attempting to send via Microsoft Graph...
   Using sender: sender@yourdomain.com
✅ Email sent successfully via Microsoft Graph!
```

### Quick Checklist

- [ ] `.env` file has all 4 Azure variables set
- [ ] Server restarted after editing `.env`
- [ ] Client Secret is correct and not expired
- [ ] API permissions include `Mail.Send` (Application)
- [ ] Admin consent granted (green checkmark)
- [ ] `EMAIL_FROM_ADDRESS` is a real M365 mailbox
- [ ] Tenant ID is correct (try specific ID, not "common")
- [ ] Check Azure Portal → App registrations → Your app → Overview (app is enabled)

### Still Not Working?

**Check the exact error in terminal logs:**

The error message will tell you exactly what's wrong:
- `invalid_client` → Wrong credentials
- `unauthorized_client` → Permissions not granted
- `access_denied` → Need admin consent
- `resource_not_found` → Email address doesn't exist

**Then follow the specific fix above for that error.**

### Alternative: Use Delegated Permissions

If app-only access doesn't work, try delegated permissions:

1. Azure Portal → API permissions
2. Remove `Mail.Send` (Application)
3. Add `Mail.Send` (Delegated)
4. User signs in via: http://localhost:5000/api/auth/microsoft
5. Sends from their own mailbox

This requires user authentication but is simpler to set up.

