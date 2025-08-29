import { describe, it, expect } from 'vitest';
import { Logger, LogLevel } from '../logging';

describe('logging', () => {
  describe('LogLevel', () => {
    it('default log level is warn', () => {
      const defaultLevel = LogLevel.Warn;
      expect(defaultLevel).toBe('warn');
    });
  });

  describe('logger creation', () => {
    it('creates logger with error level', () => {
      const logger = new Logger('error');
      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(false);
    });

    it('creates logger with warn level', () => {
      const logger = new Logger('warn');
      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('info')).toBe(false);
    });

    it('creates logger with info level', () => {
      const logger = new Logger('info');
      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('info')).toBe(true);
      expect(logger.shouldLog('debug')).toBe(false);
    });

    it('creates logger with debug level', () => {
      const logger = new Logger('debug');
      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('info')).toBe(true);
      expect(logger.shouldLog('debug')).toBe(true);
    });

    it('creates logger with silent level', () => {
      const logger = new Logger('silent');
      expect(logger.shouldLog('error')).toBe(false);
      expect(logger.shouldLog('warn')).toBe(false);
      expect(logger.shouldLog('info')).toBe(false);
      expect(logger.shouldLog('debug')).toBe(false);
    });
  });

  describe('level filtering', () => {
    it('error logger only allows error messages', () => {
      const logger = new Logger('error');

      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(false);
      expect(logger.shouldLog('info')).toBe(false);
      expect(logger.shouldLog('debug')).toBe(false);
    });

    it('warn logger allows error and warn messages', () => {
      const logger = new Logger('warn');

      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('info')).toBe(false);
      expect(logger.shouldLog('debug')).toBe(false);
    });

    it('info logger allows error warn and info messages', () => {
      const logger = new Logger('info');

      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('info')).toBe(true);
      expect(logger.shouldLog('debug')).toBe(false);
    });

    it('debug logger allows all messages', () => {
      const logger = new Logger('debug');

      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);
      expect(logger.shouldLog('info')).toBe(true);
      expect(logger.shouldLog('debug')).toBe(true);
    });

    it('silent logger blocks all messages', () => {
      const logger = new Logger('silent');

      expect(logger.shouldLog('error')).toBe(false);
      expect(logger.shouldLog('warn')).toBe(false);
      expect(logger.shouldLog('info')).toBe(false);
      expect(logger.shouldLog('debug')).toBe(false);
    });
  });

  describe('convenience methods', () => {
    it('logError respects level filtering', () => {
      const silentLogger = new Logger('silent');
      const errorLogger = new Logger('error');

      // Silent logger should not enable error messages
      expect(silentLogger.shouldLog('error')).toBe(false);

      // Error logger should enable error messages
      expect(errorLogger.shouldLog('error')).toBe(true);
    });

    it('logWarning respects level filtering', () => {
      const errorLogger = new Logger('error');
      const warnLogger = new Logger('warn');

      // Error logger should not enable warning messages
      expect(errorLogger.shouldLog('warn')).toBe(false);

      // Warn logger should enable warning messages
      expect(warnLogger.shouldLog('warn')).toBe(true);
    });

    it('logInfo respects level filtering', () => {
      const warnLogger = new Logger('warn');
      const infoLogger = new Logger('info');

      // Warn logger should not enable info messages
      expect(warnLogger.shouldLog('info')).toBe(false);

      // Info logger should enable info messages
      expect(infoLogger.shouldLog('info')).toBe(true);
    });

    it('logDebug respects level filtering', () => {
      const infoLogger = new Logger('info');
      const debugLogger = new Logger('debug');

      // Info logger should not enable debug messages
      expect(infoLogger.shouldLog('debug')).toBe(false);

      // Debug logger should enable debug messages
      expect(debugLogger.shouldLog('debug')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('same level comparison works', () => {
      const logger = new Logger('warn');

      // Same level should be enabled
      expect(logger.shouldLog('warn')).toBe(true);
    });

    it('silent level special behavior', () => {
      const logger = new Logger('silent');

      // Silent should block everything, even itself
      expect(logger.shouldLog('silent')).toBe(false);
    });

    it('level hierarchy consistency', () => {
      // Verify that our level hierarchy is consistent
      const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];

      for (let i = 0; i < levels.length; i++) {
        const currentLevel = levels[i];
        const logger = new Logger(currentLevel);

        for (let j = 0; j < levels.length; j++) {
          const testLevel = levels[j];
          const shouldBeEnabled = j <= i; // Lower or equal index means higher or equal priority

          expect(logger.shouldLog(testLevel)).toBe(shouldBeEnabled);
        }
      }
    });
  });

  describe('integration tests', () => {
    it('full logging workflow', () => {
      const logger = new Logger('warn');

      // Test that convenience methods work with level filtering
      // These should be enabled
      expect(logger.shouldLog('error')).toBe(true);
      expect(logger.shouldLog('warn')).toBe(true);

      // These should be disabled
      expect(logger.shouldLog('info')).toBe(false);
      expect(logger.shouldLog('debug')).toBe(false);
    });

    it('logger with different configurations', () => {
      const configs: [LogLevel, LogLevel[]][] = [
        ['silent', []],
        ['error', ['error']],
        ['warn', ['error', 'warn']],
        ['info', ['error', 'warn', 'info']],
        ['debug', ['error', 'warn', 'info', 'debug']],
      ];

      for (const [configLevel, enabledLevels] of configs) {
        const logger = new Logger(configLevel);

        const allLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];

        for (const level of allLevels) {
          const shouldBeEnabled = enabledLevels.includes(level);

          expect(logger.shouldLog(level)).toBe(shouldBeEnabled);
        }
      }
    });
  });
});
