import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GT, translate } from '../../src/index';
import _translate from '../../src/translate/translate';
import {
  TranslationConfig,
  TranslationMetadata,
  JsxChildren,
  IcuMessage,
  TranslationError,
  TranslationResult,
} from '../../src/types';

// Mock the internal translate function
vi.mock('../../src/translate/translate', () => ({
  default: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Translation Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exported translate function', () => {
    const mockTranslationResult: TranslationResult = {
      translation: 'Hola mundo',
      reference: {
        id: 'test-id',
        key: 'test-key',
      },
    };

    it('should call _translate with correct parameters', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const source: JsxChildren | IcuMessage = 'Hello world';
      const targetLocale = 'es';
      const metadata: TranslationMetadata = { context: 'greeting' };
      const config: TranslationConfig = {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key',
      };

      const result = await translate(source, targetLocale, metadata, config);

      expect(mockTranslate).toHaveBeenCalledWith(
        source,
        targetLocale,
        metadata,
        config
      );
      expect(result).toEqual(mockTranslationResult);
    });

    it('should handle undefined metadata', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const source: JsxChildren | IcuMessage = 'Hello world';
      const targetLocale = 'es';
      const config: TranslationConfig = { baseUrl: 'https://api.test.com' };

      await translate(source, targetLocale, undefined, config);

      expect(mockTranslate).toHaveBeenCalledWith(
        source,
        targetLocale,
        {},
        config
      );
    });

    it('should handle JSX children as source', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const jsxSource = ['Hello ', { t: 'strong', c: ['world'] }];
      const targetLocale = 'es';

      await translate(jsxSource, targetLocale);

      expect(mockTranslate).toHaveBeenCalledWith(
        jsxSource,
        targetLocale,
        {},
        undefined
      );
    });

    it('should handle ICU message as source', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const icuSource = 'Hello {name}';
      const targetLocale = 'es';

      await translate(icuSource, targetLocale);

      expect(mockTranslate).toHaveBeenCalledWith(
        icuSource,
        targetLocale,
        {},
        undefined
      );
    });

    it('should handle translation errors', async () => {
      const mockTranslate = vi.mocked(_translate);
      const errorResult: TranslationError = {
        error: 'Translation failed',
        code: 500,
        reference: { id: 'error-id', key: 'error-key' },
      };
      mockTranslate.mockResolvedValue(errorResult);

      const result = await translate('Hello world', 'es');

      expect(result).toEqual(errorResult);
    });

    it('should propagate internal translate errors', async () => {
      const mockTranslate = vi.mocked(_translate);
      const error = new Error('Network error');
      mockTranslate.mockRejectedValue(error);

      await expect(translate('Hello world', 'es')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('GT class translate method', () => {
    let gt: GT;
    const mockTranslationResult: TranslationResult = {
      translation: 'Hola mundo',
      reference: {
        id: 'test-id',
        key: 'test-key',
      },
    };

    beforeEach(() => {
      gt = new GT({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
        targetLocale: 'es',
      });
    });

    it('should call _translate with merged configuration', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const source: JsxChildren | IcuMessage = 'Hello world';
      const metadata: TranslationMetadata = { context: 'greeting' };

      const result = await gt.translate(source, 'fr', metadata);

      expect(mockTranslate).toHaveBeenCalledWith(source, 'fr', metadata, {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-api-key',
        devApiKey: undefined,
      });
      expect(result).toEqual(mockTranslationResult);
    });

    it('should use instance targetLocale when not provided', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const source: JsxChildren | IcuMessage = 'Hello world';

      await gt.translate(source);

      expect(mockTranslate).toHaveBeenCalledWith(
        source,
        'es',
        {},
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          devApiKey: undefined,
        }
      );
    });

    it('should throw error when no target locale is provided', async () => {
      const gtNoTarget = new GT({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
      });

      await expect(gtNoTarget.translate('Hello world')).rejects.toThrow(
        'GT error: Cannot call `translate` without a specified locale. Either pass a locale to the `translate` function or specify a targetLocale in the GT constructor.'
      );
    });

    it('should handle empty metadata', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const source: JsxChildren | IcuMessage = 'Hello world';

      await gt.translate(source, 'fr');

      expect(mockTranslate).toHaveBeenCalledWith(
        source,
        'fr',
        {},
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          devApiKey: undefined,
        }
      );
    });

    it('should merge custom config with instance config', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const source: JsxChildren | IcuMessage = 'Hello world';
      const customConfig = { timeout: 5000 };

      await gt.translate(source, 'fr', {}, customConfig);

      expect(mockTranslate).toHaveBeenCalledWith(
        source,
        'fr',
        {},
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          devApiKey: undefined,
          timeout: 5000,
        }
      );
    });

    it('should handle devApiKey in configuration', async () => {
      const gtWithDevKey = new GT({
        apiKey: 'test-api-key',
        devApiKey: 'dev-key',
        baseUrl: 'https://api.test.com',
        targetLocale: 'es',
      });

      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      await gtWithDevKey.translate('Hello world');

      expect(mockTranslate).toHaveBeenCalledWith(
        'Hello world',
        'es',
        {},
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          devApiKey: 'dev-key',
        }
      );
    });

    it('should handle complex JSX source', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const complexJsxSource = [
        'Welcome ',
        {
          t: 'strong',
          c: ['John'],
        },
        ' to our ',
        {
          t: 'a',
          c: ['application'],
        },
      ];

      await gt.translate(complexJsxSource, 'es');

      expect(mockTranslate).toHaveBeenCalledWith(
        complexJsxSource,
        'es',
        {},
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          devApiKey: undefined,
        }
      );
    });

    it('should handle dataFormat in metadata', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      // Test ICU format
      await gt.translate('Hello {name}', 'es', {
        context: 'greeting',
        dataFormat: 'ICU',
      });

      expect(mockTranslate).toHaveBeenCalledWith(
        'Hello {name}',
        'es',
        { context: 'greeting', dataFormat: 'ICU' },
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          devApiKey: undefined,
        }
      );

      // Test JSX format
      const jsxSource = [{ t: 'span', c: ['Hello world'] }];
      await gt.translate(jsxSource, 'fr', {
        context: 'greeting',
        dataFormat: 'JSX',
      });

      expect(mockTranslate).toHaveBeenCalledWith(
        jsxSource,
        'fr',
        { context: 'greeting', dataFormat: 'JSX' },
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          devApiKey: undefined,
        }
      );
    });

    it('should handle translation metadata with all fields', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const fullMetadata: TranslationMetadata = {
        sourceLocale: 'en',
        versionId: 'v1.0',
        context: 'dashboard',
        id: 'welcome-msg',
        hash: 'abc123',
        actionType: 'fast',
        dataFormat: 'ICU',
      };

      await gt.translate('Hello world', 'es', fullMetadata);

      expect(mockTranslate).toHaveBeenCalledWith(
        'Hello world',
        'es',
        fullMetadata,
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          devApiKey: undefined,
        }
      );
    });

    it('should propagate errors from _translate', async () => {
      const mockTranslate = vi.mocked(_translate);
      const error = new Error('Translation service unavailable');
      mockTranslate.mockRejectedValue(error);

      await expect(gt.translate('Hello world')).rejects.toThrow(
        'Translation service unavailable'
      );
    });
  });

  describe('configuration handling', () => {
    it('should handle minimal GT configuration', () => {
      const gt = new GT({
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
      });

      expect(gt.apiKey).toBe('test-key');
      expect(gt.baseUrl).toBe('https://api.test.com');
    });

    it('should handle GT configuration with all options', () => {
      const gt = new GT({
        apiKey: 'test-key',
        devApiKey: 'dev-key',
        baseUrl: 'https://api.test.com',
        targetLocale: 'es',
      });

      expect(gt.apiKey).toBe('test-key');
      expect(gt.devApiKey).toBe('dev-key');
      expect(gt.baseUrl).toBe('https://api.test.com');
      expect(gt.targetLocale).toBe('es');
    });
  });
});
