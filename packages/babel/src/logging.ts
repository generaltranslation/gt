/* eslint-disable no-console */
import { LogLevel } from './config';

/**
 * Logger for the GT Babel plugin
 */
export class Logger {
  private logLevel: LogLevel;
  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
  };

  constructor(logLevel: LogLevel) {
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

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = Logger.LOG_LEVELS[this.logLevel];
    const messageLevel = Logger.LOG_LEVELS[level];
    return messageLevel <= currentLevel;
  }
}
