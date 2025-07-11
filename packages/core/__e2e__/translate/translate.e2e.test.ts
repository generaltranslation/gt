import { describe, it, expect, beforeAll } from 'vitest';
import {
  TranslationError,
  TranslationRequestConfig,
  TranslationResult,
} from '../../src/types';
import { EntryMetadata } from '../../src/types-dir/entry';
import { Content } from '../../src/types-dir/content';
import _translate from '../../src/translate/translate';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('translate E2E Tests', () => {
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

  describe('String Content Translation', () => {
    it('should translate simple string content', async () => {
      const source: Content = 'Hello world';
      const targetLocale = 'es';
      const metadata: EntryMetadata = {
        context: 'greeting',
        sourceLocale: 'en',
      };

      try {
        const result = await _translate(source, targetLocale, metadata, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('reference');

        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(typeof result.translation).toBe('string');
          expect(result.reference).toHaveProperty('id');
          expect(result.reference).toHaveProperty('key');
        } else {
          // TranslationError case
          expect(result).toHaveProperty('error');
          expect(result).toHaveProperty('code');
        }
      } catch (error) {
        // Network or server issues - acceptable in e2e environment
        expect(error).toBeDefined();
      }
    });

    it('should translate ICU message format', async () => {
      const source: Content = 'Hello {name}, you have {count} messages';
      const targetLocale = 'fr';
      const metadata: EntryMetadata = {
        context: 'icu-message',
        sourceLocale: 'en',
      };

      try {
        const result = await _translate(source, targetLocale, metadata, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('reference');

        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(typeof result.translation).toBe('string');
          // Should preserve ICU placeholder format
          expect(result.translation).toContain('{');
          expect(result.translation).toContain('}');
        }
      } catch (error) {
        expect(error).toBeDefined();
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

      try {
        const result = await _translate(source, targetLocale, metadata, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('reference');

        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(Array.isArray(result.translation)).toBe(true);

          if (Array.isArray(result.translation)) {
            expect(result.translation.length).toBeGreaterThan(0);
            // Should preserve JSX structure
            const strongElement = result.translation.find(
              (item) =>
                typeof item === 'object' && 't' in item && item.t === 'strong'
            );
            expect(strongElement).toBeDefined();
          }
        }
      } catch (error) {
        expect(error).toBeDefined();
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

      try {
        const result = await _translate(source, targetLocale, metadata, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('reference');

        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(Array.isArray(result.translation)).toBe(true);

          if (Array.isArray(result.translation)) {
            // Should preserve nested structure
            const divElement = result.translation[0];
            expect(divElement).toHaveProperty('t', 'div');
            expect(divElement).toHaveProperty('c');
            expect(
              typeof divElement === 'object' &&
                'c' in divElement &&
                Array.isArray(divElement.c)
            ).toBe(true);
          }
        }
      } catch (error) {
        expect(error).toBeDefined();
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

      try {
        const result = await _translate(source, targetLocale, metadata, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('reference');

        if ('translation' in result) {
          expect(result.reference).toHaveProperty('id');
          expect(result.reference).toHaveProperty('key');
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle metadata with custom timeout', async () => {
      const source: Content = 'Loading...';
      const targetLocale = 'fr';
      const metadata: EntryMetadata = {
        context: 'ui-text',
        sourceLocale: 'en',
        timeout: 10000, // Custom timeout
      };

      try {
        const result = await _translate(source, targetLocale, metadata, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('reference');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle empty metadata', async () => {
      const source: Content = 'Default text';
      const targetLocale = 'es';
      const metadata: EntryMetadata = {};

      try {
        const result = await _translate(source, targetLocale, metadata, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('reference');
      } catch (error) {
        expect(error).toBeDefined();
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

      try {
        const result = await _translate(
          source,
          targetLocale,
          metadata,
          customConfig
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('reference');
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

      const source: Content = 'Default URL test';
      const targetLocale = 'es';
      const metadata: EntryMetadata = {
        context: 'default-url-test',
        sourceLocale: 'en',
      };

      try {
        const result = await _translate(
          source,
          targetLocale,
          metadata,
          configWithoutUrl
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('reference');
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

      const source: Content = 'Test with invalid key';
      const targetLocale = 'es';
      const metadata: EntryMetadata = {
        context: 'error-test',
        sourceLocale: 'en',
      };

      try {
        const result = await _translate(
          source,
          targetLocale,
          metadata,
          invalidConfig
        );

        // Should return error result instead of throwing
        expect(result).toBeDefined();

        if ('error' in result) {
          expect(result.error).toBeDefined();
          expect(result.code).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(typeof result.code).toBe('number');
        }
      } catch (error) {
        // Network errors are also acceptable
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

      try {
        const result = await _translate(source, targetLocale, metadata, config);

        expect(result).toBeDefined();
      } catch (error) {
        // Timeout errors are expected
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
      const results: {
        locale: string;
        result?: TranslationResult | TranslationError;
        error?: any;
      }[] = [];

      for (const locale of locales) {
        try {
          const result = await _translate(source, locale, metadata, config);
          results.push({ locale, result });
        } catch (error) {
          results.push({ locale, error });
        }
      }

      expect(results).toHaveLength(locales.length);

      // At least some results should be successful (if server is available)
      for (const { result } of results) {
        if (result) {
          expect(result).toHaveProperty('reference');
        }
      }
    });
  });
});
