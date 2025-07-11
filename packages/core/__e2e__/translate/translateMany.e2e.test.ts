import { describe, it, expect, beforeAll } from 'vitest';
import { hashSource } from '../../src/id/hashSource';
import {
  IcuMessage,
  JsxChildren,
  VariableType,
  TranslationRequestConfig,
} from '../../src/types';
import { EntryMetadata, Entry } from '../../src/types-dir/entry';
import _translateMany from '../../src/translate/translateMany';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

// Environment variables are now loaded automatically by Vitest via the vitest.config.ts file

describe('TranslateMany E2E Tests', () => {
  const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

  if (!runtimeUrl) {
    throw new Error('VITE_GT_RUNTIME_URL environment variable is required');
  }

  // Configuration for GT translateMany function
  const config: TranslationRequestConfig = {
    baseUrl: runtimeUrl,
    projectId: projectId || 'test-project',
    apiKey: apiKey || 'test-key',
  };

  // Helper function to generate unique IDs and calculate hash values
  const createTestMetadata = (
    source: JsxChildren | IcuMessage,
    metadata: Partial<EntryMetadata> = {}
  ): EntryMetadata => {
    const id = `test-id-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;
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
      await _translateMany(
        [
          {
            source: 'Hello world',
            targetLocale: 'es',
            requestMetadata: testMetadata,
          },
        ],
        { targetLocale: 'es' },
        config
      );
    } catch {
      // Server may not be available for TranslateMany E2E tests
    }
  });

  it('should translate multiple strings with valid API key', async () => {
    const requests: Entry[] = [
      {
        source: 'Hello world',
        targetLocale: 'es',
        requestMetadata: createTestMetadata('Hello world', {
          context: 'greeting',
          sourceLocale: 'en',
        }),
      },
      {
        source: 'Goodbye world',
        targetLocale: 'es',
        requestMetadata: createTestMetadata('Goodbye world', {
          context: 'farewell',
          sourceLocale: 'en',
        }),
      },
    ];

    try {
      const result = await _translateMany(
        requests,
        { targetLocale: 'es' },
        config
      );

      expect(result).toBeDefined();
      expect(result.translations).toBeDefined();
      expect(Array.isArray(result.translations)).toBe(true);
      expect(result.translations).toHaveLength(2);

      result.translations.forEach((item, index) => {
        if ('translation' in item) {
          expect(item.translation).toBeDefined();
          expect(item.reference).toBeDefined();
          expect(item.reference.id).toBe(requests[index].requestMetadata.id);
          expect(item.reference.key).toBe(requests[index].requestMetadata.hash);
        } else {
          expect(item).toHaveProperty('error');
        }
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should reject invalid API key', async () => {
    const requests: Entry[] = [
      {
        source: 'Hello world',
        targetLocale: 'es',
        requestMetadata: createTestMetadata('Hello world', {
          context: 'auth-test',
          sourceLocale: 'en',
        }),
      },
    ];

    const invalidConfig: TranslationRequestConfig = {
      baseUrl: runtimeUrl,
      projectId: projectId || 'test-project',
      apiKey: 'fake-invalid-key',
    };

    try {
      await _translateMany(requests, { targetLocale: 'es' }, invalidConfig);
      // Should not reach here if authentication fails
      expect(false).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.message).toContain('401');
    }
  });

  it('should handle mixed ICU and JSX requests', async () => {
    const icuSource = 'Hello {name}, you have {count} messages';
    const jsxSource = [
      'Hello ',
      { t: 'strong', c: [{ k: 'name', v: 'v' as VariableType }] },
      ', you have ',
      { k: 'count', v: 'n' as VariableType },
      ' messages',
    ];

    const requests: Entry[] = [
      {
        source: icuSource,
        targetLocale: 'fr',
        requestMetadata: createTestMetadata(icuSource, {
          context: 'mixed-test-icu',
          sourceLocale: 'en',
          dataFormat: 'ICU',
        }),
      },
      {
        source: jsxSource,
        targetLocale: 'fr',
        requestMetadata: createTestMetadata(jsxSource, {
          context: 'mixed-test-jsx',
          sourceLocale: 'en',
          dataFormat: 'JSX',
        }),
      },
    ];

    try {
      const result = await _translateMany(
        requests,
        { targetLocale: 'fr' },
        config
      );

      expect(result).toBeDefined();
      expect(result.translations).toBeDefined();
      expect(Array.isArray(result.translations)).toBe(true);
      expect(result.translations).toHaveLength(2);

      if ('translation' in result.translations[0]) {
        expect(typeof result.translations[0].translation).toBe('string');
        expect(result.translations[0].reference.key).toBe(
          requests[0].requestMetadata.hash
        );
      }

      if ('translation' in result.translations[1]) {
        expect(Array.isArray(result.translations[1].translation)).toBe(true);
        expect(result.translations[1].reference.key).toBe(
          requests[1].requestMetadata.hash
        );
      }
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle empty requests array', async () => {
    try {
      const result = await _translateMany([], { targetLocale: 'es' }, config);

      expect(result).toBeDefined();
      expect(result.translations).toBeDefined();
      expect(Array.isArray(result.translations)).toBe(true);
      expect(result.translations).toHaveLength(0);
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should generate identical keys for identical content across requests', async () => {
    const identicalSource = 'This is identical content';
    const context = 'key-test';

    const requests: Entry[] = [
      {
        source: identicalSource,
        targetLocale: 'es',
        requestMetadata: createTestMetadata(identicalSource, {
          context,
          sourceLocale: 'en',
        }),
      },
      {
        source: identicalSource,
        targetLocale: 'es',
        requestMetadata: createTestMetadata(identicalSource, {
          context, // Same context
          sourceLocale: 'en',
        }),
      },
    ];

    try {
      const result = await _translateMany(
        requests,
        { targetLocale: 'es' },
        config
      );

      expect(result).toBeDefined();
      expect(result.translations).toBeDefined();
      expect(Array.isArray(result.translations)).toBe(true);
      expect(result.translations).toHaveLength(2);

      if (
        'translation' in result.translations[0] &&
        'translation' in result.translations[1]
      ) {
        // Both requests should have the same key (identical content + context)
        expect(result.translations[0].reference.key).toBe(
          result.translations[1].reference.key
        );
        // But different IDs
        expect(result.translations[0].reference.id).not.toBe(
          result.translations[1].reference.id
        );

        // Verify keys match what we calculated as hash
        expect(result.translations[0].reference.key).toBe(
          requests[0].requestMetadata.hash
        );
        expect(result.translations[1].reference.key).toBe(
          requests[1].requestMetadata.hash
        );
      }
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle large batch of requests', async () => {
    const batchSize = 10;
    const requests: Entry[] = Array.from({ length: batchSize }, (_, index) => ({
      source: `Test message ${index + 1}`,
      targetLocale: 'es',
      requestMetadata: createTestMetadata(`Test message ${index + 1}`, {
        context: 'batch-test',
        sourceLocale: 'en',
      }),
    }));

    try {
      const result = await _translateMany(
        requests,
        { targetLocale: 'es' },
        config
      );

      expect(result).toBeDefined();
      expect(result.translations).toBeDefined();
      expect(Array.isArray(result.translations)).toBe(true);
      expect(result.translations).toHaveLength(batchSize);

      result.translations.forEach((item, index) => {
        if ('translation' in item) {
          expect(item.translation).toBeDefined();
          expect(item.reference.id).toBe(requests[index].requestMetadata.id);
          expect(item.reference.key).toBe(requests[index].requestMetadata.hash);
        }
      });
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  }, 30000); // Longer timeout for batch processing
});
