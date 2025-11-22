# Microsoft Outlook/Microsoft 365 Email Integration Setup

## Overview
This guide will help you connect your Outlook or Microsoft 365 business email to the CRM application so you can send emails directly from the app.

## Prerequisites
- Microsoft 365 or Outlook.com account
- Access to Azure Portal (free tier works)
- Admin access to create Azure App Registrations (or your IT admin's help)

---

## Step-by-Step Setup Guide

### Step 1: Create Azure App Registration

1. **Go to Azure Portal**
   - Visit: https://portal.azure.com
   - Sign in with your Microsoft account

2. **Navigate to App Registrations**
   - Search for "App registrations" in the top search bar
   - Click on "App registrations"
   - Click "+ New registration"

3. **Register the Application**
   ```
   Name: CRM Email Sender (or any name you prefer)
   Supported account types: Choose one of:
     - "Accounts in this organizational directory only" (Single tenant - for business)
     - "Accounts in any organizational directory" (Multi-tenant)
     - "Personal Microsoft accounts only" (For outlook.com accounts)
   
   Redirect URI:
     Platform: Web
     URI: http://localhost:5000/api/auth/callback
   ```
   
   Click "Register"

4. **Note Your Application (client) ID**
   - After registration, you'll see the "Overview" page
   - Copy the **Application (client) ID** - you'll need this for `AZURE_CLIENT_ID`
   - Copy the **Directory (tenant) ID** - you'll need this for `AZURE_TENANT_ID`

### Step 2: Create Client Secret

1. **In your App Registration, go to "Certificates & secrets"**
   - Click on the "Client secrets" tab
   - Click "+ New client secret"

2. **Add a client secret**
   ```
   Description: CRM Email Secret
   Expires: 24 months (or your preference)
   ```
   Click "Add"

3. **Copy the Secret Value**
   - **IMPORTANT**: Copy the **Value** immediately (not the Secret ID)
   - You won't be able to see it again!
   - This is your `AZURE_CLIENT_SECRET`

### Step 3: Configure API Permissions

1. **Go to "API permissions"**
   - Click "+ Add a permission"
   - Click "Microsoft Graph"
   - Click "Application permissions" (for app-only access)

2. **Add these permissions:**
   ```
   Mail.Send         - Send mail as any user
   User.Read.All     - Read all users' full profiles (optional)
   ```

3. **Grant Admin Consent**
   - Click "Grant admin consent for [Your Organization]"
   - Click "Yes" to confirm
   - All permissions should show a green checkmark

### Step 4: Configure Your Application

1. **Update the `.env` file** in your project root:
   ```env
   # Microsoft Graph API Configuration
   AZURE_CLIENT_ID=paste_your_application_client_id_here
   AZURE_CLIENT_SECRET=paste_your_client_secret_value_here
   AZURE_TENANT_ID=paste_your_tenant_id_here
   AZURE_REDIRECT_URI=http://localhost:5000/api/auth/callback

   # Email address to send from (must be a valid Microsoft 365 mailbox)
   EMAIL_FROM_ADDRESS=yourname@yourcompany.com
   ```

2. **Replace the values:**
   - `AZURE_CLIENT_ID`: The Application (client) ID from Step 1
   - `AZURE_CLIENT_SECRET`: The secret value from Step 2
   - `AZURE_TENANT_ID`: The Directory (tenant) ID from Step 1
   - `EMAIL_FROM_ADDRESS`: The email address you want to send from

### Step 5: Test the Integration

1. **Restart your development server**
   ```powershell
   # Stop the current server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

2. **Check authentication status**
   - Visit: http://localhost:5000/api/auth/status
   - Should show: `{"microsoftGraph": true}`

3. **Send a test email**
   - Go to your CRM dashboard
   - Click on any lead
   - Click "Send Email"
   - Compose and send
   - Check the terminal - should show "✅ Email sent successfully via Microsoft Graph"

---

## Common Issues & Solutions

### Issue: "Grant admin consent" button is grayed out
**Solution**: You need to be an administrator in your Azure AD tenant. Contact your IT admin to grant consent.

### Issue: "Tenant ID is required"
**Solution**: Make sure you're using the correct tenant ID from Azure Portal, not "common" unless you have a multi-tenant app.

### Issue: Email not sending - "Insufficient permissions"
**Solution**: 
- Make sure you granted admin consent for the permissions
- Wait a few minutes for changes to propagate
- Verify the `EMAIL_FROM_ADDRESS` is a valid mailbox in your organization

### Issue: "Client secret has expired"
**Solution**: Create a new client secret in Azure Portal and update your `.env` file.

---

## Architecture

### How It Works

1. **Application Authentication**: Your app uses client credentials (Client ID + Secret) to authenticate
2. **App-Only Access**: The app can send emails on behalf of any user in your organization
3. **Microsoft Graph API**: Uses `/users/{email}/sendMail` endpoint
4. **Token Caching**: Access tokens are cached and refreshed automatically

### Security Notes

- ✅ Client secrets should be kept secure and never committed to Git
- ✅ Use environment variables for all sensitive data
- ✅ For production, store tokens in a database, not in memory
- ✅ Rotate client secrets regularly (at least yearly)

---

## Alternative: Delegated Permissions (User Sign-in)

If you want users to send emails from their own accounts instead of using app-only access:

1. **Change API permissions to Delegated**:
   - Remove: `Mail.Send` (Application)
   - Add: `Mail.Send` (Delegated)
   - Add: `User.Read` (Delegated)

2. **Users need to authorize**:
   - Visit: http://localhost:5000/api/auth/microsoft
   - Sign in with their Microsoft account
   - Grant consent

3. **Update code** to use user-specific tokens (requires additional implementation)

---

## Production Deployment

### For Production URLs

Update in Azure Portal AND `.env`:
```
Redirect URI: https://yourdomain.com/api/auth/callback
AZURE_REDIRECT_URI=https://yourdomain.com/api/auth/callback
```

### Environment Variables

Never expose these in your repository. Use:
- Azure Key Vault
- Environment variable management in your hosting platform
- Secure secrets management service

---

## Support

If you need help:
1. Check Azure Portal logs
2. Check application console logs
3. Verify all environment variables are set correctly
4. Ensure email address has a valid mailbox

**Azure Documentation**: https://learn.microsoft.com/en-us/graph/auth/

