import { describe, it, expect, vi, beforeEach } from 'vitest';
import _translate from '../../src/translate/translate';
import _translateMany from '../../src/translate/translateMany';
import fetchWithTimeout from '../../src/utils/fetchWithTimeout';
import {
  TranslationRequestConfig,
  TranslationResult,
  TranslationError,
  TranslateManyResult,
  Content,
  JsxChildren,
  IcuMessage,
} from '../../src/types';
import { GTRequestMetadata, GTRequest } from '../../src/types/GTRequest';

// Mock the fetch utilities and validators
vi.mock('../../src/utils/fetchWithTimeout', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/translate/utils/validateConfig', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/translate/utils/validateResponse', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/translate/utils/handleFetchError', () => ({
  default: vi.fn((error: unknown) => {
    throw error;
  }),
}));

describe('Internal Translation Functions', () => {
  const mockFetch = vi.mocked(fetchWithTimeout);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('_translate function', () => {
    const mockConfig: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
      timeout: 5000,
    };

    const mockTranslationResult: TranslationResult = {
      translation: 'Hola mundo',
      reference: {
        id: 'test-id',
        key: 'test-key',
      },
    };

    it('should make correct API call with string source', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([mockTranslationResult]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const source: Content = 'Hello world';
      const targetLocale = 'es';
      const metadata: GTRequestMetadata = { context: 'greeting' };

      const result = await _translate(
        source,
        targetLocale,
        metadata,
        mockConfig
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/translate/test-project',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-api-key': 'test-key',
          },
          body: JSON.stringify({
            requests: [{ source }],
            targetLocale,
            metadata,
          }),
        },
        5000
      );

      expect(result).toEqual(mockTranslationResult);
    });

    it('should make correct API call with JSX source', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([mockTranslationResult]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const jsxSource: JsxChildren = ['Hello ', { t: 'strong', c: ['world'] }];
      const targetLocale = 'es';
      const metadata: GTRequestMetadata = {
        context: 'greeting',
        dataFormat: 'JSX',
      };

      const result = await _translate(
        jsxSource,
        targetLocale,
        metadata,
        mockConfig
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/translate/test-project',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-api-key': 'test-key',
          },
          body: JSON.stringify({
            requests: [{ source: jsxSource }],
            targetLocale,
            metadata,
          }),
        },
        5000
      );

      expect(result).toEqual(mockTranslationResult);
    });

    it('should make correct API call with ICU source', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([mockTranslationResult]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const icuSource: IcuMessage = 'Hello {name}';
      const targetLocale = 'es';
      const metadata: GTRequestMetadata = {
        context: 'greeting',
        dataFormat: 'ICU',
      };

      const result = await _translate(
        icuSource,
        targetLocale,
        metadata,
        mockConfig
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/translate/test-project',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-api-key': 'test-key',
          },
          body: JSON.stringify({
            requests: [{ source: icuSource }],
            targetLocale,
            metadata,
          }),
        },
        5000
      );

      expect(result).toEqual(mockTranslationResult);
    });

    it('should use default runtime API URL when baseUrl is not provided', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([mockTranslationResult]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const configWithoutBaseUrl: TranslationRequestConfig = {
        projectId: 'test-project',
        apiKey: 'test-key',
      };

      await _translate('Hello world', 'es', {}, configWithoutBaseUrl);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/translate/test-project'),
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should handle timeout configuration', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([mockTranslationResult]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const configWithTimeout: TranslationRequestConfig = {
        projectId: 'test-project',
        apiKey: 'test-key',
        timeout: 10000,
      };

      await _translate('Hello world', 'es', {}, configWithTimeout);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        10000
      );
    });

    it('should handle metadata with all fields', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([mockTranslationResult]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const fullMetadata: GTRequestMetadata = {
        sourceLocale: 'en',
        context: 'dashboard',
        id: 'welcome-msg',
        hash: 'abc123',
        actionType: 'fast',
        dataFormat: 'ICU',
        timeout: 5000,
      };

      await _translate('Hello world', 'es', fullMetadata, mockConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            requests: [{ source: 'Hello world' }],
            targetLocale: 'es',
            metadata: fullMetadata,
          }),
        }),
        expect.any(Number)
      );
    });

    it('should return TranslationError when API returns error result', async () => {
      const errorResult: TranslationError = {
        error: 'Translation failed',
        code: 400,
        reference: { id: 'error-id', key: 'error-key' },
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([errorResult]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const result = await _translate('Hello world', 'es', {}, mockConfig);

      expect(result).toEqual(errorResult);
    });

    it('should handle empty metadata', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([mockTranslationResult]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      await _translate('Hello world', 'es', {}, mockConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            requests: [{ source: 'Hello world' }],
            targetLocale: 'es',
            metadata: {},
          }),
        }),
        expect.any(Number)
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      await expect(
        _translate('Hello world', 'es', {}, mockConfig)
      ).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValue(timeoutError);

      await expect(
        _translate('Hello world', 'es', {}, mockConfig)
      ).rejects.toThrow();
    });
  });

  describe('_translateMany function', () => {
    const mockConfig: TranslationRequestConfig = {
      projectId: 'test-project',
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
      timeout: 5000,
    };

    const mockTranslateManyResult: TranslateManyResult = {
      translations: [
        {
          translation: 'Hola mundo',
          reference: {
            id: 'test-id-1',
            key: 'test-key-1',
          },
        },
        {
          translation: 'Adiós mundo',
          reference: {
            id: 'test-id-2',
            key: 'test-key-2',
          },
        },
      ],
      reference: [
        {
          id: 'test-id-1',
          key: 'test-key-1',
        },
        {
          id: 'test-id-2',
          key: 'test-key-2',
        },
      ],
    };

    it('should make correct API call with multiple requests', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockTranslateManyResult),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const requests: GTRequest[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting' },
        },
        {
          source: 'Goodbye world',
          targetLocale: 'es',
          requestMetadata: { context: 'farewell' },
        },
      ];

      const globalMetadata: { targetLocale: string } & GTRequestMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
      };

      const result = await _translateMany(requests, globalMetadata, mockConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/translate/test-project',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-api-key': 'test-key',
          },
          body: JSON.stringify({
            requests,
            targetLocale: 'es',
            metadata: globalMetadata,
          }),
        },
        5000
      );

      expect(result).toEqual(mockTranslateManyResult);
    });

    it('should handle JSX and ICU mixed requests', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockTranslateManyResult),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const requests: GTRequest[] = [
        {
          source: ['Hello ', { t: 'strong', c: ['world'] }],
          targetLocale: 'es',
          requestMetadata: { context: 'greeting', dataFormat: 'JSX' },
        },
        {
          source: 'Hello {name}',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting', dataFormat: 'ICU' },
        },
      ];

      const globalMetadata: { targetLocale: string } & GTRequestMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
      };

      const result = await _translateMany(requests, globalMetadata, mockConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/translate/test-project',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-api-key': 'test-key',
          },
          body: JSON.stringify({
            requests,
            targetLocale: 'es',
            metadata: globalMetadata,
          }),
        },
        5000
      );

      expect(result).toEqual(mockTranslateManyResult);
    });

    it('should use default runtime API URL when baseUrl is not provided', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockTranslateManyResult),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const configWithoutBaseUrl: TranslationRequestConfig = {
        projectId: 'test-project',
        apiKey: 'test-key',
      };

      const requests: GTRequest[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting' },
        },
      ];

      await _translateMany(
        requests,
        { targetLocale: 'es' },
        configWithoutBaseUrl
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/translate/test-project'),
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should handle timeout configuration', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockTranslateManyResult),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const configWithTimeout: TranslationRequestConfig = {
        projectId: 'test-project',
        apiKey: 'test-key',
        timeout: 10000,
      };

      const requests: GTRequest[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting' },
        },
      ];

      await _translateMany(requests, { targetLocale: 'es' }, configWithTimeout);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        10000
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      const requests: GTRequest[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting' },
        },
      ];

      await expect(
        _translateMany(requests, { targetLocale: 'es' }, mockConfig)
      ).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValue(timeoutError);

      const requests: GTRequest[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting' },
        },
      ];

      await expect(
        _translateMany(requests, { targetLocale: 'es' }, mockConfig)
      ).rejects.toThrow();
    });

    it('should handle empty requests array', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ translations: [], reference: [] }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      mockFetch.mockResolvedValue(mockResponse);

      const requests: GTRequest[] = [];

      const result = await _translateMany(
        requests,
        { targetLocale: 'es' },
        mockConfig
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            requests: [],
            targetLocale: 'es',
            metadata: { targetLocale: 'es' },
          }),
        }),
        expect.any(Number)
      );

      expect(result).toEqual({ translations: [], reference: [] });
    });
  });
});
