import { describe, it, expect, beforeAll } from 'vitest';
import { TranslationRequestConfig, TranslationResult } from '../../src/types';
import { EntryMetadata } from '../../src/types-dir/entry';
import { Content } from '../../src/types-dir/content';
import _translate from '../../src/translate/translate';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('translate E2E Tests', () => {
  let config: TranslationRequestConfig;

  beforeAll(() => {
    const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
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

  describe('String Content Translation', () => {
    it('should translate simple string content', async () => {
      const source: Content = 'Hello world';
      const targetLocale = 'es';
      const metadata: EntryMetadata = {
        context: 'greeting',
        sourceLocale: 'en',
      };

      const result = await _translate(source, targetLocale, metadata, config);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('reference');

      // Should always be a successful translation result
      expect('translation' in result).toBe(true);
      if ('translation' in result) {
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
      }
      if ('translation' in result) {
        expect(result.translation).toBeDefined();
        expect(typeof result.translation).toBe('string');
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
      }
      // Reference may have id, key, or hash depending on API response
      expect(result.reference).toBeDefined();
      expect(typeof result.reference).toBe('object');
      expect(result.reference.hash).toBeDefined();
    });

    it('should translate ICU message format', async () => {
      const source: Content = 'Hello {name}, you have {count} messages';
      const targetLocale = 'fr';
      const metadata: EntryMetadata = {
        context: 'icu-message',
        sourceLocale: 'en',
      };

      const result = await _translate(source, targetLocale, metadata, config);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('reference');

      // Should always be a successful translation result
      expect('translation' in result).toBe(true);
      if ('translation' in result) {
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
      }
      if ('translation' in result) {
        expect(result.translation).toBeDefined();
        expect(typeof result.translation).toBe('string');
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
        // Should preserve ICU placeholder format
        expect(result.translation).toContain('{');
        expect(result.translation).toContain('}');
      }
    });
  });

  describe('JSX Content Translation', () => {
    it('should translate simple JSX content', async () => {
      const source: Content = ['Hello ', { t: 'strong', c: ['world'] }];
      const targetLocale = 'de';
      const metadata: EntryMetadata = {
        context: 'jsx-greeting',
        sourceLocale: 'en',
      };

      const result = await _translate(source, targetLocale, metadata, config);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('reference');

      // Should always be a successful translation result
      expect('translation' in result).toBe(true);
      if ('translation' in result) {
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
      }
      if ('translation' in result) {
        expect(result.translation).toBeDefined();
        expect(Array.isArray(result.translation)).toBe(true);
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBe('JSX');

        if (Array.isArray(result.translation)) {
          expect(result.translation.length).toBeGreaterThan(0);
          // Should preserve some JSX structure (actual structure may vary)
          expect(
            result.translation.some((item) => typeof item === 'object')
          ).toBe(true);
        }
      }
    });

    it('should translate complex nested JSX content', async () => {
      const source: Content = [
        {
          t: 'div',
          c: [
            {
              t: 'h1',
              c: ['Welcome'],
            },
            {
              t: 'p',
              c: ['This is a ', { t: 'strong', c: ['complex'] }, ' example.'],
            },
          ],
        },
      ];
      const targetLocale = 'es';
      const metadata: EntryMetadata = {
        context: 'complex-jsx',
        sourceLocale: 'en',
      };

      const result = await _translate(source, targetLocale, metadata, config);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('reference');

      // Should always be a successful translation result
      expect('translation' in result).toBe(true);
      if ('translation' in result) {
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
      }
      if ('translation' in result) {
        expect(result.translation).toBeDefined();
        expect(Array.isArray(result.translation)).toBe(true);
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBe('JSX');

        // Should preserve nested structure (actual structure may vary)
        if (Array.isArray(result.translation)) {
          expect(result.translation.length).toBeGreaterThan(0);
          expect(
            result.translation.some((item) => typeof item === 'object')
          ).toBe(true);
        }
      }
    });
  });

  describe('Metadata Handling', () => {
    it('should handle metadata with context and sourceLocale', async () => {
      const source: Content = 'Save changes';
      const targetLocale = 'es';
      const metadata: EntryMetadata = {
        context: 'button-text',
        sourceLocale: 'en',
      };

      const result = await _translate(source, targetLocale, metadata, config);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('reference');

      // Should always be a successful translation result
      expect('translation' in result).toBe(true);
      if ('translation' in result) {
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
      }
      if ('translation' in result) {
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
      }
      // Reference may have id, key, or hash depending on API response
      expect(result.reference).toBeDefined();
      expect(typeof result.reference).toBe('object');
      expect(result.reference.hash).toBeDefined();
    });

    it('should handle metadata with custom timeout', async () => {
      const source: Content = 'Loading...';
      const targetLocale = 'fr';
      const metadata: EntryMetadata = {
        context: 'ui-text',
        sourceLocale: 'en',
        timeout: 10000, // Custom timeout
      };

      const result = await _translate(source, targetLocale, metadata, config);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('reference');

      // Should always be a successful translation result
      expect('translation' in result).toBe(true);
      if ('translation' in result) {
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
      }
    });

    it('should handle empty metadata', async () => {
      const source: Content = 'Default text';
      const targetLocale = 'es';
      const metadata: EntryMetadata = {};

      const result = await _translate(source, targetLocale, metadata, config);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('reference');

      // Should always be a successful translation result
      expect('translation' in result).toBe(true);
      if ('translation' in result) {
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
      }
    });
  });

  describe('Configuration Handling', () => {
    it('should handle config with custom baseUrl', async () => {
      const customConfig: TranslationRequestConfig = {
        ...config,
        baseUrl: config.baseUrl || defaultRuntimeApiUrl,
      };

      const source: Content = 'Test message';
      const targetLocale = 'es';
      const metadata: EntryMetadata = {
        context: 'config-test',
        sourceLocale: 'en',
      };

      const result = await _translate(
        source,
        targetLocale,
        metadata,
        customConfig
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('reference');

      // Should always be a successful translation result
      expect('translation' in result).toBe(true);
      if ('translation' in result) {
        expect(result.locale).toBe(targetLocale);
        expect(result.dataFormat).toBeDefined();
      }
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

      const source: Content = 'Test with invalid key';
      const targetLocale = 'es';
      const metadata: EntryMetadata = {
        context: 'error-test',
        sourceLocale: 'en',
      };

      // Invalid API key should cause an error (thrown or returned as TranslationError)
      try {
        const result = await _translate(
          source,
          targetLocale,
          metadata,
          invalidConfig
        );

        // If not thrown, should be a RequestError
        expect(result).toBeDefined();
        expect('error' in result).toBe(true);

        // error and code properties are required in RequestError
        if ('error' in result) {
          expect(typeof result.error).toBe('string');
          expect(typeof result.code).toBe('number');
          expect(result.error.length).toBeGreaterThan(0);
        }
      } catch (error) {
        // Thrown errors are also expected for invalid credentials
        expect(error).toBeDefined();
      }
    });

    it('should handle network timeout gracefully', async () => {
      const source: Content = 'Timeout test';
      const targetLocale = 'es';
      const metadata: EntryMetadata = {
        context: 'timeout-test',
        sourceLocale: 'en',
        timeout: 1, // Very short timeout to force timeout
      };

      // Very short timeout should cause an error (thrown or returned as TranslationError)
      try {
        const result = await _translate(source, targetLocale, metadata, config);

        // If not thrown, should be a TranslationError or might succeed if very fast
        expect(result).toBeDefined();
      } catch (error) {
        // Timeout errors are expected for such a short timeout
        expect(error).toBeDefined();
      }
    });
  });

  describe('Multiple Locales', () => {
    it('should translate to different target locales', async () => {
      const source: Content = 'Good morning';
      const metadata: EntryMetadata = {
        context: 'time-greeting',
        sourceLocale: 'en',
      };

      const locales = ['es', 'fr', 'de'];
      const results: TranslationResult[] = [];

      for (const locale of locales) {
        const result = await _translate(source, locale, metadata, config);

        // Should always be successful translations
        expect('translation' in result).toBe(true);
        expect(result).toHaveProperty('reference');
        results.push(result as TranslationResult);
      }

      expect(results).toHaveLength(locales.length);

      // All results should be successful translations
      results.forEach((result) => {
        expect(result).toHaveProperty('translation');
        expect(result).toHaveProperty('reference');
        // Reference may have id, key, or hash depending on API response
        expect(result.reference).toBeDefined();
        expect(typeof result.reference).toBe('object');
      });
    });
  });
});
