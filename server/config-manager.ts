// Store runtime configuration
let runtimeConfig: Record<string, string> = {};

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
      // Skip masked values - don't overwrite with masked data
      if (value && value.includes('*')) {
        console.log(`⏭️  Skipping masked value for ${key}`);
        continue;
      }
      runtimeConfig[key] = value;
      // Also update process.env for immediate effect
      process.env[key] = value;
    }
  }
}

/**
 * Save configuration to runtime only (no file writing)
 * PRODUCTION-SAFE: Only updates process.env in memory
 * Note: Changes will be lost on server restart - use hosting platform env vars for persistence
 */
export function saveConfigToFile(config: Record<string, string>) {
  try {
    // Update runtime config and process.env for immediate effect
    updateConfig(config);
    
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      console.log('⚠️ Production mode: Configuration updated in memory only');
      console.log('💡 To persist changes, update environment variables in your hosting platform dashboard');
    } else {
      console.log('ℹ️ Development mode: Configuration updated in memory');
      console.log('💡 To persist changes across restarts, update your .env file manually');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error updating runtime config:', error);
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
  
  // Helper function to check if a value is masked (contains asterisks)
  const isMaskedValue = (value: string) => value && value.includes('*');
  
  // Validate DATABASE_URL format (skip if masked)
  if (config.DATABASE_URL && !isMaskedValue(config.DATABASE_URL)) {
    if (!config.DATABASE_URL.startsWith('postgres://') && !config.DATABASE_URL.startsWith('postgresql://')) {
      errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
    }
  }
  
  // Validate email format (skip if masked)
  if (config.EMAIL_FROM_ADDRESS && !isMaskedValue(config.EMAIL_FROM_ADDRESS)) {
    if (!isValidEmail(config.EMAIL_FROM_ADDRESS)) {
      errors.push('EMAIL_FROM_ADDRESS must be a valid email address');
    }
  }
  
  // Validate PORT is a number
  if (config.PORT && isNaN(parseInt(config.PORT))) {
    errors.push('PORT must be a number');
  }
  
  // Validate GROQ_API_KEY format (skip if masked)
  if (config.GROQ_API_KEY && !isMaskedValue(config.GROQ_API_KEY)) {
    if (!config.GROQ_API_KEY.startsWith('gsk_')) {
      errors.push('GROQ_API_KEY should start with "gsk_"');
    }
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
