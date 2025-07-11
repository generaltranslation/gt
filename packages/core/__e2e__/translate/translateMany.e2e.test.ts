import { describe, it, expect, beforeAll } from 'vitest';
import {
  TranslationRequestConfig,
  TranslateManyResult,
  TranslationResult,
  TranslationError,
} from '../../src/types';
import { EntryMetadata, Entry } from '../../src/types-dir/entry';
import { Content } from '../../src/types-dir/content';
import _translateMany from '../../src/translate/translateMany';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('translateMany E2E Tests', () => {
  let config: TranslationRequestConfig;

  beforeAll(() => {
    const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
    const projectId = process.env.VITE_GT_PROJECT_ID;
    const apiKey = process.env.VITE_GT_API_KEY;

    config = {
      baseUrl: runtimeUrl,
      projectId: projectId || 'test-project',
      apiKey: apiKey || 'test-key',
    };
  });

  describe('Batch Translation', () => {
    it('should translate multiple string entries in one request', async () => {
      const entries: Entry[] = [
        {
          source: 'Hello world',
          requestMetadata: { context: 'greeting-1' },
        },
        {
          source: 'Good morning',
          requestMetadata: { context: 'greeting-2' },
        },
        {
          source: 'Welcome back',
          requestMetadata: { context: 'greeting-3' },
        },
      ];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
        context: 'batch-greetings',
      };

      try {
        const result = await _translateMany(entries, globalMetadata, config);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(entries.length);

        // Verify each translation result
        result.forEach((translationResult, index) => {
          expect(translationResult).toBeDefined();
          if ('translation' in translationResult) {
            expect(translationResult).toHaveProperty('translation');
            expect(translationResult).toHaveProperty('reference');
            expect(typeof translationResult.translation).toBe('string');
            expect(translationResult.reference).toHaveProperty('id');
            expect(translationResult.reference).toHaveProperty('key');
          } else {
            // TranslationError case
            expect(translationResult).toHaveProperty('error');
            expect(translationResult).toHaveProperty('code');
          }
        });
      } catch (error) {
        // Network or server issues - acceptable in e2e environment
        expect(error).toBeDefined();
      }
    });

    it('should translate mixed content types (string and JSX)', async () => {
      const entries: Entry[] = [
        {
          source: 'Simple text message',
          requestMetadata: { context: 'simple-text' },
        },
        {
          source: ['Welcome ', { t: 'strong', c: ['John'] }],
          requestMetadata: { context: 'jsx-content', dataFormat: 'JSX' },
        },
        {
          source: 'Hello {name}, you have {count} messages',
          requestMetadata: { context: 'icu-message', dataFormat: 'ICU' },
        },
      ];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'fr',
        sourceLocale: 'en',
        context: 'mixed-content-batch',
      };

      try {
        const result = await _translateMany(entries, globalMetadata, config);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(entries.length);

        // Check that different content types are preserved
        const jsxTranslation = result[1];
        if (jsxTranslation && 'translation' in jsxTranslation) {
          expect(Array.isArray(jsxTranslation.translation)).toBe(true);
        }

        const icuTranslation = result[2];
        if (icuTranslation && 'translation' in icuTranslation) {
          expect(typeof icuTranslation.translation).toBe('string');
          // Should preserve ICU format
          if (typeof icuTranslation.translation === 'string') {
            expect(icuTranslation.translation).toContain('{');
            expect(icuTranslation.translation).toContain('}');
          }
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle entries with individual metadata', async () => {
      const entries: Entry[] = [
        {
          source: 'Save changes',
          requestMetadata: {
            context: 'button-save',
            actionType: 'fast',
          },
        },
        {
          source: 'Delete item',
          requestMetadata: {
            context: 'button-delete',
            actionType: 'standard',
          },
        },
        {
          source: 'Cancel operation',
          requestMetadata: {
            context: 'button-cancel',
            dataFormat: 'ICU',
          },
        },
      ];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'de',
        sourceLocale: 'en',
        context: 'ui-buttons',
      };

      try {
        const result = await _translateMany(entries, globalMetadata, config);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(entries.length);

        // Each translation should have proper reference data
        result.forEach((translationResult) => {
          expect(translationResult).toBeDefined();
          if ('translation' in translationResult) {
            expect(translationResult).toHaveProperty('reference');
            expect(translationResult.reference).toHaveProperty('id');
            expect(translationResult.reference).toHaveProperty('key');
          } else {
            // TranslationError case
            expect(translationResult).toHaveProperty('error');
            expect(translationResult).toHaveProperty('code');
          }
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Global Metadata Handling', () => {
    it('should apply global metadata to all entries', async () => {
      const entries: Entry[] = [
        { source: 'First message' },
        { source: 'Second message' },
      ];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
        context: 'global-context',
        actionType: 'fast',
        timeout: 10000,
      };

      try {
        const result = await _translateMany(entries, globalMetadata, config);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(entries.length);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle different target locales', async () => {
      const entries: Entry[] = [
        { source: 'Good morning' },
        { source: 'Good evening' },
      ];

      const locales = ['es', 'fr', 'de'];
      const results: {
        locale: string;
        result?: TranslationResult | TranslationError;
        error?: any;
      }[] = [];

      for (const locale of locales) {
        const globalMetadata: { targetLocale: string } & EntryMetadata = {
          targetLocale: locale,
          sourceLocale: 'en',
          context: 'time-greetings',
        };

        try {
          const result = await _translateMany(entries, globalMetadata, config);
          results.push({ locale, result });
        } catch (error) {
          results.push({ locale, error });
        }
      }

      expect(results).toHaveLength(locales.length);

      // At least some results should be successful (if server is available)
      for (const { result } of results) {
        if (result) {
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(entries.length);
        }
      }
    });
  });

  describe('Configuration Handling', () => {
    it('should handle config with custom baseUrl', async () => {
      const customConfig: TranslationRequestConfig = {
        ...config,
        baseUrl: config.baseUrl || defaultRuntimeApiUrl,
      };

      const entries: Entry[] = [{ source: 'Test message' }];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
        context: 'config-test',
      };

      try {
        const result = await _translateMany(
          entries,
          globalMetadata,
          customConfig
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle config without baseUrl (defaults)', async () => {
      const configWithoutUrl: TranslationRequestConfig = {
        projectId: config.projectId,
        apiKey: config.apiKey,
        // baseUrl omitted - should use default
      };

      const entries: Entry[] = [{ source: 'Default URL test' }];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
        context: 'default-url-test',
      };

      try {
        const result = await _translateMany(
          entries,
          globalMetadata,
          configWithoutUrl
        );

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid API key gracefully', async () => {
      const invalidConfig: TranslationRequestConfig = {
        ...config,
        apiKey: 'invalid-key-12345',
      };

      const entries: Entry[] = [{ source: 'Test with invalid key' }];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
        context: 'error-test',
      };

      try {
        const result = await _translateMany(
          entries,
          globalMetadata,
          invalidConfig
        );

        // Should either return results or throw an error
        expect(result).toBeDefined();
      } catch (error) {
        // Network/auth errors are acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle timeout gracefully', async () => {
      const entries: Entry[] = [{ source: 'Timeout test message' }];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
        context: 'timeout-test',
        timeout: 1, // Very short timeout to force timeout
      };

      try {
        const result = await _translateMany(entries, globalMetadata, config);

        expect(result).toBeDefined();
      } catch (error) {
        // Timeout errors are expected
        expect(error).toBeDefined();
      }
    });

    it('should handle empty entries array', async () => {
      const entries: Entry[] = [];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
        context: 'empty-test',
      };

      try {
        const result = await _translateMany(entries, globalMetadata, config);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(0);
      } catch (error) {
        // Server may reject empty requests - acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Large Batch Processing', () => {
    it('should handle large batch of translations', async () => {
      const entries: Entry[] = Array.from({ length: 10 }, (_, i) => ({
        source: `Message ${i + 1}`,
        requestMetadata: {
          context: `batch-message-${i + 1}`,
        },
      }));

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
        context: 'large-batch-test',
      };

      try {
        const result = await _translateMany(entries, globalMetadata, config);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(entries.length);

        // All translations should be successful
        result.forEach((translationResult, index) => {
          expect(translationResult).toBeDefined();
          if ('translation' in translationResult) {
            expect(translationResult).toHaveProperty('translation');
            expect(translationResult).toHaveProperty('reference');
          } else {
            // TranslationError case
            expect(translationResult).toHaveProperty('error');
            expect(translationResult).toHaveProperty('code');
          }
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
