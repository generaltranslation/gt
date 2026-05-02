/**
 * Comprehensive logging system for the General Translation library.
 * Provides structured logging with multiple levels and configurable output.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  /** Minimum log level to output. */
  level: LogLevel;
  /** Whether to include timestamps in log output. */
  includeTimestamp: boolean;
  /** Whether to include context information. */
  includeContext: boolean;
  /** Custom prefix for all log messages. */
  prefix?: string;
  /** Whether to output to console. Defaults to true. */
  enableConsole: boolean;
  /** Custom log handlers. */
  handlers?: LogHandler[];
}

export interface LogHandler {
  handle(entry: LogEntry): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  off: 4,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  off: '', // No color needed because 'off' level logs are never displayed.
};

const RESET_COLOR = '\x1b[0m';

/**
 * Gets the configured log level from the environment variable, or defaults to 'warn'.
 */
function getConfiguredLogLevel(): LogLevel {
  if (typeof process !== 'undefined' && process.env?._GT_LOG_LEVEL) {
    const envLevel = process.env._GT_LOG_LEVEL.toLowerCase();
    if (envLevel in LOG_LEVELS) {
      return envLevel as LogLevel;
    }
  }
  return 'warn';
}

/**
 * Console log handler that outputs formatted messages to the console.
 */
export class ConsoleLogHandler implements LogHandler {
  private config: LoggerConfig;

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  handle(entry: LogEntry): void {
    const parts: string[] = [];

    // Add a timestamp if enabled.
    if (this.config.includeTimestamp) {
      parts.push(`[${entry.timestamp.toISOString()}]`);
    }

    // Add the level with color.
    const colorCode = LOG_COLORS[entry.level];
    const levelText = `[${entry.level.toUpperCase()}]`;
    parts.push(`${colorCode}${levelText}${RESET_COLOR}`);

    // Add a prefix if configured.
    if (this.config.prefix) {
      parts.push(`[${this.config.prefix}]`);
    }

    // Add context if available and enabled.
    if (this.config.includeContext && entry.context) {
      parts.push(`[${entry.context}]`);
    }

    parts.push(entry.message);

    // Format metadata if available.
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      parts.push(`\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`);
    }

    const formattedMessage = parts.join(' ');

    // Output to the appropriate console method based on level.
    switch (entry.level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }
  }
}

/**
 * Main Logger class providing structured logging capabilities.
 */
export class Logger {
  private config: LoggerConfig;
  private handlers: LogHandler[];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: getConfiguredLogLevel(),
      includeTimestamp: true,
      includeContext: true,
      enableConsole: true,
      handlers: [],
      ...config,
    };

    this.handlers = [...(this.config.handlers || [])];

    // Add a console handler if enabled.
    if (this.config.enableConsole) {
      this.handlers.push(new ConsoleLogHandler(this.config));
    }
  }

  /**
   * Adds a custom log handler.
   */
  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Removes a log handler.
   */
  removeHandler(handler: LogHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Updates logger configuration.
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Checks whether a log level should be output based on current configuration.
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  /**
   * Creates log entries and passes them to handlers.
   */
  private log(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      metadata,
    };

    // Pass entries to all handlers.
    this.handlers.forEach((handler) => {
      try {
        handler.handle(entry);
      } catch (error) {
        // Prevent logging errors from breaking application code.
        console.error('Error in log handler:', error);
      }
    });
  }

  /**
   * Logs a debug message.
   * Used for detailed diagnostic information, typically only when diagnosing problems.
   */
  debug(
    message: string,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    this.log('debug', message, context, metadata);
  }

  /**
   * Logs an info message.
   * Used for general information about application operation.
   */
  info(
    message: string,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    this.log('info', message, context, metadata);
  }

  /**
   * Logs a warning message.
   * Used for potentially problematic situations that do not prevent operation.
   */
  warn(
    message: string,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    this.log('warn', message, context, metadata);
  }

  /**
   * Logs an error message.
   * Used for error events that might still allow the application to continue.
   */
  error(
    message: string,
    context?: string,
    metadata?: Record<string, any>
  ): void {
    this.log('error', message, context, metadata);
  }

  /**
   * Creates a child logger with a specific context.
   */
  child(context: string): ContextLogger {
    return new ContextLogger(this, context);
  }

  /**
   * Gets current logger configuration.
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

/**
 * Context logger that automatically includes context information.
 */
export class ContextLogger {
  private logger: Logger;
  private context: string;

  constructor(logger: Logger, context: string) {
    this.logger = logger;
    this.context = context;
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.logger.debug(message, this.context, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.logger.info(message, this.context, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.logger.warn(message, this.context, metadata);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.logger.error(message, this.context, metadata);
  }

  child(childContext: string): ContextLogger {
    return new ContextLogger(this.logger, `${this.context}:${childContext}`);
  }
}

// Default logger instance.
export const defaultLogger = new Logger({
  level: getConfiguredLogLevel(),
  includeTimestamp: true,
  includeContext: true,
  prefix: 'GT',
});

// Convenience functions using the default logger.
export const debug = (
  message: string,
  context?: string,
  metadata?: Record<string, any>
) => defaultLogger.debug(message, context, metadata);

export const info = (
  message: string,
  context?: string,
  metadata?: Record<string, any>
) => defaultLogger.info(message, context, metadata);

export const warn = (
  message: string,
  context?: string,
  metadata?: Record<string, any>
) => defaultLogger.warn(message, context, metadata);

export const error = (
  message: string,
  context?: string,
  metadata?: Record<string, any>
) => defaultLogger.error(message, context, metadata);

// Context-specific loggers for different parts of the system.
export const fetchLogger = defaultLogger.child('fetch');
export const validationLogger = defaultLogger.child('validation');
export const formattingLogger = defaultLogger.child('formatting');
export const localeLogger = defaultLogger.child('locale');
export const gtInstanceLogger = defaultLogger.child('GT instance');

export { Logger as GTLogger };
