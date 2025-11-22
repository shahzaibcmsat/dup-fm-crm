# FMD Lead Management System

A comprehensive CRM application for managing sales leads with real-time email integration, persistent notifications, and company organization features.

## Features

- 📊 **Lead Management**: Track and manage sales leads with different statuses
- ✉️ **Email Integration**: Send and receive emails with Gmail API integration
- 🔔 **Real-time Notifications**: Persistent notification bell with unread email counts that survive page refreshes
- 📥 **Import Leads**: Import from Excel/CSV files
- 🏢 **Company Management**: Organize leads by company with filtering capabilities
- 📈 **Dashboard**: View statistics and recent leads
- 🔍 **Search & Filter**: Easily find and filter leads by name, email, status, or company
- 💾 **Database**: PostgreSQL with Drizzle ORM
- 🤖 **AI-Powered**: Grammar checking and auto-reply generation with Groq AI

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS + Shadcn UI components
- TanStack Query for data fetching
- Wouter for routing

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL (Supabase/Neon compatible)
- Drizzle ORM

## Setup

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (Supabase, Neon, or local)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd SalesEmail-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Copy `.env.example` to `.env` and update with your credentials:
   ```bash
   cp .env.example .env
   ```
   
   Update at minimum:
   ```env
   DATABASE_URL=postgresql://user:password@host:port/database
   GMAIL_CLIENT_ID=your-client-id
   GMAIL_CLIENT_SECRET=your-client-secret
   GMAIL_REFRESH_TOKEN=your-refresh-token
   EMAIL_FROM_ADDRESS=your-email@gmail.com
   ```

4. **Push database schema**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5000`

## Configuration

### Database
Set your PostgreSQL connection string in `.env`:
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

### Email Integration

This system uses **Gmail API** for email functionality.

Configure Gmail OAuth credentials in `.env`:
```env
GMAIL_CLIENT_ID=your-google-oauth-client-id
GMAIL_CLIENT_SECRET=your-google-oauth-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
EMAIL_FROM_ADDRESS=your-email@gmail.com
```

**Features:**
- ✅ Full email threading with Gmail threads
- ✅ Automatic email reply detection
- ✅ Two-way email sync (send & receive)
- ✅ Conversation tracking
- ✅ Background email checking every 30 seconds
- ✅ Native Gmail integration

**Setup:**
1. Create a project in Google Cloud Console
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Authorize your Gmail account to get refresh token
5. Configure the credentials in `.env`

See `GMAIL_SETUP.md` for detailed setup instructions.

#### Email Notifications
The system automatically displays notifications in the header bell icon when leads reply to emails. The system polls for new emails every 30 seconds.

Notifications persist across page refreshes and are cleared when you open the lead's details.

### AI Features (Optional)

Configure Groq AI for grammar checking and auto-reply generation:
```env
GROQ_API_KEY=gsk_your_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Get your free API key from: https://console.groq.com/keys

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:push` - Push database schema changes
- `npm run check` - Type check

## Database Schema

### Leads Table
- `id` - UUID primary key
- `clientName` - Client name
- `email` - Email address
- `leadDetails` - Additional details
- `status` - Lead status (New, Contacted, Qualified, etc.)
- `companyId` - Optional company reference
- `createdAt` - Creation timestamp
- `updatedAt` - Update timestamp

### Emails Table
- `id` - UUID primary key
- `leadId` - Reference to lead
- `subject` - Email subject
- `body` - Email body
- `direction` - 'sent' or 'received'
- `messageId` - Gmail message ID for tracking
- `conversationId` - Gmail thread ID for grouping emails
- `sentAt` - Timestamp

### Companies Table
- `id` - UUID primary key
- `name` - Company name
- `createdAt` - Creation timestamp

## API Endpoints

### Leads
- `GET /api/leads` - Get all leads
- `GET /api/leads/:id` - Get specific lead
- `POST /api/leads` - Create new lead
- `PATCH /api/leads/:id/status` - Update lead status
- `POST /api/leads/:id/send-email` - Send email to lead

### Emails
- `GET /api/emails/:leadId` - Get emails for a lead
- `POST /api/emails/sync` - Manually trigger email sync
- `GET /api/notifications/emails` - Get new email notifications

### Import
- `POST /api/import/file` - Upload Excel/CSV

### Companies
- `GET /api/companies` - Get all companies
- `POST /api/companies` - Create new company

## Development

The application uses a single server that serves both the API and the frontend:
- API endpoints: `http://localhost:5000/api/*`
- Frontend: `http://localhost:5000`

In development mode, Vite's dev server is integrated with the Express backend for hot module replacement.

## Production Build

```bash
npm run build
npm start
```

The build creates optimized static files and a Node.js server bundle.

## License

MIT
