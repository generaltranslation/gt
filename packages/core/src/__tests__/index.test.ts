import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GT } from '../index';
import _translate from '../translate/translate';
import _translateMany from '../translate/translateMany';
import {
  TranslationResult,
  TranslateManyResult,
  Content,
  JsxChildren,
} from '../types';
import { EntryMetadata, Entry } from '../types-dir/entry';

// Mock the internal translate functions
vi.mock('../translate/translate', () => ({
  default: vi.fn(),
}));

vi.mock('../translate/translateMany', () => ({
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
        hash: 'test-key',
      },
      locale: 'es',
      dataFormat: 'ICU',
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

      const result = await gt.translate(source, 'fr', metadata);

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

      await expect(gtNoTarget.translate('Hello world', '')).rejects.toThrow(
        'GT Error: Cannot call `translate` without a specified locale. Either pass a locale to the `translate` function or specify a targetLocale in the GT constructor.'
      );
    });

    it('should throw error when no project ID is provided', async () => {
      const gtNoProject = new GT({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
      });

      await expect(gtNoProject.translate('Hello world', 'es')).rejects.toThrow(
        'GT Error: Cannot call `translate` without a specified project ID. Either pass a project ID to the `translate` function or specify a projectId in the GT constructor.'
      );
    });

    it('should handle empty metadata', async () => {
      const mockTranslate = vi.mocked(_translate);
      mockTranslate.mockResolvedValue(mockTranslationResult);

      const source: Content = 'Hello world';

      await gt.translate(source, 'fr');

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

      await gt.translate(complexJsxSource, 'es');

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
          projectId: 'test-project',
        }
      );

      // Test JSX format
      const jsxSource: JsxChildren = [{ t: 'span', c: ['Hello world'] }];
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

      await gt.translate('Hello world', 'es', fullMetadata);

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

      await expect(gt.translate('Hello world', 'es')).rejects.toThrow(
        'Translation service unavailable'
      );
    });
  });

  describe('translateMany method', () => {
    let gt: GT;
    const mockTranslateManyResult: TranslateManyResult = [
      {
        translation: 'Hola mundo',
        reference: {
          id: 'test-id-1',
          hash: 'test-key-1',
        },
        locale: 'es',
        dataFormat: 'ICU',
      },
      {
        translation: 'Adiós mundo',
        reference: {
          id: 'test-id-2',
          hash: 'test-key-2',
        },
        locale: 'es',
        dataFormat: 'ICU',
      },
    ];

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

      const requests: Entry[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          metadata: { context: 'greeting' },
        },
        {
          source: 'Goodbye world',
          targetLocale: 'es',
          metadata: { context: 'farewell' },
        },
      ];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
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

      const requests: Entry[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          metadata: { context: 'greeting' },
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

      const requests: Entry[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          metadata: { context: 'greeting' },
        },
      ];

      await expect(gtNoTarget.translateMany(requests)).rejects.toThrow(
        'GT Error: Cannot call `translateMany` without a specified locale. Either pass a locale to the `translateMany` function or specify a targetLocale in the GT constructor.'
      );
    });

    it('should throw error when no project ID is provided', async () => {
      const gtNoProject = new GT({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
      });

      const requests: Entry[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          metadata: { context: 'greeting' },
        },
      ];

      await expect(
        gtNoProject.translateMany(requests, { targetLocale: 'es' })
      ).rejects.toThrow(
        'GT Error: Cannot call `translateMany` without a specified project ID. Either pass a project ID to the `translateMany` function or specify a projectId in the GT constructor.'
      );
    });

    it('should handle complex JSX sources', async () => {
      const mockTranslateMany = vi.mocked(_translateMany);
      mockTranslateMany.mockResolvedValue(mockTranslateManyResult);

      const requests: Entry[] = [
        {
          source: [
            'Welcome ',
            {
              t: 'strong',
              c: ['John'],
            },
          ],
          targetLocale: 'es',
          metadata: { context: 'greeting', dataFormat: 'JSX' },
        },
        {
          source: 'Hello {name}',
          targetLocale: 'es',
          metadata: { context: 'greeting', dataFormat: 'ICU' },
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

      const requests: Entry[] = [
        {
          source: 'Hello world',
          targetLocale: 'es',
          metadata: { context: 'greeting' },
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

  describe('resolveCanonicalLocale', () => {
    it('should return canonical locale from custom mapping when available', () => {
      const customMapping = {
        'custom-locale': {
          code: 'en-US',
          name: 'Custom English'
        }
      };
      
      const gt = new GT({
        customMapping,
        targetLocale: 'custom-locale'
      });

      const result = gt.resolveCanonicalLocale('custom-locale');
      expect(result).toBe('en-US');
    });

    it('should return original locale when custom mapping does not have canonical locale', () => {
      const customMapping = {
        'custom-locale': 'Custom English'
      };
      
      const gt = new GT({
        customMapping,
        targetLocale: 'en-US'
      });

      const result = gt.resolveCanonicalLocale('en-US');
      expect(result).toBe('en-US');
    });

    it('should return original locale when no custom mapping provided', () => {
      const gt = new GT({
        targetLocale: 'fr-FR'
      });

      const result = gt.resolveCanonicalLocale('fr-FR');
      expect(result).toBe('fr-FR');
    });

    it('should use instance target locale when no locale parameter provided', () => {
      const customMapping = {
        'alias-locale': {
          code: 'de-DE',
          name: 'German'
        }
      };
      
      const gt = new GT({
        customMapping,
        targetLocale: 'alias-locale'
      });

      const result = gt.resolveCanonicalLocale();
      expect(result).toBe('de-DE');
    });

    it('should throw error when no target locale is provided and no parameter', () => {
      const gt = new GT();

      expect(() => gt.resolveCanonicalLocale()).toThrow(
        'GT Error: Cannot call `resolveCanonicalLocale` without a specified locale. Either pass a locale to the `resolveCanonicalLocale` function or specify a targetLocale in the GT constructor.'
      );
    });
  });

  describe('resolveAliasLocale', () => {
    it('should return alias locale from reverse custom mapping when available', () => {
      const customMapping = {
        'my-custom-locale': {
          code: 'en-GB',
          name: 'British English'
        }
      };
      
      const gt = new GT({
        customMapping
      });

      const result = gt.resolveAliasLocale('en-GB');
      expect(result).toBe('my-custom-locale');
    });

    it('should return original locale when no alias exists in reverse mapping', () => {
      const customMapping = {
        'custom-locale': {
          code: 'fr-FR',
          name: 'French'
        }
      };
      
      const gt = new GT({
        customMapping
      });

      const result = gt.resolveAliasLocale('es-ES');
      expect(result).toBe('es-ES');
    });

    it('should return original locale when custom mapping contains string values only', () => {
      const customMapping = {
        'custom-locale': 'Custom Name'
      };
      
      const gt = new GT({
        customMapping
      });

      const result = gt.resolveAliasLocale('en-US');
      expect(result).toBe('en-US');
    });

    it('should work with custom mapping parameter instead of instance mapping', () => {
      const gt = new GT();
      
      const customMapping = {
        'special-locale': {
          code: 'ja-JP',
          name: 'Japanese'
        }
      };

      const result = gt.resolveAliasLocale('ja-JP', customMapping);
      expect(result).toBe('special-locale');
    });

    it('should return original locale when no custom mapping provided', () => {
      const gt = new GT();

      const result = gt.resolveAliasLocale('zh-CN');
      expect(result).toBe('zh-CN');
    });
  });
});
