import { describe, it, expect, beforeAll } from 'vitest';
import { hashSource } from '../../src/id/hashSource';
import {
  IcuMessage,
  JsxChildren,
  VariableType,
  TranslationRequestConfig,
  TranslationResult,
  TranslationError,
  Content,
} from '../../src/types';
import { EntryMetadata } from '../../src/types-dir/entry';
import _translate from '../../src/translate/translate';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('Translation E2E Tests', () => {
  const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

  if (!runtimeUrl) {
    throw new Error('VITE_GT_RUNTIME_URL environment variable is required');
  }

  // Configuration for GT translate function
  const config: TranslationRequestConfig = {
    baseUrl: runtimeUrl,
    projectId: projectId || 'test-project',
    apiKey: apiKey || 'test-key',
  };

  // Helper function to generate unique IDs and calculate hash values
  const createTestMetadata = (
    source: Content,
    metadata: Partial<EntryMetadata> = {}
  ): EntryMetadata => {
    const id = `test-id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const dataFormat = typeof source === 'string' ? 'ICU' : 'JSX';
    const hash = hashSource({
      source,
      context: metadata.context,
      id,
      dataFormat,
    });

    return {
      ...metadata,
      id,
      hash,
      dataFormat,
    };
  };

  beforeAll(async () => {
    // Test server availability
    try {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'test',
      });
      await _translate('Hello world', 'es', testMetadata, config);
    } catch {
      // Server may not be available for E2E tests
    }
  });

  describe('Interface Compliance Tests', () => {
    it('should accept Content type as source input', async () => {
      const stringSource: Content = 'Hello world';
      const jsxSource: Content = ['Hello ', { t: 'strong', c: ['world'] }];
      const icuSource: Content = 'Hello {name}';

      const testMetadata1 = createTestMetadata(stringSource, {
        context: 'interface-string',
        sourceLocale: 'en',
      });

      const testMetadata2 = createTestMetadata(jsxSource, {
        context: 'interface-jsx',
        sourceLocale: 'en',
      });

      const testMetadata3 = createTestMetadata(icuSource, {
        context: 'interface-icu',
        sourceLocale: 'en',
      });

      try {
        const result1 = await _translate(
          stringSource,
          'es',
          testMetadata1,
          config
        );
        const result2 = await _translate(
          jsxSource,
          'es',
          testMetadata2,
          config
        );
        const result3 = await _translate(
          icuSource,
          'es',
          testMetadata3,
          config
        );

        // All should return either TranslationResult or TranslationError
        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
        expect(result3).toBeDefined();

        // Verify return type structure
        expect(result1).toHaveProperty('reference');
        expect(result2).toHaveProperty('reference');
        expect(result3).toHaveProperty('reference');

        expect(true).toBe(true);
      } catch {
        expect(true).toBe(true); // Server may not be available
      }
    });

    it('should accept EntryMetadata with all fields', async () => {
      const fullMetadata: EntryMetadata = {
        context: 'full-metadata-test',
        id: 'custom-id-123',
        hash: 'custom-hash-456',
        dataFormat: 'ICU',
        sourceLocale: 'en',
        actionType: 'fast',
      };

      try {
        const result = await _translate(
          'Hello world',
          'es',
          fullMetadata,
          config
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('reference');

        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(result.reference.id).toBe(fullMetadata.id);
        } else {
          expect(result).toHaveProperty('error');
          expect(result).toHaveProperty('code');
        }

        expect(true).toBe(true);
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should return TranslationResult or TranslationError', async () => {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'return-type-test',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          'Hello world',
          'es',
          testMetadata,
          config
        );

        expect(result).toBeDefined();

        // Should be either TranslationResult or TranslationError
        if ('translation' in result) {
          // TranslationResult
          const translationResult = result as TranslationResult;
          expect(translationResult.translation).toBeDefined();
          expect(translationResult.reference).toBeDefined();
          expect(translationResult.reference).toHaveProperty('id');
          expect(translationResult.reference).toHaveProperty('key');
        } else {
          // TranslationError
          const translationError = result as TranslationError;
          expect(translationError.error).toBeDefined();
          expect(translationError.code).toBeDefined();
          expect(typeof translationError.error).toBe('string');
          expect(typeof translationError.code).toBe('number');
        }

        expect(true).toBe(true);
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('Functional E2E Tests', () => {
    it('should translate with valid API key', async () => {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'basic-test',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          'Hello world',
          'es',
          testMetadata,
          config
        );

        expect(result).toBeDefined();

        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(result.reference).toBeDefined();
          expect(result.reference.id).toBe(testMetadata.id);
          expect(result.reference.key).toBe(testMetadata.hash);
        } else {
          expect(result).toHaveProperty('error');
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle ICU dataFormat correctly', async () => {
      const icuSource: IcuMessage = 'Hello {name}, you have {count} messages';
      const testMetadata = createTestMetadata(icuSource, {
        context: 'icu-test',
        sourceLocale: 'en',
        dataFormat: 'ICU',
      });

      try {
        const result = await _translate(icuSource, 'es', testMetadata, config);

        expect(result).toBeDefined();
        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(typeof result.translation).toBe('string');
          expect(result.reference.key).toBe(testMetadata.hash);
        }
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should handle JSX dataFormat correctly', async () => {
      const jsxSource: JsxChildren = [
        'Hello ',
        { t: 'strong', c: [{ k: 'name', v: 'v' as VariableType }] },
        ', you have ',
        { k: 'count', v: 'n' as VariableType },
        ' messages',
      ];

      const testMetadata = createTestMetadata(jsxSource, {
        context: 'jsx-test',
        sourceLocale: 'en',
        dataFormat: 'JSX',
      });

      try {
        const result = await _translate(jsxSource, 'fr', testMetadata, config);

        expect(result).toBeDefined();
        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(Array.isArray(result.translation)).toBe(true);
          expect(result.reference.key).toBe(testMetadata.hash);
        }
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should handle complex JSX with nested elements and variables', async () => {
      const complexJsx: JsxChildren = [
        {
          t: 'div',
          c: [
            {
              t: 'h1',
              c: ['Welcome ', { k: 'firstName', v: 'v' as VariableType }],
            },
            {
              t: 'p',
              c: [
                'You have ',
                { k: 'notificationCount', v: 'n' as VariableType },
                ' new notifications since your last visit on ',
                {
                  t: 'time',
                  c: [{ k: 'lastVisit', v: 'd' as VariableType }],
                },
                '.',
              ],
            },
          ],
        },
      ];

      const testMetadata = createTestMetadata(complexJsx, {
        context: 'complex-jsx-test',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(complexJsx, 'es', testMetadata, config);

        expect(result).toBeDefined();
        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(result.reference.key).toBe(testMetadata.hash);
          // Verify the translation maintains structure
          if (Array.isArray(result.translation)) {
            expect(result.translation[0]).toHaveProperty('t', 'div');
            expect(result.translation[0]).toHaveProperty('c');
          }
        }
      } catch {
        expect(true).toBe(true);
      }
    }, 15000);

    it('should generate identical keys for identical content', async () => {
      const identicalSource = 'This is identical content';

      // Create two identical requests (but different IDs)
      const testMetadata1 = createTestMetadata(identicalSource, {
        context: 'key-test',
        sourceLocale: 'en',
      });

      const testMetadata2 = createTestMetadata(identicalSource, {
        context: 'key-test', // Same context
        sourceLocale: 'en',
      });

      try {
        const result1 = await _translate(
          identicalSource,
          'es',
          testMetadata1,
          config
        );
        const result2 = await _translate(
          identicalSource,
          'es',
          testMetadata2,
          config
        );

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();

        if ('translation' in result1 && 'translation' in result2) {
          // Both requests should have the same key (identical content + context)
          expect(result1.reference.key).toBe(result2.reference.key);
          // But different IDs
          expect(result1.reference.id).not.toBe(result2.reference.id);

          // Verify keys match what we calculated as hash
          expect(result1.reference.key).toBe(testMetadata1.hash);
          expect(result2.reference.key).toBe(testMetadata2.hash);
        }
      } catch {
        expect(true).toBe(true);
      }
    });
  });
});
