// CommonJS bridge for cPanel/Passenger to load the ESM server build
// Loads environment variables and then dynamically imports the built entry

try {
  // Load .env if present
  require('dotenv/config');
} catch (_) {
  // ignore if dotenv not available in production env
}

// Default to production unless explicitly running in development
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

(async () => {
  const path = require('path');
  const entry = path.resolve(__dirname, 'dist', 'index.js');
  try {
    await import('file://' + entry);
  } catch (err) {
    console.error('Failed to start server from', entry);
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
