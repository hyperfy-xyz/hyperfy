/**
 * Logging system for Hyperfy
 * Replaces console.log statements with configurable logging
 */

import { Config } from './config';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LoggerOptions {
  prefix?: string;
  logLevel?: keyof typeof LogLevel;
}

class Logger {
  private prefix: string;
  private logLevel: LogLevel;
  private static globalLogLevel: LogLevel | null = null;

  constructor(options: LoggerOptions = {}) {
    this.prefix = options.prefix || '';
    
    // Use global log level if set, otherwise use config
    if (Logger.globalLogLevel !== null) {
      this.logLevel = Logger.globalLogLevel;
    } else {
      const configLevel = options.logLevel || Config.getValue('logLevel').toUpperCase();
      this.logLevel = LogLevel[configLevel as keyof typeof LogLevel] || LogLevel.INFO;
    }
  }

  /**
   * Set global log level for all loggers
   */
  static setGlobalLogLevel(level: keyof typeof LogLevel): void {
    Logger.globalLogLevel = LogLevel[level];
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      logLevel: LogLevel[this.logLevel] as keyof typeof LogLevel
    });
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel && !Config.getValue('isProduction');
  }

  private formatMessage(message: string): string {
    return this.prefix ? `[${this.prefix}] ${message}` : message;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  /**
   * Log performance timing
   */
  time(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.time(this.formatMessage(label));
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(this.formatMessage(label));
    }
  }

  /**
   * Create a scoped timer
   */
  timer(label: string): () => void {
    const start = performance.now();
    return () => {
      if (this.shouldLog(LogLevel.DEBUG)) {
        const duration = performance.now() - start;
        this.debug(`${label} took ${duration.toFixed(2)}ms`);
      }
    };
  }
}

// Create default logger instance
export const logger = new Logger();

// Export factory function for creating named loggers
export function createLogger(prefix: string, options?: Omit<LoggerOptions, 'prefix'>): Logger {
  return new Logger({ ...options, prefix });
} 