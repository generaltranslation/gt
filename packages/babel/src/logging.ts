/* eslint-disable no-console */
import { LogLevel as LogLevelType } from './config';

export const LogLevel = {
  Silent: 'silent' as const,
  Error: 'error' as const,
  Warn: 'warn' as const,
  Info: 'info' as const,
  Debug: 'debug' as const,
} as const;

export type LogLevel = LogLevelType;

/**
 * Logger for the GT Babel plugin
 */
export class Logger {
  private logLevel: LogLevelType;
  private static readonly LOG_LEVELS: Record<LogLevelType, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
  };

  constructor(logLevel: LogLevelType) {
    this.logLevel = logLevel;
  }

  logError(message: string): void {
    if (this.shouldLog('error')) {
      console.error(`[gt-babel-plugin] ERROR: ${message}`);
    }
  }

  logWarning(message: string): void {
    if (this.shouldLog('warn')) {
      console.warn(`[gt-babel-plugin] WARN: ${message}`);
    }
  }

  logInfo(message: string): void {
    if (this.shouldLog('info')) {
      console.info(`[gt-babel-plugin] INFO: ${message}`);
    }
  }

  logDebug(message: string): void {
    if (this.shouldLog('debug')) {
      console.log(`[gt-babel-plugin] DEBUG: ${message}`);
    }
  }

  shouldLog(level: LogLevelType): boolean {
    // Silent mode blocks all logging, including silent itself
    if (this.logLevel === 'silent') {
      return false;
    }
    
    const currentLevel = Logger.LOG_LEVELS[this.logLevel];
    const messageLevel = Logger.LOG_LEVELS[level];
    return messageLevel <= currentLevel;
  }
}
