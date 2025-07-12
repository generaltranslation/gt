import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  ConsoleLogHandler,
  fetchLogger,
  defaultLogger,
  LogHandler,
  LogEntry,
} from '../../src/logging/logger';

describe('Logger', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    // Store original environment variable
    originalEnv = process.env._GT_LOG_LEVEL;
  });

  afterEach(() => {
    // Restore original environment variable
    if (originalEnv !== undefined) {
      process.env._GT_LOG_LEVEL = originalEnv;
    } else {
      delete process.env._GT_LOG_LEVEL;
    }
  });

  describe('Logger class', () => {
    it('should create logger with default configuration (warn level)', () => {
      // Ensure no environment variable is set
      delete process.env._GT_LOG_LEVEL;

      const logger = new Logger();
      const config = logger.getConfig();

      expect(config.level).toBe('warn');
      expect(config.includeTimestamp).toBe(true);
      expect(config.includeContext).toBe(true);
      expect(config.enableConsole).toBe(true);
    });

    it('should use environment variable for log level', () => {
      process.env._GT_LOG_LEVEL = 'debug';

      const logger = new Logger();
      const config = logger.getConfig();

      expect(config.level).toBe('debug');
    });

    it('should handle invalid environment variable gracefully', () => {
      process.env._GT_LOG_LEVEL = 'invalid-level';

      const logger = new Logger();
      const config = logger.getConfig();

      expect(config.level).toBe('warn'); // Should fallback to default
    });

    it('should handle case-insensitive environment variable', () => {
      process.env._GT_LOG_LEVEL = 'ERROR';

      const logger = new Logger();
      const config = logger.getConfig();

      expect(config.level).toBe('error');
    });

    it('should create logger with custom configuration', () => {
      const logger = new Logger({
        level: 'debug',
        includeTimestamp: false,
        prefix: 'TEST',
      });
      const config = logger.getConfig();

      expect(config.level).toBe('debug');
      expect(config.includeTimestamp).toBe(false);
      expect(config.prefix).toBe('TEST');
    });

    it('should respect log level filtering', () => {
      const entries: LogEntry[] = [];
      const testHandler: LogHandler = {
        handle: (entry: LogEntry) => entries.push(entry),
      };
      const logger = new Logger({
        level: 'warn',
        enableConsole: false,
        handlers: [testHandler],
      });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(entries).toHaveLength(2);
      expect(entries[0].level).toBe('warn');
      expect(entries[1].level).toBe('error');
    });

    it('should filter debug and info messages with default warn level', () => {
      delete process.env._GT_LOG_LEVEL;

      const entries: LogEntry[] = [];
      const testHandler: LogHandler = {
        handle: (entry: LogEntry) => entries.push(entry),
      };
      const logger = new Logger({
        enableConsole: false,
        handlers: [testHandler],
      });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(entries).toHaveLength(2);
      expect(entries[0].level).toBe('warn');
      expect(entries[1].level).toBe('error');
    });

    it('should include context and metadata in log entries', () => {
      const entries: LogEntry[] = [];
      const testHandler: LogHandler = {
        handle: (entry: LogEntry) => entries.push(entry),
      };
      const logger = new Logger({
        level: 'info', // Explicitly set to info to allow info messages
        enableConsole: false,
        handlers: [testHandler],
      });

      const metadata = { userId: '123', action: 'translate' };
      logger.info('Test message', 'test-context', metadata);

      expect(entries).toHaveLength(1);
      expect(entries[0].context).toBe('test-context');
      expect(entries[0].metadata).toEqual(metadata);
      expect(entries[0].message).toBe('Test message');
    });

    it('should create child logger with context', () => {
      const entries: LogEntry[] = [];
      const testHandler: LogHandler = {
        handle: (entry: LogEntry) => entries.push(entry),
      };
      const logger = new Logger({
        level: 'info', // Explicitly set to info to allow info messages
        enableConsole: false,
        handlers: [testHandler],
      });

      const childLogger = logger.child('child-context');
      childLogger.info('Child message');

      expect(entries).toHaveLength(1);
      expect(entries[0].context).toBe('child-context');
    });

    it('should handle nested child loggers', () => {
      const entries: LogEntry[] = [];
      const testHandler: LogHandler = {
        handle: (entry: LogEntry) => entries.push(entry),
      };
      const logger = new Logger({
        enableConsole: false,
        handlers: [testHandler],
      });

      const childLogger = logger.child('parent');
      const grandChildLogger = childLogger.child('child');
      grandChildLogger.warn('Nested message');

      expect(entries).toHaveLength(1);
      expect(entries[0].context).toBe('parent:child');
    });
  });

  describe('ConsoleLogHandler', () => {
    it('should call appropriate console method based on log level', () => {
      const consoleSpy = {
        debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
        info: vi.spyOn(console, 'info').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      };

      const config = {
        level: 'debug' as const,
        includeTimestamp: false,
        includeContext: false,
        enableConsole: true,
      };

      const handler = new ConsoleLogHandler(config);

      handler.handle({
        level: 'debug',
        message: 'Debug message',
        timestamp: new Date(),
      });
      handler.handle({
        level: 'info',
        message: 'Info message',
        timestamp: new Date(),
      });
      handler.handle({
        level: 'warn',
        message: 'Warning message',
        timestamp: new Date(),
      });
      handler.handle({
        level: 'error',
        message: 'Error message',
        timestamp: new Date(),
      });

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error message')
      );

      // Restore console methods
      Object.values(consoleSpy).forEach((spy) => spy.mockRestore());
    });
  });

  describe('environment variable configuration', () => {
    it('should respect _GT_LOG_LEVEL environment variable for all valid levels', () => {
      const levels: Array<'debug' | 'info' | 'warn' | 'error'> = [
        'debug',
        'info',
        'warn',
        'error',
      ];

      levels.forEach((level) => {
        process.env._GT_LOG_LEVEL = level;
        const logger = new Logger();
        expect(logger.getConfig().level).toBe(level);
      });
    });
  });

  describe('context-specific loggers', () => {
    it('should create translation logger with proper context', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Temporarily enable logging for this test by configuring the parent logger
      const originalConfig = defaultLogger.getConfig();
      defaultLogger.configure({ ...originalConfig, level: 'warn' });

      fetchLogger.warn('Translation failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[fetch]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Translation failed')
      );

      consoleSpy.mockRestore();
      // Restore original config
      defaultLogger.configure(originalConfig);
    });
  });

  describe('error handling', () => {
    it('should handle handler errors gracefully', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const faultyHandler: LogHandler = {
        handle: () => {
          throw new Error('Handler error');
        },
      };

      const logger = new Logger({
        level: 'info', // Explicitly set to info to allow info messages
        enableConsole: false,
        handlers: [faultyHandler],
      });

      // Should not throw
      expect(() => {
        logger.info('Test message');
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in log handler:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('configuration updates', () => {
    it('should update logger configuration', () => {
      const logger = new Logger({ level: 'info' });

      logger.configure({ level: 'debug', prefix: 'NEW' });
      const config = logger.getConfig();

      expect(config.level).toBe('debug');
      expect(config.prefix).toBe('NEW');
    });
  });

  describe('handler management', () => {
    it('should add and remove handlers', () => {
      const entries: LogEntry[] = [];
      const testHandler: LogHandler = {
        handle: (entry: LogEntry) => entries.push(entry),
      };
      const logger = new Logger({
        level: 'info', // Explicitly set to info to allow info messages
        enableConsole: false,
      });

      logger.addHandler(testHandler);
      logger.info('Test message');
      expect(entries).toHaveLength(1);

      logger.removeHandler(testHandler);
      logger.info('Another message');
      expect(entries).toHaveLength(1); // Should not increase
    });
  });
});
