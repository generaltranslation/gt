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
import type { Writable } from 'node:stream';

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
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ConsoleOutput = 'stdout' | 'stderr';

// Numeric ordering used to decide the quiet floor without lowering an
// already-more-restrictive level chosen via GT_LOG_LEVEL.
const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Under --quiet, informational output is suppressed but warnings and errors
// still print, so the console never drops below this level.
const QUIET_FLOOR_LEVEL: LogLevel = 'warn';

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
  private logLevel: LogLevel;
  private quiet = false;
  private consoleOutput: ConsoleOutput = 'stdout';
  // One JSON console logger per stream so switching direction within a
  // process reuses the existing SonicBoom instead of recreating it.
  private consoleLoggers: Partial<Record<ConsoleOutput, PinoLogger>> = {};
  // Clack writes to stdout unless told otherwise; unset keeps its default so
  // ordinary commands are untouched while stderr routing redirects it.
  private clackOutput: { output: Writable } | undefined;

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
    this.logLevel = logLevel as LogLevel;

    // Console output (stdout) - only for JSON format
    // For 'default' format, we use @clack/prompts directly
    if (format === 'json') {
      this.pinoLogger = this.createPinoLogger(process.stdout.fd, logLevel);
      this.consoleLoggers.stdout = this.pinoLogger;
    }

    // File output (if specified) - always JSON format
    if (logFile) {
      this.fileLogger = this.createPinoLogger(logFile, logLevel);
    }
  }

  private createPinoLogger(dest: number | string, level: string): PinoLogger {
    return pino(
      {
        level,
        mixin: () => ({
          logId: randomUUID(),
        }),
      },
      destination(dest)
    );
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Route console output (Clack chatter and the JSON console logger) to
   * stdout (the historical default) or stderr, so a command whose stdout is
   * machine-readable can keep diagnostics off it. Reversible per invocation;
   * a no-op when the direction is unchanged. The JSON logger keeps its
   * current level and is flushed before switching. File logging is unaffected.
   */
  setConsoleOutput(output: ConsoleOutput): void {
    if (output === this.consoleOutput) return;
    this.consoleOutput = output;
    this.clackOutput =
      output === 'stderr' ? { output: process.stderr } : undefined;
    if (this.pinoLogger) {
      this.pinoLogger.flush();
      const next =
        this.consoleLoggers[output] ??
        this.createPinoLogger(process[output].fd, this.pinoLogger.level);
      next.level = this.pinoLogger.level;
      this.consoleLoggers[output] = next;
      this.pinoLogger = next;
    }
  }

  /**
   * Enable or disable quiet mode. When quiet, informational chatter
   * (info/step/success/message/debug/trace, spinners, progress bars, and
   * command intro/outro markers) is suppressed on the console, while warnings
   * and errors still print. Quiet wins over GT_LOG_LEVEL but never lowers an
   * already-more-restrictive level. File logging is unaffected so an explicit
   * GT_LOG_FILE still captures everything.
   */
  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
    if (this.pinoLogger) {
      this.pinoLogger.level = quiet
        ? LOG_LEVEL_RANK[this.logLevel] > LOG_LEVEL_RANK[QUIET_FLOOR_LEVEL]
          ? this.logLevel
          : QUIET_FLOOR_LEVEL
        : this.logLevel;
    }
  }

  isQuiet(): boolean {
    return this.quiet;
  }

  // Standard logging methods
  trace(message: string): void {
    if (!this.quiet) {
      if (this.logFormat === 'default') {
        endTerminalSession();
        // @clack/prompts doesn't have trace, use message
        clackLog.message(message, {
          symbol: chalk.dim('•'),
          ...this.clackOutput,
        });
      } else {
        this.pinoLogger?.trace(message);
      }
    }
    this.fileLogger?.trace(message);
  }

  debug(message: string): void {
    if (!this.quiet) {
      if (this.logFormat === 'default') {
        endTerminalSession();
        // @clack/prompts doesn't have debug, use message
        clackLog.message(message, {
          symbol: chalk.dim('◆'),
          ...this.clackOutput,
        });
      } else {
        this.pinoLogger?.debug(message);
      }
    }
    this.fileLogger?.debug(message);
  }

  info(message: string): void {
    if (!this.quiet) {
      if (this.logFormat === 'default') {
        endTerminalSession();
        clackLog.info(message, this.clackOutput);
      } else {
        this.pinoLogger?.info(message);
      }
    }
    this.fileLogger?.info(message);
  }

  warn(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
      clackLog.warn(message, this.clackOutput);
    } else {
      this.pinoLogger?.warn(message);
    }
    this.fileLogger?.warn(message);
  }

  error(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
      clackLog.error(message, this.clackOutput);
    } else {
      this.pinoLogger?.error(message);
    }
    this.fileLogger?.error(message);
  }

  fatal(message: string): void {
    if (this.logFormat === 'default') {
      endTerminalSession();
      // @clack/prompts doesn't have fatal, use error
      clackLog.error(message, this.clackOutput);
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
    if (!this.quiet) {
      if (this.logFormat === 'default') {
        endTerminalSession();
        clackLog.success(message, this.clackOutput);
      } else {
        this.pinoLogger?.info(message); // Map to info for non-default formats
      }
    }
    this.fileLogger?.info(message);
  }

  step(message: string): void {
    if (!this.quiet) {
      if (this.logFormat === 'default') {
        endTerminalSession();
        clackLog.step(message, this.clackOutput);
      } else {
        this.pinoLogger?.info(message); // Map to info for non-default formats
      }
    }
    this.fileLogger?.info(message);
  }

  message(message: string, symbol?: string): void {
    if (!this.quiet) {
      if (this.logFormat === 'default') {
        endTerminalSession();
        clackLog.message(
          message,
          symbol ? { symbol, ...this.clackOutput } : this.clackOutput
        );
      } else {
        this.pinoLogger?.info(message); // Map to info for non-default formats
      }
    }
    this.fileLogger?.info(message);
  }

  // Spinner functionality
  createSpinner(indicator: 'dots' | 'timer' = 'timer'): SpinnerResult {
    // Quiet mode suppresses spinner UI; the mock routes through the gated
    // info() so nothing reaches the console while file logging is preserved.
    if (this.quiet) {
      return new MockSpinner(this);
    }
    if (this.logFormat === 'default') {
      return wrapTerminalSessionAware(
        spinner({ indicator, ...this.clackOutput })
      );
    } else {
      return new MockSpinner(this);
    }
  }

  // Progress bar functionality
  createProgressBar(total: number): ProgressResult {
    if (this.quiet) {
      return new MockProgress(total, this);
    }
    if (this.logFormat === 'default') {
      return wrapTerminalSessionAware(
        progress({ max: total, ...this.clackOutput })
      );
    } else {
      return new MockProgress(total, this);
    }
  }

  // Command start/end markers
  startCommand(message: string): void {
    if (!this.quiet) {
      if (this.logFormat === 'default') {
        endTerminalSession();
        intro(chalk.cyan(message), this.clackOutput);
      } else {
        this.info(`╭─ ${message}`);
      }
    }
    this.fileLogger?.info(`[START] ${message}`);
  }

  endCommand(message: string): void {
    if (!this.quiet) {
      if (this.logFormat === 'default') {
        endTerminalSession();
        outro(chalk.cyan(message), this.clackOutput);
      } else {
        this.info(`╰─ ${message}`);
      }
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
