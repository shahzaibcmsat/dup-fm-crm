# FMD Companies Sales CRM - cPanel Deployment Guide

## 📦 Production Build Complete

The production files are ready in the `dist` folder.

## 🚀 Deployment Steps for cPanel

### 1. Upload Files to cPanel

Upload the following files/folders to your cPanel hosting:

```
dist/
  ├── index.js              (Server bundle)
  ├── public/               (Static frontend files)
      ├── index.html
      ├── fmd-logo.png
      ├── assets/
          ├── index-*.css
          └── index-*.js
node_modules/             (Required dependencies - see step 3)
package.json
.env                      (Environment variables - CREATE THIS)
```

### 2. Create .env File on Server

Create a `.env` file in your application root with these variables:

```env
# Azure AD Configuration
AZURE_CLIENT_ID=652c002b-7609-4204-8721-54027c11684d
AZURE_CLIENT_SECRET=<YOUR_AZURE_CLIENT_SECRET_HERE>
AZURE_TENANT_ID=a9d57989-572b-4ab1-9a22-a92c4b3b43b0
EMAIL_FROM_ADDRESS=devops@napollosoftware.onmicrosoft.com

# Database Configuration
DATABASE_URL=postgresql://postgres.moiforfqhglnseexvbiu:ShahZaib@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

# Server Configuration
PORT=5000
NODE_ENV=production
```

**⚠️ Important**: Replace `<YOUR_AZURE_CLIENT_SECRET_HERE>` with your actual Azure client secret value.

### 3. Install Dependencies on cPanel

**Option A: Upload node_modules** (Recommended for cPanel)
- Run `npm install --production` locally
- Upload the entire `node_modules` folder to cPanel (this avoids compilation issues on shared hosting)

**Option B: Install on Server**
- SSH into your cPanel server
- Navigate to your application directory
- Run: `npm install --production`

### 4. Setup Node.js Application in cPanel

1. Go to **Software → Setup Node.js App** in cPanel
2. Click **Create Application**
3. Configure:
   - **Node.js version**: 18.x or higher
   - **Application mode**: Production
   - **Application root**: `/home/yourusername/yourapp`
   - **Application URL**: Your domain or subdomain
   - **Application startup file**: `dist/index.js`
   - **Environment variables**: Add all variables from `.env` file

4. Click **Create**

### 5. Start the Application

After setup:
1. Click **Start App** or **Restart App** button
2. The application will start on the configured port (usually auto-assigned by cPanel)

### 6. Configure Domain/Subdomain

Point your domain or subdomain to the Node.js application:
- cPanel typically uses Apache proxy to forward requests
- Example: `crm.fmdcompanies.com` → Node.js app on port 5000

### 7. Verify Deployment

Visit your domain and check:
- ✅ FMD logo appears with correct branding
- ✅ Login/Navigation works
- ✅ Leads page loads
- ✅ Email sending works (test with a lead)
- ✅ Companies page loads
- ✅ Notifications appear when replies arrive

## 🔧 Troubleshooting

### Database Connection Issues
- Ensure your cPanel server IP is whitelisted in Supabase
- Check that DATABASE_URL is correct
- Verify PostgreSQL port 6543 is accessible from your hosting

### Email Sending Fails
- Verify Azure AD application has admin consent for permissions
- Check AZURE_CLIENT_SECRET is the secret **value**, not the secret ID
- Ensure application runs with proper environment variables

### Application Won't Start
- Check Node.js version (must be 18.x or higher)
- Review error logs in cPanel Node.js App section
- Verify all dependencies are installed
- Check that `dist/index.js` exists and is executable

### Static Files Not Loading
- Ensure `dist/public` folder structure is intact
- Check file permissions (644 for files, 755 for directories)
- Verify the application URL matches your domain configuration

## 📊 Required Azure AD Permissions

Your Azure AD app registration must have these **Application** permissions with admin consent:

- **Mail.Send** - Send emails as organization users
- **Mail.Read** - Read emails from mailbox
- **Mail.ReadWrite** - Read and write access to mailboxes

## 🗄️ Database Tables

Ensure these tables exist in your PostgreSQL database:
- `companies` - Company information
- `leads` - Lead contacts with company relationships
- `emails` - Email conversation tracking
- `email_notifications` - Notification system (auto-created)

## 📝 Post-Deployment Configuration

### Add Your Email Account
1. Go to **Settings** in the CRM
2. Configure email sync settings
3. Test email sending functionality

### Import Initial Data
1. Use the **Import** feature to bulk add leads
2. Create companies from the **Companies** page
3. Assign leads to companies

### Customize Branding (if needed)
- Logo: Replace `/dist/public/fmd-logo.png`
- Colors: Already configured with FMD burgundy, green, and black theme

## 🔒 Security Recommendations

1. **Never commit .env file to version control**
2. Use strong passwords for database access
3. Keep Azure client secrets secure
4. Enable HTTPS on your domain
5. Regularly update dependencies
6. Monitor error logs for suspicious activity

## 📞 Support

If you encounter issues:
1. Check cPanel error logs
2. Review Node.js application logs
3. Verify all environment variables are set
4. Test database connectivity
5. Confirm Azure AD permissions

---

**✅ Your FMD Companies Sales CRM is ready for deployment!**

All features included:
- 🎨 FMD Companies branding
- 📧 Microsoft Outlook integration
- 🔔 Real-time email notifications
- 🏢 Company management
- 👥 Lead tracking with company assignment
- 📊 Dashboard and analytics
- 🔄 Email conversation threading
