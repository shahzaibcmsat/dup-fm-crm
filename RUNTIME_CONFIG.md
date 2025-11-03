# Runtime Configuration Management

## Overview
This application now supports runtime configuration management, allowing you to update environment variables through the Settings UI without manually editing the `.env` file or restarting the server.

## Features

### ✅ What's Implemented

1. **Dynamic Configuration System** (`server/config-manager.ts`)
   - Runtime loading of environment variables
   - Validation of required fields
   - Automatic masking of sensitive values (API keys, secrets, passwords)
   - Persistence to `.env` file
   - In-memory cache for performance

2. **Settings UI** (`client/src/pages/settings.tsx`)
   - Full configuration form with categorized sections:
     - 📊 Database Configuration
     - 📧 Microsoft Outlook/Azure Configuration
     - 🤖 Groq AI Configuration
     - 📨 SendGrid Configuration (Optional)
     - ⚙️ Server Configuration
   - Password-style inputs with show/hide toggle for sensitive values
   - Real-time validation feedback
   - Connection status indicators
   - Save button with loading states

3. **API Endpoints** (`server/routes.ts`)
   - `GET /api/config` - Retrieve current configuration (with masked secrets)
   - `POST /api/config` - Update configuration (validates and persists to .env)

4. **Groq AI Integration** (`server/groq.ts`)
   - Updated to use config manager instead of direct `process.env` access
   - Dynamically loads API key and model selection

## Configuration Fields

### Database
- `DATABASE_URL` - PostgreSQL connection string (masked)

### Microsoft Azure / Outlook
- `AZURE_CLIENT_ID` - Azure AD application client ID (masked)
- `AZURE_CLIENT_SECRET` - Azure AD application secret (masked)
- `AZURE_TENANT_ID` - Azure tenant ID or "common"
- `AZURE_REDIRECT_URI` - OAuth callback URL
- `EMAIL_FROM_ADDRESS` - Sender email address

### Groq AI
- `GROQ_API_KEY` - Groq API key for grammar checking (masked)
- `GROQ_MODEL` - AI model name (e.g., llama-3.3-70b-versatile)

### SendGrid (Optional)
- `SENDGRID_API_KEY` - SendGrid API key (masked)
- `SENDGRID_FROM_EMAIL` - SendGrid sender email

### Server
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)

## How It Works

1. **Server Startup**
   ```typescript
   // server/index.ts initializes config on startup
   await initializeConfig();
   ```

2. **Reading Config**
   ```typescript
   import { getConfig } from './config-manager';
   const apiKey = getConfig('GROQ_API_KEY');
   ```

3. **Updating Config via UI**
   - User modifies values in Settings page
   - Click "Save Changes" button
   - Client sends POST to `/api/config` with updated values
   - Server validates all required fields
   - Updates are persisted to `.env` file
   - In-memory cache is updated
   - `process.env` is updated for immediate use

4. **Security Features**
   - All sensitive fields are masked with `••••••••` in the UI
   - Eye icon toggle reveals actual values
   - API responses mask sensitive values
   - Full values are only sent when updating config

## Usage Example

### From Settings UI
1. Navigate to Settings page
2. Find the configuration section you want to update
3. Click the eye icon to reveal current values
4. Update the values as needed
5. Click "Save Changes"
6. Changes take effect immediately (some may require server restart)

### Programmatically
```typescript
import { getConfig, updateConfig } from './server/config-manager';

// Get a single value
const apiKey = getConfig('GROQ_API_KEY');

// Update multiple values
await updateConfig({
  GROQ_API_KEY: 'new_key_value',
  GROQ_MODEL: 'llama-3.3-70b-versatile'
});
```

## Important Notes

⚠️ **Server Restart Requirements**
Some configuration changes may require a server restart to take full effect:
- Database connection URL changes
- Server port changes
- Node environment changes

✅ **No Restart Required**
These changes take effect immediately:
- API keys (Groq, Azure, SendGrid)
- Email addresses
- AI model selection

## File Structure

```
server/
├── config-manager.ts     # Core configuration management system
├── routes.ts             # Includes /api/config endpoints
├── groq.ts              # Uses config manager for API key
└── index.ts             # Initializes config on startup

client/src/
└── pages/
    └── settings.tsx      # Configuration UI
```

## Validation

The config manager validates:
- Required fields are not empty
- DATABASE_URL starts with `postgresql://`
- Email addresses contain `@` symbol
- API keys have minimum length requirements

## Masking Rules

Values are automatically masked if the key contains:
- `SECRET`
- `PASSWORD`
- `API_KEY`
- `TOKEN`
- Or matches `DATABASE_URL`

## Benefits

1. **No Manual File Editing** - Update configs through intuitive UI
2. **Validation** - Prevents invalid configurations
3. **Security** - Sensitive values are masked by default
4. **Persistence** - Changes are saved to `.env` file
5. **Runtime Updates** - Most changes don't require restart
6. **Easy API Switching** - Quickly switch between different service providers
7. **Connection Status** - Visual indicators show if services are configured

## Future Enhancements

Potential improvements:
- [ ] Environment-specific configs (dev/staging/prod)
- [ ] Config version history/rollback
- [ ] Test connection buttons for each service
- [ ] Import/export config functionality
- [ ] Encrypted config storage
- [ ] Multi-user config management with permissions
