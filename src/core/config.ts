/**
 * Configuration system for Hyperfy
 * Handles environment-based settings and removes hardcoded values
 */

export interface HyperfyConfig {
  assetsUrl: string;
  assetsDir: string | null;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  networkRate: number;
  maxDeltaTime: number;
  fixedDeltaTime: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  physics: {
    enabled: boolean;
    gravity: { x: number; y: number; z: number };
  };
}

class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: HyperfyConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  private loadConfiguration(): HyperfyConfig {
    const env = process.env.NODE_ENV || 'development';
    const isProduction = env === 'production';
    const isDevelopment = env === 'development';
    const isTest = env === 'test' || process.env.VITEST === 'true';

    return {
      // Asset configuration - no more hardcoded localhost!
      assetsUrl: process.env.HYPERFY_ASSETS_URL || 
                 (isProduction ? 'https://assets.hyperfy.io/' : 'https://test-assets.hyperfy.io/'),
      assetsDir: process.env.HYPERFY_ASSETS_DIR || (isTest ? './world/assets' : null),
      
      // Environment flags
      isProduction,
      isDevelopment,
      isTest,
      
      // Network configuration
      networkRate: parseFloat(process.env.HYPERFY_NETWORK_RATE || '8'),
      maxDeltaTime: parseFloat(process.env.HYPERFY_MAX_DELTA_TIME || String(1/30)),
      fixedDeltaTime: parseFloat(process.env.HYPERFY_FIXED_DELTA_TIME || String(1/60)),
      
      // Logging configuration
      logLevel: (process.env.HYPERFY_LOG_LEVEL || (isProduction ? 'warn' : 'info')) as any,
      
      // Physics configuration
      physics: {
        enabled: process.env.HYPERFY_PHYSICS_ENABLED !== 'false',
        gravity: {
          x: parseFloat(process.env.HYPERFY_GRAVITY_X || '0'),
          y: parseFloat(process.env.HYPERFY_GRAVITY_Y || '-9.81'),
          z: parseFloat(process.env.HYPERFY_GRAVITY_Z || '0')
        }
      }
    };
  }

  get(): HyperfyConfig {
    return this.config;
  }

  /**
   * Get a specific configuration value
   */
  getValue<K extends keyof HyperfyConfig>(key: K): HyperfyConfig[K] {
    return this.config[key];
  }

  /**
   * Update configuration (mainly for testing)
   */
  update(updates: Partial<HyperfyConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = this.loadConfiguration();
  }
}

// Export singleton instance
export const Config = ConfigurationManager.getInstance(); 