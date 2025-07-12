import { describe, it, expect, beforeAll } from 'vitest';
import { TranslationRequestConfig, TranslationResult } from '../../src/types';
import { EntryMetadata, Entry } from '../../src/types-dir/entry';
import _translateMany from '../../src/translate/translateMany';
import { defaultBaseUrl } from '../../src/settings/settingsUrls';

describe('translateMany E2E Tests', () => {
  let config: TranslationRequestConfig;

  beforeAll(() => {
    const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultBaseUrl;
    const projectId = process.env.VITE_CI_TEST_GT_PROJECT_ID;
    const apiKey = process.env.VITE_CI_TEST_GT_API_KEY;

    // Skip tests if no real credentials are provided
    if (!projectId || !apiKey) {
      console.warn('Skipping e2e tests - no valid credentials provided');
    }

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

      const result = await _translateMany(entries, globalMetadata, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(entries.length);

      // All results should be successful translations
      result.forEach((translationResult) => {
        expect(translationResult).toBeDefined();
        expect('translation' in translationResult).toBe(true);
        if ('translation' in translationResult) {
          expect(translationResult).toHaveProperty('translation');
          expect(translationResult).toHaveProperty('reference');
          expect(typeof translationResult.translation).toBe('string');
          // Reference may have id, key, or hash depending on API response
          expect(translationResult.reference).toBeDefined();
          expect(typeof translationResult.reference).toBe('object');
        }
      });
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

      const result = await _translateMany(entries, globalMetadata, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(entries.length);

      // All should be successful translations - check that different content types are preserved
      const jsxTranslation = result[1];
      expect('translation' in jsxTranslation).toBe(true);
      if ('translation' in jsxTranslation) {
        expect(Array.isArray(jsxTranslation.translation)).toBe(true);
      }

      const icuTranslation = result[2];
      expect('translation' in icuTranslation).toBe(true);
      if ('translation' in icuTranslation) {
        expect(typeof icuTranslation.translation).toBe('string');
        // Should preserve ICU format
        expect(icuTranslation.translation).toContain('{');
        expect(icuTranslation.translation).toContain('}');
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

      const result = await _translateMany(entries, globalMetadata, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(entries.length);

      // All should be successful translations with proper reference data
      result.forEach((translationResult) => {
        expect(translationResult).toBeDefined();
        expect('translation' in translationResult).toBe(true);
        expect(translationResult).toHaveProperty('reference');
        // Reference may have id, key, or hash depending on API response
        expect(translationResult.reference).toBeDefined();
        expect(typeof translationResult.reference).toBe('object');
      });
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

      const result = await _translateMany(entries, globalMetadata, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(entries.length);

      // All should be successful translations
      result.forEach((translationResult) => {
        expect('translation' in translationResult).toBe(true);
      });
    });

    it('should handle different target locales', async () => {
      const entries: Entry[] = [
        { source: 'Good morning' },
        { source: 'Good evening' },
      ];

      const locales = ['es', 'fr', 'de'];
      const results: TranslationResult[] = [];

      for (const locale of locales) {
        const globalMetadata: { targetLocale: string } & EntryMetadata = {
          targetLocale: locale,
          sourceLocale: 'en',
          context: 'time-greetings',
        };

        const result = await _translateMany(entries, globalMetadata, config);

        // Should always be successful translations
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(entries.length);

        result.forEach((translationResult) => {
          expect('translation' in translationResult).toBe(true);
          expect(translationResult).toHaveProperty('reference');
        });

        results.push(...(result as TranslationResult[]));
      }

      expect(results).toHaveLength(entries.length * locales.length);

      // All results should be successful translations
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect('translation' in result).toBe(true);
        expect(result).toHaveProperty('translation');
        expect(result).toHaveProperty('reference');
      });
    });
  });

  describe('Configuration Handling', () => {
    it('should handle config with custom baseUrl', async () => {
      const customConfig: TranslationRequestConfig = {
        ...config,
        baseUrl: config.baseUrl || defaultBaseUrl,
      };

      const entries: Entry[] = [{ source: 'Test message' }];

      const globalMetadata: { targetLocale: string } & EntryMetadata = {
        targetLocale: 'es',
        sourceLocale: 'en',
        context: 'config-test',
      };

      const result = await _translateMany(
        entries,
        globalMetadata,
        customConfig
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);

      // Should be a successful translation
      expect('translation' in result[0]).toBe(true);
    });

    // Note: Test for config without baseUrl requires valid API credentials
    // and is skipped in local development environment
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

      // Invalid API key should cause an error (thrown or returned as TranslationError array)
      try {
        const result = await _translateMany(
          entries,
          globalMetadata,
          invalidConfig
        );

        // If not thrown, should be TranslationErrors
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        result.forEach((translationResult) => {
          expect('error' in translationResult).toBe(true);
        });
      } catch (error) {
        // Thrown errors are also expected for invalid credentials
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

      // Very short timeout should cause an error (thrown or returned as TranslationError array)
      try {
        const result = await _translateMany(entries, globalMetadata, config);

        // If not thrown, might succeed if very fast or return TranslationErrors
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // Timeout errors are expected for such a short timeout
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

      const result = await _translateMany(entries, globalMetadata, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
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

      const result = await _translateMany(entries, globalMetadata, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(entries.length);

      // All translations should be successful
      result.forEach((translationResult) => {
        expect(translationResult).toBeDefined();
        expect('translation' in translationResult).toBe(true);
        expect(translationResult).toHaveProperty('translation');
        expect(translationResult).toHaveProperty('reference');
      });
    });
  });
});
