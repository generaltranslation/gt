import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GT } from '../src/index';
import _translate from '../src/translate/translate';
import _translateMany from '../src/translate/translateMany';
import {
  TranslationResult,
  TranslateManyResult,
  Content,
  JsxChildren,
} from '../src/types';
import { GTRequestMetadata, GTRequest } from '../src/types/GTRequest';

// Mock the internal translate functions
vi.mock('../../src/translate/translate', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/translate/translateMany', () => ({
  default: vi.fn(),
}));

describe('GT Translation Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('_translate method', () => {
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
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
        targetLocale: 'es',
      });
    });

    it('should call _translate with merged configuration', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const source: Content = 'Hello world';
      const metadata = {
        context: 'greeting',
      };

      const result = await gt._translate(source, 'fr', metadata);

      expect(mockTranslate).toHaveBeenCalledWith(source, 'fr', metadata, {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-api-key',
        projectId: 'test-project',
      });
      expect(result).toEqual(mockTranslationResult);
    });

    it('should throw error when no target locale is provided', async () => {
      const gtNoTarget = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
      });

      await expect(gtNoTarget._translate('Hello world', '')).rejects.toThrow(
        'GT error: Cannot call `translate` without a specified locale. Either pass a locale to the `translate` function or specify a targetLocale in the GT constructor.'
      );
    });

    it('should throw error when no project ID is provided', async () => {
      const gtNoProject = new GT({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
      });

      await expect(gtNoProject._translate('Hello world', 'es')).rejects.toThrow(
        'GT error: Cannot call `translate` without a specified project ID. Either pass a project ID to the `translate` function or specify a projectId in the GT constructor.'
      );
    });

    it('should handle empty metadata', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const source: Content = 'Hello world';

      await gt._translate(source, 'fr');

      expect(mockTranslate).toHaveBeenCalledWith(source, 'fr', undefined, {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-api-key',
        projectId: 'test-project',
      });
    });

    it('should handle complex JSX source', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const complexJsxSource: JsxChildren = [
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

      await gt._translate(complexJsxSource, 'es');

      expect(mockTranslate).toHaveBeenCalledWith(
        complexJsxSource,
        'es',
        undefined,
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        }
      );
    });

    it('should handle dataFormat in metadata', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      // Test ICU format
      await gt._translate('Hello {name}', 'es', {
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
          projectId: 'test-project',
        }
      );

      // Test JSX format
      const jsxSource: JsxChildren = [{ t: 'span', c: ['Hello world'] }];
      await gt._translate(jsxSource, 'fr', {
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
          projectId: 'test-project',
        }
      );
    });

    it('should handle translation metadata with all fields', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const fullMetadata = {
        sourceLocale: 'en',
        context: 'dashboard',
        id: 'welcome-msg',
        hash: 'abc123',
        actionType: 'fast' as const,
        dataFormat: 'ICU' as const,
        timeout: 5000,
      };

      await gt._translate('Hello world', 'es', fullMetadata);

      expect(mockTranslate).toHaveBeenCalledWith(
        'Hello world',
        'es',
        fullMetadata,
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        }
      );
    });

    it('should propagate errors from _translate', async () => {
      const mockTranslate = vi.mocked(_translate);
      const error = new Error('Translation service unavailable');
      mockTranslate.mockRejectedValue(error);

      await expect(gt._translate('Hello world', 'es')).rejects.toThrow(
        'Translation service unavailable'
      );
    });
  });

  describe('translateMany method', () => {
    let gt: GT;
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

    beforeEach(() => {
      gt = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
        targetLocale: 'es',
      });
    });

    it('should call _translateMany with correct parameters', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue(mockTranslateManyResult);

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

      const result = await gt.translateMany(requests, globalMetadata);

      expect(mockTranslateMany).toHaveBeenCalledWith(requests, globalMetadata, {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-api-key',
        projectId: 'test-project',
      });
      expect(result).toEqual(mockTranslateManyResult);
    });

    it('should use instance targetLocale when not provided in global metadata', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue(mockTranslateManyResult);

      const requests: GTRequest[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting' },
        },
      ];

      const result = await gt.translateMany(requests);

      expect(mockTranslateMany).toHaveBeenCalledWith(
        requests,
        { targetLocale: 'es' },
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        }
      );
      expect(result).toEqual(mockTranslateManyResult);
    });

    it('should throw error when no target locale is provided', async () => {
      const gtNoTarget = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
      });

      const requests: GTRequest[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting' },
        },
      ];

      await expect(gtNoTarget.translateMany(requests)).rejects.toThrow(
        'GT error: Cannot call `translateMany` without a specified locale. Either pass a locale to the `translateMany` function or specify a targetLocale in the GT constructor.'
      );
    });

    it('should throw error when no project ID is provided', async () => {
      const gtNoProject = new GT({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
      });

      const requests: GTRequest[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting' },
        },
      ];

      await expect(
        gtNoProject.translateMany(requests, { targetLocale: 'es' })
      ).rejects.toThrow(
        'GT error: Cannot call `translateMany` without a specified project ID. Either pass a project ID to the `translateMany` function or specify a projectId in the GT constructor.'
      );
    });

    it('should handle complex JSX sources', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue(mockTranslateManyResult);

      const requests: GTRequest[] = [
        {
          source: [
            'Welcome ',
            {
              t: 'strong',
              c: ['John'],
            },
          ],
          targetLocale: 'es',
          requestMetadata: { context: 'greeting', dataFormat: 'JSX' },
        },
        {
          source: 'Hello {name}',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting', dataFormat: 'ICU' },
        },
      ];

      await gt.translateMany(requests, { targetLocale: 'es' });

      expect(mockTranslateMany).toHaveBeenCalledWith(
        requests,
        { targetLocale: 'es' },
        {
          baseUrl: 'https://api.test.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
        }
      );
    });

    it('should propagate errors from _translateMany', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      const error = new Error('Translation service unavailable');
      mockTranslateMany.mockRejectedValue(error);

      const requests: GTRequest[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          requestMetadata: { context: 'greeting' },
        },
      ];

      await expect(
        gt.translateMany(requests, { targetLocale: 'es' })
      ).rejects.toThrow('Translation service unavailable');
    });
  });

  describe('configuration handling', () => {
    it('should handle minimal GT configuration', () => {
      const gt = new GT({
        apiKey: 'test-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
      });

      expect(gt.apiKey).toBe('test-key');
      expect(gt.projectId).toBe('test-project');
      expect(gt.baseUrl).toBe('https://api.test.com');
    });

    it('should handle GT configuration with all options', () => {
      const gt = new GT({
        apiKey: 'test-key',
        devApiKey: 'dev-key',
        projectId: 'test-project',
        baseUrl: 'https://api.test.com',
        targetLocale: 'es',
      });

      expect(gt.apiKey).toBe('test-key');
      expect(gt.devApiKey).toBe('dev-key');
      expect(gt.projectId).toBe('test-project');
      expect(gt.baseUrl).toBe('https://api.test.com');
      expect(gt.targetLocale).toBe('es');
    });
  });
});
