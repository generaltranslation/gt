import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  Logger,
  ConsoleLogHandler,
  fetchLogger,
  defaultLogger,
  type LogEntry,
  type LoggerConfig,
} from '../logger';

// A logger that records entries instead of writing to the console.
function recordingLogger(config: Partial<LoggerConfig> = {}) {
  const entries: LogEntry[] = [];
  const handler = { handle: (entry: LogEntry) => void entries.push(entry) };
  const logger = new Logger({
    level: 'info',
    enableConsole: false,
    handlers: [handler],
    ...config,
  });
  return { entries, handler, logger };
}

describe('Logger', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('configuration', () => {
    it('defaults to the warn level with timestamps, context and console output', () => {
      vi.stubEnv('_GT_LOG_LEVEL', undefined);

      expect(new Logger().getConfig()).toMatchObject({
        level: 'warn',
        includeTimestamp: true,
        includeContext: true,
        enableConsole: true,
      });
    });

    it.each([
      ['debug', 'debug'],
      ['info', 'info'],
      ['ERROR', 'error'],
      ['invalid-level', 'warn'],
    ])('reads _GT_LOG_LEVEL=%s as level %s', (value, level) => {
      vi.stubEnv('_GT_LOG_LEVEL', value);

      expect(new Logger().getConfig().level).toBe(level);
    });

    it('accepts custom configuration and later updates', () => {
      const logger = new Logger({
        level: 'debug',
        includeTimestamp: false,
        prefix: 'TEST',
      });
      expect(logger.getConfig()).toMatchObject({
        level: 'debug',
        includeTimestamp: false,
        prefix: 'TEST',
      });

      logger.configure({ level: 'info', prefix: 'NEW' });
      expect(logger.getConfig()).toMatchObject({
        level: 'info',
        includeTimestamp: false,
        prefix: 'NEW',
      });
    });
  });

  describe('entries', () => {
    it('drops entries below the configured level', () => {
      const { entries, logger } = recordingLogger({ level: 'warn' });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(entries.map((entry) => entry.level)).toEqual(['warn', 'error']);
    });

    it('records the message, context and metadata', () => {
      const { entries, logger } = recordingLogger();
      const metadata = { userId: '123', action: 'translate' };

      logger.info('Test message', 'test-context', metadata);

      expect(entries).toEqual([
        expect.objectContaining({
          message: 'Test message',
          context: 'test-context',
          metadata,
        }),
      ]);
    });

    it('joins nested child logger contexts', () => {
      const { entries, logger } = recordingLogger();

      logger.child('parent').info('Parent message');
      logger.child('parent').child('child').warn('Nested message');

      expect(entries.map((entry) => entry.context)).toEqual([
        'parent',
        'parent:child',
      ]);
    });

    it('adds and removes handlers', () => {
      const { entries, handler, logger } = recordingLogger({ handlers: [] });

      logger.addHandler(handler);
      logger.info('Test message');
      logger.removeHandler(handler);
      logger.info('Another message');

      expect(entries.map((entry) => entry.message)).toEqual(['Test message']);
    });

    it('reports a throwing handler without breaking the caller', () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logger = new Logger({
        level: 'info',
        enableConsole: false,
        handlers: [
          {
            handle: () => {
              throw new Error('Handler error');
            },
          },
        ],
      });

      expect(() => logger.info('Test message')).not.toThrow();
      expect(consoleError).toHaveBeenCalledWith(
        'Error in log handler:',
        expect.any(Error)
      );
    });
  });

  describe('console output', () => {
    it.each(['debug', 'info', 'warn', 'error'] as const)(
      'writes %s entries to the matching console method',
      (level) => {
        const consoleMethod = vi
          .spyOn(console, level)
          .mockImplementation(() => {});
        const handler = new ConsoleLogHandler({
          level: 'debug',
          includeTimestamp: false,
          includeContext: false,
          enableConsole: true,
        });

        handler.handle({ level, message: 'A message', timestamp: new Date() });

        expect(consoleMethod).toHaveBeenCalledWith(
          expect.stringContaining('A message')
        );
      }
    );

    it('tags the fetch logger output with its context', () => {
      const consoleWarn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const originalConfig = defaultLogger.getConfig();
      defaultLogger.configure({ ...originalConfig, level: 'warn' });

      fetchLogger.warn('Translation failed');
      defaultLogger.configure(originalConfig);

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringMatching(/\[fetch\].*Translation failed/)
      );
    });
  });
});
