import chalk from 'chalk';
import { randomUUID } from 'node:crypto';
import { pino, destination } from 'pino';
import {
  log as clackLog,
  spinner,
  progress,
  intro,
  outro,
} from '@clack/prompts';

import type { Logger as PinoLogger } from 'pino';
import type { SpinnerResult, ProgressResult } from '@clack/prompts';

export type LogFormat = 'default' | 'json';

// Mock spinner that logs to console instead of updating terminal UI
class MockSpinner implements SpinnerResult {
  private currentMessage: string = '';
  private logger: Logger;
  isCancelled: boolean = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  start(message?: string): void {
    if (message) {
      this.currentMessage = message;
      this.logger.info(`[Spinner] ${message}`);
    }
  }

  stop(message?: string): void {
    const msg = message || this.currentMessage;
    if (msg) {
      this.logger.info(`[Spinner] ${msg}`);
    }
    this.currentMessage = '';
  }

  message(message?: string): void {
    if (message) {
      this.currentMessage = message;
      this.logger.info(`[Spinner] ${message}`);
    }
  }
}

// Mock progress bar that logs to console instead of updating terminal UI
class MockProgress implements ProgressResult {
  private max: number;
  private current: number = 0;
  private logger: Logger;
  isCancelled: boolean = false;

  constructor(max: number, logger: Logger) {
    this.max = max;
    this.logger = logger;
  }

  start(message?: string): void {
    const msg = message || 'Starting progress';
    this.logger.info(`[Progress] ${msg} (0/${this.max})`);
  }

  stop(message?: string): void {
    const msg = message || 'Complete';
    this.logger.info(`[Progress] ${msg} (${this.current}/${this.max})`);
  }

  message(message?: string): void {
    if (message) {
      this.logger.info(`[Progress] ${message} (${this.current}/${this.max})`);
    }
  }

  advance(amount: number, message?: string): void {
    this.current += amount;
    const msg = message || 'Progress';
    this.logger.info(`[Progress] ${msg} (${this.current}/${this.max})`);
  }
}

/**
 * GT_LOG_FORMAT: default | json.
 * - If default, logs will be pretty-printed using @clack/prompts.
 * - If json, logs will be written in JSON format to the console.
 * GT_LOG_FILE: If specified, logs will be written to the file.
 * GT_LOG_LEVEL: The level of logs to write. If not specified, defaults to 'info'.
 * - Valid levels: debug, info, warn, error.
 */
class Logger {
  private static instance: Logger;
  private pinoLogger: PinoLogger | null = null;
  private fileLogger: PinoLogger | null = null;
  private logFormat: LogFormat;

  private constructor() {
    // Read configuration from environment variables
    const format = (
      process.env.GT_LOG_FORMAT || 'default'
    ).toLowerCase() as LogFormat;
    const logFile = process.env.GT_LOG_FILE;
    const logLevel = process.env.GT_LOG_LEVEL || 'info';

    if (format !== 'default' && format !== 'json') {
      console.error('Invalid log format');
      process.exit(1);
    }
    if (
      logLevel !== 'debug' &&
      logLevel !== 'info' &&
      logLevel !== 'warn' &&
      logLevel !== 'error'
    ) {
      console.error('Invalid log level');
      process.exit(1);
    }

    this.logFormat = format;

    // Console output (stdout) - only for JSON format
    // For 'default' format, we use @clack/prompts directly
    if (format === 'json') {
      this.pinoLogger = pino(
        {
          level: logLevel,
          mixin: () => ({
            logId: randomUUID(),
          }),
        },
        destination(1)
      );
    }

    // File output (if specified) - always JSON format
    if (logFile) {
      this.fileLogger = pino(
        {
          level: logLevel,
          mixin: () => ({
            logId: randomUUID(),
          }),
        },
        destination(logFile)
      );
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // Standard logging methods
  trace(message: string): void {
    if (this.logFormat === 'default') {
      // @clack/prompts doesn't have trace, use message
      clackLog.message(message, { symbol: chalk.dim('•') });
    } else {
      this.pinoLogger?.trace(message);
    }
    this.fileLogger?.trace(message);
  }

  debug(message: string): void {
    if (this.logFormat === 'default') {
      // @clack/prompts doesn't have debug, use message
      clackLog.message(message, { symbol: chalk.dim('◆') });
    } else {
      this.pinoLogger?.debug(message);
    }
    this.fileLogger?.debug(message);
  }

  info(message: string): void {
    if (this.logFormat === 'default') {
      clackLog.info(message);
    } else {
      this.pinoLogger?.info(message);
    }
    this.fileLogger?.info(message);
  }

  warn(message: string): void {
    if (this.logFormat === 'default') {
      clackLog.warn(message);
    } else {
      this.pinoLogger?.warn(message);
    }
    this.fileLogger?.warn(message);
  }

  error(message: string): void {
    if (this.logFormat === 'default') {
      clackLog.error(message);
    } else {
      this.pinoLogger?.error(message);
    }
    this.fileLogger?.error(message);
  }

  fatal(message: string): void {
    if (this.logFormat === 'default') {
      clackLog.error(message); // @clack/prompts doesn't have fatal, use error
    } else {
      this.pinoLogger?.fatal(message);
    }
    this.fileLogger?.fatal(message);
  }

  silent(message: string): void {
    // Silent doesn't log to console, only to file
    this.fileLogger?.silent(message);
  }

  // @clack/prompts specific methods (for 'default' format)
  success(message: string): void {
    if (this.logFormat === 'default') {
      clackLog.success(message);
    } else {
      this.pinoLogger?.info(message); // Map to info for non-default formats
    }
    this.fileLogger?.info(message);
  }

  step(message: string): void {
    if (this.logFormat === 'default') {
      clackLog.step(message);
    } else {
      this.pinoLogger?.info(message); // Map to info for non-default formats
    }
    this.fileLogger?.info(message);
  }

  message(message: string, symbol?: string): void {
    if (this.logFormat === 'default') {
      clackLog.message(message, symbol ? { symbol } : undefined);
    } else {
      this.pinoLogger?.info(message); // Map to info for non-default formats
    }
    this.fileLogger?.info(message);
  }

  // Spinner functionality
  createSpinner(indicator: 'dots' | 'timer' = 'timer'): SpinnerResult {
    if (this.logFormat === 'default') {
      return spinner({ indicator });
    } else {
      return new MockSpinner(this);
    }
  }

  // Progress bar functionality
  createProgressBar(total: number): ProgressResult {
    if (this.logFormat === 'default') {
      return progress({ max: total });
    } else {
      return new MockProgress(total, this);
    }
  }

  // Command start/end markers
  startCommand(message: string): void {
    if (this.logFormat === 'default') {
      intro(chalk.cyan(message));
    } else {
      this.info(`╭─ ${message}`);
    }
    this.fileLogger?.info(`[START] ${message}`);
  }

  endCommand(message: string): void {
    if (this.logFormat === 'default') {
      outro(chalk.cyan(message));
    } else {
      this.info(`╰─ ${message}`);
    }
    this.fileLogger?.info(`[END] ${message}`);
  }

  // Flush logs to ensure they're written before process exit
  flush(): void {
    this.pinoLogger?.flush();
    this.fileLogger?.flush();
  }
}

export const logger = Logger.getInstance();
