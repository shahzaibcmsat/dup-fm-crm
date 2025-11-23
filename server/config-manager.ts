import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Store runtime configuration
let runtimeConfig: Record<string, string> = {};

// Path to .env file
const ENV_FILE_PATH = path.join(__dirname, '..', '.env');

/**
 * Initialize runtime config from environment variables
 * Works in both development (.env file) and production (hosting platform env vars)
 */
export function initializeConfig() {
  runtimeConfig = {
    // Database
    DATABASE_URL: process.env.DATABASE_URL || '',
    
    // Gmail API (replaces Azure/Microsoft Graph)
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID || '',
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET || '',
    GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN || '',
    GMAIL_REDIRECT_URI: process.env.GMAIL_REDIRECT_URI || '',
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || '',
    
    // Groq AI
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    
    // Server
    PORT: process.env.PORT || '5000',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
  
  console.log('✅ Configuration system initialized');
}

/**
 * Get a configuration value
 */
export function getConfig(key: string): string {
  return runtimeConfig[key] || process.env[key] || '';
}

/**
 * Get all configuration (with sensitive data masked)
 */
export function getAllConfig(includeSensitive: boolean = false) {
  const config: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(runtimeConfig)) {
    if (includeSensitive) {
      config[key] = value;
    } else {
      // Mask sensitive fields
      if (key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD') || key.includes('URL')) {
        config[key] = value ? maskValue(value) : '';
      } else {
        config[key] = value;
      }
    }
  }
  
  return config;
}

/**
 * Update configuration values
 */
export function updateConfig(updates: Record<string, string>) {
  // Update runtime config
  for (const [key, value] of Object.entries(updates)) {
    if (key in runtimeConfig) {
      runtimeConfig[key] = value;
      // Also update process.env for immediate effect
      process.env[key] = value;
    }
  }
}

/**
 * Save configuration to .env file (development) or runtime (production)
 */
export function saveConfigToFile(config: Record<string, string>) {
  try {
    // IMPORTANT: In production (Node.js hosting), we can only update runtime memory
    // The actual environment variables must be set in the hosting platform dashboard
    // This function updates both runtime config and .env file (if it exists in development)
    
    // Always update runtime config and process.env for immediate effect
    updateConfig(config);
    
    // Only try to write to .env file if we're in development and file exists/is writable
    const isProduction = process.env.NODE_ENV === 'production';
    const canWriteEnvFile = !isProduction && fs.existsSync(path.dirname(ENV_FILE_PATH));
    
    if (canWriteEnvFile) {
      console.log('📝 Updating .env file (development mode)');
      
      // Read existing .env file
      let envContent = '';
      if (fs.existsSync(ENV_FILE_PATH)) {
        envContent = fs.readFileSync(ENV_FILE_PATH, 'utf-8');
      }
      
      // Parse existing content into lines
      const lines = envContent.split('\n');
      const updatedLines: string[] = [];
      const updatedKeys = new Set<string>();
      
      // Update existing keys or keep comments/empty lines
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Keep comments and empty lines
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
          updatedLines.push(line);
          continue;
        }
        
        // Parse key=value
        const equalIndex = line.indexOf('=');
        if (equalIndex > 0) {
          const key = line.substring(0, equalIndex).trim();
          
          if (key in config) {
            updatedLines.push(`${key}=${config[key]}`);
            updatedKeys.add(key);
          } else {
            updatedLines.push(line);
          }
        } else {
          updatedLines.push(line);
        }
      }
      
      // Add new keys that weren't in the original file
      for (const [key, value] of Object.entries(config)) {
        if (!updatedKeys.has(key)) {
          updatedLines.push(`${key}=${value}`);
        }
      }
      
      // Write back to file
      fs.writeFileSync(ENV_FILE_PATH, updatedLines.join('\n'), 'utf-8');
      console.log('✅ .env file updated successfully');
    } else {
      console.log('⚠️ Running in production mode - runtime config updated only');
      console.log('💡 To persist changes, update environment variables in your hosting platform dashboard');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error saving config:', error);
    // Don't fail if .env file can't be written (production scenario)
    // Runtime config is still updated
    return true; // Return true because runtime config was updated
  }
}

/**
 * Mask sensitive values for display
 */
function maskValue(value: string): string {
  if (!value || value.length < 8) {
    return '****';
  }
  return `${value.substring(0, 4)}${'*'.repeat(value.length - 8)}${value.substring(value.length - 4)}`;
}

/**
 * Validate configuration
 */
export function validateConfig(config: Record<string, string>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate DATABASE_URL format
  if (config.DATABASE_URL && !config.DATABASE_URL.startsWith('postgres://') && !config.DATABASE_URL.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }
  
  // Validate email format
  if (config.EMAIL_FROM_ADDRESS && !isValidEmail(config.EMAIL_FROM_ADDRESS)) {
    errors.push('EMAIL_FROM_ADDRESS must be a valid email address');
  }
  
  // Validate PORT is a number
  if (config.PORT && isNaN(parseInt(config.PORT))) {
    errors.push('PORT must be a number');
  }
  
  // Validate GROQ_API_KEY format
  if (config.GROQ_API_KEY && !config.GROQ_API_KEY.startsWith('gsk_')) {
    errors.push('GROQ_API_KEY should start with "gsk_"');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Initialize config on module load
initializeConfig();
