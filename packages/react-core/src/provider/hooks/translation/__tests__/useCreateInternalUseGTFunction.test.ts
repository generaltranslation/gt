import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GT } from 'generaltranslation';
import useCreateInternalUseGTFunction from '../useCreateInternalUseGTFunction';
import { Translations } from '../../../../types-dir/types';

// Mock the dependencies
vi.mock('generaltranslation/id', () => ({
  hashSource: vi.fn((params) => {
    // Generate different hashes based on source content
    const source = params.source || '';
    if (source.includes('Hello World')) return 'hash-hello-world';
    if (source.includes('Goodbye World')) return 'hash-goodbye-world';
    if (source.includes('Original message')) return 'hash-original';
    return `hash-${source.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
  }),
}));

vi.mock('../../../../errors-dir/createErrors', () => ({
  createStringRenderError: vi.fn((message, id) => `Render error: ${message} (ID: ${id})`),
  createStringRenderWarning: vi.fn((message, id) => `Render warning: ${message} (ID: ${id})`),
  createStringTranslationError: vi.fn((message, id, type) => `Translation error: ${message} (ID: ${id}, Type: ${type})`),
}));

vi.mock('../../../../messages/messages', () => ({
  decodeMsg: vi.fn((encoded) => encoded),
  decodeOptions: vi.fn((encoded) => {
    // Mock implementation for encoded messages
    if (encoded.includes('__GT__')) {
      return {
        $_hash: 'hash-original',
        $_source: 'Original message',
        $context: 'test-context',
        $id: 'test-id',
        name: 'World',
      };
    }
    return null;
  }),
}));

describe('useCreateInternalUseGTFunction', () => {
  let mockGT: GT;
  let mockRegisterIcuForTranslation: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  const defaultProps = {
    translations: {} as Translations,
    locale: 'es',
    defaultLocale: 'en',
    translationRequired: true,
    developmentApiEnabled: true,
    environment: 'development' as const,
  };

  beforeEach(() => {
    mockGT = {
      formatMessage: vi.fn((message, options) => {
        if (options?.variables?.name) {
          return message.replace('{name}', options.variables.name);
        }
        return message;
      }),
    } as any;

    mockRegisterIcuForTranslation = vi.fn().mockResolvedValue('Translated message');

    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('_gtFunction', () => {
    describe('general functionality', () => {
      it('should return empty string for invalid message input', () => {
        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
        });

        expect(_gtFunction('')).toBe('');
        expect(_gtFunction(null as any)).toBe('');
        expect(_gtFunction(undefined as any)).toBe('');
        expect(_gtFunction(123 as any)).toBe('');
      });

      it('should handle basic message without translation', () => {
        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translationRequired: false,
        });

        const result = _gtFunction('Hello World');
        expect(result).toBe('Hello World');
        expect(mockGT.formatMessage).toHaveBeenCalledWith('Hello World', {
          locales: ['en'],
          variables: {},
        });
      });

      it('should use provided translation when available', () => {
        const translations: Translations = {
          'hash-hello-world': 'Hola Mundo',
        };

        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translations,
        });

        const result = _gtFunction('Hello World');
        expect(result).toBe('Hola Mundo');
        expect(mockGT.formatMessage).toHaveBeenCalledWith('Hola Mundo', {
          locales: ['es', 'en'],
          variables: {},
        });
      });

      it('should handle null translation entry', () => {
        const translations: Translations = {
          'hash-hello-world': null,
        };

        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translations,
        });

        const result = _gtFunction('Hello World');
        expect(result).toBe('Hello World');
        expect(mockGT.formatMessage).toHaveBeenCalledWith('Hello World', {
          locales: ['en'],
          variables: {},
        });
      });
    });

    describe('interpolation', () => {
      it('should handle variable interpolation', () => {
        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translationRequired: false,
        });

        const result = _gtFunction('Hello {name}', { name: 'John' });
        expect(result).toBe('Hello John');
        expect(mockGT.formatMessage).toHaveBeenCalledWith('Hello {name}', {
          locales: ['en'],
          variables: { name: 'John' },
        });
      });

      it('should handle variable interpolation with translation', () => {
        const translations: Translations = {
          'hash-hello--name-': 'Hola {name}',
        };

        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translations,
        });

        const result = _gtFunction('Hello {name}', { name: 'John' });
        expect(result).toBe('Hola John');
        expect(mockGT.formatMessage).toHaveBeenCalledWith('Hola {name}', {
          locales: ['es', 'en'],
          variables: { name: 'John' },
        });
      });

      it('should handle complex variable interpolation', () => {
        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translationRequired: false,
        });

        const variables = {
          name: 'Alice',
          count: 5,
          type: 'messages',
        };

        const result = _gtFunction('Hello {name}, you have {count} {type}', variables);
        expect(mockGT.formatMessage).toHaveBeenCalledWith('Hello {name}, you have {count} {type}', {
          locales: ['en'],
          variables,
        });
      });
    });

    describe('no translation scenarios', () => {
      it('should return original message when translation not required', () => {
        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translationRequired: false,
        });

        const result = _gtFunction('Hello World');
        expect(result).toBe('Hello World');
        expect(mockRegisterIcuForTranslation).not.toHaveBeenCalled();
      });

      it('should use default locale when translation not available and development API disabled', () => {
        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          developmentApiEnabled: false,
          translations: {},
        });

        const result = _gtFunction('Hello World');
        expect(result).toBe('Hello World');
        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(mockRegisterIcuForTranslation).not.toHaveBeenCalled();
      });
    });

    describe('translation scenarios', () => {
      it('should register message for translation in development mode', () => {
        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translations: {},
        });

        const result = _gtFunction('Hello World');
        expect(result).toBe('Hello World');
        expect(mockRegisterIcuForTranslation).toHaveBeenCalledWith({
          source: 'Hello World',
          targetLocale: 'es',
          metadata: {
            hash: 'hash-hello-world',
          },
        });
      });

      it('should use preloaded translations when available', () => {
        const preloadedTranslations: Translations = {
          'hash-hello-world': 'Preloaded Translation',
        };

        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translations: {},
        });

        const result = _gtFunction('Hello World', {}, preloadedTranslations);
        expect(result).toBe('Preloaded Translation');
      });

      it('should handle translation with metadata (id and context)', () => {
        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translations: {},
        });

        const options = {
          $id: 'greeting',
          $context: 'homepage',
          name: 'World',
        };

        _gtFunction('Hello {name}', options);
        
        expect(mockRegisterIcuForTranslation).toHaveBeenCalledWith({
          source: 'Hello {name}',
          targetLocale: 'es',
          metadata: {
            id: 'greeting',
            context: 'homepage',
            hash: 'hash-hello--name-',
          },
        });
      });
    });

    describe('error handling', () => {
      it('should handle formatting errors in production', () => {
        const mockGTWithError = {
          formatMessage: vi.fn(() => {
            throw new Error('Formatting failed');
          }),
        } as any;

        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGTWithError,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          environment: 'production',
          translationRequired: false,
        });

        const result = _gtFunction('Hello World');
        expect(result).toBe('Hello World');
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should handle formatting errors with fallback', () => {
        const mockGTWithError = {
          formatMessage: vi.fn()
            .mockImplementationOnce(() => {
              throw new Error('Formatting failed');
            })
            .mockImplementationOnce(() => 'Fallback message'),
        } as any;

        const { _gtFunction } = useCreateInternalUseGTFunction({
          gt: mockGTWithError,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translations: {
            'hash-hello-world': 'Bad translation {invalid}',
          },
        });

        const result = _gtFunction('Hello World', {}, undefined);
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(result).toBe('Fallback message');
      });
    });
  });

  describe('_mFunction', () => {
    describe('general functionality', () => {
      it('should return original value for null/undefined input', () => {
        const { _mFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
        });

        expect(_mFunction(null)).toBe(null);
        expect(_mFunction(undefined)).toBe(undefined);
        expect(_mFunction('')).toBe('');
      });

      it('should handle regular messages like _gtFunction', () => {
        const { _mFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translationRequired: false,
        });

        const result = _mFunction('Hello World');
        expect(result).toBe('Hello World');
      });

      it('should handle encoded messages with decoded options', () => {
        const { _mFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translations: {
            'hash-original': 'Translated encoded message',
          },
        });

        const result = _mFunction('__GT__encoded_message__GT__');
        expect(result).toBe('Translated encoded message');
      });
    });

    describe('interpolation with encoded messages', () => {
      it('should handle variable interpolation in encoded messages', () => {
        const { _mFunction } = useCreateInternalUseGTFunction({
          gt: mockGT,
          registerIcuForTranslation: mockRegisterIcuForTranslation,
          ...defaultProps,
          translationRequired: false,
        });

        const result = _mFunction('__GT__Hello {name}__GT__');
        expect(result).toBe('Original message'); // Uses $_source from mocked decodeOptions
      });
    });
  });

  describe('_filterMessagesForPreload', () => {
    it('should filter messages that need translation', () => {
      const { _filterMessagesForPreload } = useCreateInternalUseGTFunction({
        gt: mockGT,
        registerIcuForTranslation: mockRegisterIcuForTranslation,
        ...defaultProps,
        translations: {
          'hash-hello-world': 'Existing translation',
        },
      });

      const messages = [
        { message: 'Hello World' },
        { message: 'Goodbye World' },
        { message: '', $id: 'empty' }, // Should be filtered out
      ];

      const result = _filterMessagesForPreload(messages);
      
      // Should only include messages that don't have translations
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        message: 'Goodbye World',
        $_hash: 'hash-goodbye-world',
      });
    });

    it('should handle messages with metadata', () => {
      const { _filterMessagesForPreload } = useCreateInternalUseGTFunction({
        gt: mockGT,
        registerIcuForTranslation: mockRegisterIcuForTranslation,
        ...defaultProps,
        translations: {},
      });

      const messages = [
        { 
          message: 'Hello World', 
          $id: 'greeting',
          $context: 'homepage',
        },
      ];

      const result = _filterMessagesForPreload(messages);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        message: 'Hello World',
        $id: 'greeting',
        $context: 'homepage',
        $_hash: 'hash-hello-world',
      });
    });
  });

  describe('_preloadMessages', () => {
    it('should preload translations for messages', async () => {
      const { _preloadMessages } = useCreateInternalUseGTFunction({
        gt: mockGT,
        registerIcuForTranslation: mockRegisterIcuForTranslation,
        ...defaultProps,
        translations: {},
      });

      const messages = [
        { message: 'Hello World' },
        { message: 'Goodbye World', $id: 'farewell' },
      ];

      const result = await _preloadMessages(messages);

      expect(mockRegisterIcuForTranslation).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        'hash-hello-world': 'Translated message',
        'hash-goodbye-world': 'Translated message',
      });
    });

    it('should handle existing translations in preload', async () => {
      const existingTranslations: Translations = {
        'hash-hello-world': 'Existing translation',
      };

      const { _preloadMessages } = useCreateInternalUseGTFunction({
        gt: mockGT,
        registerIcuForTranslation: mockRegisterIcuForTranslation,
        ...defaultProps,
        translations: existingTranslations,
      });

      const messages = [{ message: 'Hello World' }];
      const result = await _preloadMessages(messages);

      expect(result).toEqual({
        'hash-hello-world': 'Translated message',
      });
    });
  });

  describe('integration scenarios', () => {
    it('should work end-to-end with translation workflow', async () => {
      const translations: Translations = {};

      const hook = useCreateInternalUseGTFunction({
        gt: mockGT,
        registerIcuForTranslation: mockRegisterIcuForTranslation,
        ...defaultProps,
        translations,
      });

      // 1. Filter messages for preload
      const messages = [
        { message: 'Hello World', $id: 'greeting' },
        { message: 'Goodbye {name}', name: 'John' },
      ];

      const filtered = hook._filterMessagesForPreload(messages);
      expect(filtered).toHaveLength(2);

      // 2. Preload messages
      const preloaded = await hook._preloadMessages(filtered);
      expect(Object.keys(preloaded)).toHaveLength(2);

      // 3. Use translation function with preloaded data
      const result = hook._gtFunction('Hello World', { $id: 'greeting' }, preloaded);
      expect(result).toBe('Translated message');
    });
  });
});