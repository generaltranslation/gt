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
import { endTerminalSession } from './terminalSession.js';

import type { Logger as PinoLogger } from 'pino';
import type { SpinnerResult, ProgressResult } from '@clack/prompts';

function wrapTerminalSessionAware<T extends SpinnerResult | ProgressResult>(
  target: T
): T {
  const start = target.start.bind(target);
  const stop = target.stop.bind(target);
  const message = target.message.bind(target);
  target.start = (msg?: string) => {
    endTerminalSession();
    return start(msg);
  };
  target.stop = (msg?: string, code?: number) => {
    endTerminalSession();
    return (stop as (m?: string, c?: number) => void)(msg, code);
  };
  target.message = (msg?: string) => {
    endTerminalSession();
    return message(msg);
  };
  if ('advance' in target) {
    const advance = target.advance.bind(target);
    target.advance = (amount: number, msg?: string) => {
      endTerminalSession();
      return advance(amount, msg);
    };
  }
  return target;
}

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

// Non-animated spinner for non-TTY (piped) stdout in 'default' format.
// @clack/prompts' spinner only suppresses its animation for isCI, not for
// general non-TTY output, so piping `gt <cmd>` dumps every animation frame plus
// cursor-control escapes ([?25l, [1G, [J) into the pipe. Emit a single plain
// start line and a single completion line instead, keeping the SpinnerResult API.
class PlainSpinner implements SpinnerResult {
  private currentMessage: string = '';
  isCancelled: boolean = false;

  start(message?: string): void {
    endTerminalSession();
    if (message) {
      this.currentMessage = message;
      process.stdout.write(`${message}\n`);
    }
  }

  stop(message?: string): void {
    endTerminalSession();
    const msg = message || this.currentMessage;
    if (msg) {
      process.stdout.write(`${msg}\n`);
    }
    this.currentMessage = '';
  }

  message(message?: string): void {
    // Update the tracked message without emitting a frame per update; a piped
    // stream should see only the start and completion lines.
    if (message) {
      this.currentMessage = message;
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

// Non-animated progress bar for non-TTY (piped) stdout in 'default' format.
// Like the animated spinner, @clack/prompts' progress bar streams a frame plus
// cursor-control escapes ([?25l, [1G, [J) on every advance, which corrupts a
// pipe (used by `gt translate`'s poll/download steps). Emit a single plain
// start line and a single completion line, advancing silently in between, while
// keeping the ProgressResult API. Mirrors PlainSpinner.
class PlainProgress implements ProgressResult {
  private currentMessage: string = '';
  isCancelled: boolean = false;

  start(message?: string): void {
    endTerminalSession();
    if (message) {
      this.currentMessage = message;
      process.stdout.write(`${message}\n`);
    }
  }

  stop(message?: string): void {
    endTerminalSession();
    const msg = message || this.currentMessage;
    if (msg) {
      process.stdout.write(`${msg}\n`);
    }
    this.currentMessage = '';
  }

  message(message?: string): void {
    // Track the latest message without emitting a frame per update; a piped
    // stream should see only the start and completion lines.
    if (message) {
      this.currentMessage = message;
    }
  }

  advance(_amount: number, message?: string): void {
    // Silent advance: no per-frame writes into the pipe. Track the message so
    // stop() can fall back to the most recent status if called without one.
    if (message) {
      this.currentMessage = message;
    }
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
      endTerminalSession();
      // @clack/prompts doesn't have trace, use message
      clackLog.message(message, { symbol: chalk.dim('•') });
    } else {
      this.pinoLogger?.trace(message);
    }
    this.fileLogger?.trace(message);
  }

  debug(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
      // @clack/prompts doesn't have debug, use message
      clackLog.message(message, { symbol: chalk.dim('◆') });
    } else {
      this.pinoLogger?.debug(message);
    }
    this.fileLogger?.debug(message);
  }

  info(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
      clackLog.info(message);
    } else {
      this.pinoLogger?.info(message);
    }
    this.fileLogger?.info(message);
  }

  warn(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
      clackLog.warn(message);
    } else {
      this.pinoLogger?.warn(message);
    }
    this.fileLogger?.warn(message);
  }

  error(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
      clackLog.error(message);
    } else {
      this.pinoLogger?.error(message);
    }
    this.fileLogger?.error(message);
  }

  fatal(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
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
      endTerminalSession();
      clackLog.success(message);
    } else {
      this.pinoLogger?.info(message); // Map to info for non-default formats
    }
    this.fileLogger?.info(message);
  }

  step(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
      clackLog.step(message);
    } else {
      this.pinoLogger?.info(message); // Map to info for non-default formats
    }
    this.fileLogger?.info(message);
  }

  message(message: string, symbol?: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
      clackLog.message(message, symbol ? { symbol } : undefined);
    } else {
      this.pinoLogger?.info(message); // Map to info for non-default formats
    }
    this.fileLogger?.info(message);
  }

  // Spinner functionality
  createSpinner(indicator: 'dots' | 'timer' = 'timer'): SpinnerResult {
    if (this.logFormat === 'default') {
      // Non-TTY (piped) output: skip the animated spinner, which would otherwise
      // stream animation frames and cursor escapes into the pipe.
      if (!process.stdout.isTTY) {
        return new PlainSpinner();
      }
      return wrapTerminalSessionAware(spinner({ indicator }));
    } else {
      return new MockSpinner(this);
    }
  }

  // Progress bar functionality
  createProgressBar(total: number): ProgressResult {
    if (this.logFormat === 'default') {
      // Non-TTY (piped) output: skip the animated progress bar, which would
      // otherwise stream a frame and cursor escapes into the pipe on every
      // advance (e.g. `gt translate`'s poll/download steps piped to a file).
      if (!process.stdout.isTTY) {
        return new PlainProgress();
      }
      return wrapTerminalSessionAware(progress({ max: total }));
    } else {
      return new MockProgress(total, this);
    }
  }

  // Command start/end markers
  startCommand(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
      intro(chalk.cyan(message));
    } else {
      this.info(`╭─ ${message}`);
    }
    this.fileLogger?.info(`[START] ${message}`);
  }

  endCommand(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
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
