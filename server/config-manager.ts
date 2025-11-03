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
 */
export function initializeConfig() {
  runtimeConfig = {
    // Database
    DATABASE_URL: process.env.DATABASE_URL || '',
    
    // Azure/Microsoft Graph
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID || '',
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET || '',
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID || '',
    AZURE_REDIRECT_URI: process.env.AZURE_REDIRECT_URI || '',
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || '',
    
    // Groq AI
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    
    // SendGrid (optional)
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
    SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || '',
    
    // Server
    PORT: process.env.PORT || '5000',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
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
 * Save configuration to .env file
 */
export function saveConfigToFile(config: Record<string, string>) {
  try {
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
    
    // Update runtime config
    updateConfig(config);
    
    return true;
  } catch (error) {
    console.error('Error saving config to file:', error);
    return false;
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
