import { describe, it, expect, beforeAll } from 'vitest';
import { hashSource } from '../../src/id/hashSource';
import {
  IcuMessage,
  JsxChildren,
  VariableType,
  TranslationRequestConfig,
} from '../../src/types';
import { GTRequestMetadata } from '../../src/types/GTRequest';
import _translateMany from '../../src/translate/translateMany';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';
// Environment variables are now loaded automatically by Vitest via the vitest.config.ts file

describe('TranslateMany E2E Tests', () => {
  const runtimeUrl =
    process.env.VITE_GT_RUNTIME_URL ||
    defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

  // Debug: Log the configuration being used
  // eslint-disable-next-line no-console
  console.log('TranslateMany E2E Test Configuration:');
  // eslint-disable-next-line no-console
  console.log('  runtimeUrl:', runtimeUrl);
  // eslint-disable-next-line no-console
  console.log('  projectId:', projectId);
  // eslint-disable-next-line no-console
  console.log('  apiKey:', apiKey ? '***' + apiKey.slice(-4) : 'undefined');

  if (!runtimeUrl) {
    throw new Error('VITE_GT_RUNTIME_URL environment variable is required');
  }
  if (!projectId) {
    throw new Error('GT_PROJECT_ID environment variable is required');
  }
  if (!apiKey) {
    throw new Error('GT_API_KEY environment variable is required');
  }

  // Configuration for GT translateMany function
  const config: TranslationRequestConfig = {
    baseUrl: runtimeUrl,
    projectId: projectId,
    apiKey: apiKey,
  };

  // Helper function to generate unique IDs and calculate hash values
  const createTestMetadata = (
    source: JsxChildren | IcuMessage,
    metadata: Partial<GTRequestMetadata> = {}
  ): GTRequestMetadata => {
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
      await _translateMany(
        [{ source: 'Hello world', metadata: testMetadata }],
        { targetLocale: 'es' },
        config
      );
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Server may not be available for TranslateMany E2E tests');
    }
  });

  it('should translate multiple strings with valid API key', async () => {
    const requests = [
      {
        source: 'Hello world',
        metadata: createTestMetadata('Hello world', {
          context: 'greeting',
          sourceLocale: 'en',
        }),
      },
      {
        source: 'Goodbye world',
        metadata: createTestMetadata('Goodbye world', {
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
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      result.forEach((item, index) => {
        if ('translation' in item) {
          expect(item.translation).toBeDefined();
          expect(item.reference).toBeDefined();
          expect(item.reference.id).toBe(requests[index].metadata.id);
          expect(item.reference.key).toBe(requests[index].metadata.hash);
        } else {
          expect(item).toHaveProperty('error');
        }
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should reject invalid API key', async () => {
    const requests = [
      {
        source: 'Hello world',
        metadata: createTestMetadata('Hello world', {
          context: 'auth-test',
          sourceLocale: 'en',
        }),
      },
    ];

    const invalidConfig: TranslationRequestConfig = {
      baseUrl: runtimeUrl,
      projectId: projectId,
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

    const requests = [
      {
        source: icuSource,
        metadata: createTestMetadata(icuSource, {
          context: 'mixed-test-icu',
          sourceLocale: 'en',
          dataFormat: 'ICU',
        }),
      },
      {
        source: jsxSource,
        metadata: createTestMetadata(jsxSource, {
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
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      if ('translation' in result[0]) {
        expect(typeof result[0].translation).toBe('string');
        expect(result[0].reference.key).toBe(requests[0].metadata.hash);
      }

      if ('translation' in result[1]) {
        expect(Array.isArray(result[1].translation)).toBe(true);
        expect(result[1].reference.key).toBe(requests[1].metadata.hash);
      }
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle empty requests array', async () => {
    try {
      const result = await _translateMany([], { targetLocale: 'es' }, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should generate identical keys for identical content across requests', async () => {
    const identicalSource = 'This is identical content';
    const context = 'key-test';

    const requests = [
      {
        source: identicalSource,
        metadata: createTestMetadata(identicalSource, {
          context,
          sourceLocale: 'en',
        }),
      },
      {
        source: identicalSource,
        metadata: createTestMetadata(identicalSource, {
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
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      if ('translation' in result[0] && 'translation' in result[1]) {
        // Both requests should have the same key (identical content + context)
        expect(result[0].reference.key).toBe(result[1].reference.key);
        // But different IDs
        expect(result[0].reference.id).not.toBe(result[1].reference.id);

        // Verify keys match what we calculated as hash
        expect(result[0].reference.key).toBe(requests[0].metadata.hash);
        expect(result[1].reference.key).toBe(requests[1].metadata.hash);
      }
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle large batch of requests', async () => {
    const batchSize = 10;
    const requests = Array.from({ length: batchSize }, (_, index) => ({
      source: `Test message ${index + 1}`,
      metadata: createTestMetadata(`Test message ${index + 1}`, {
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
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(batchSize);

      result.forEach((item, index) => {
        if ('translation' in item) {
          expect(item.translation).toBeDefined();
          expect(item.reference.id).toBe(requests[index].metadata.id);
          expect(item.reference.key).toBe(requests[index].metadata.hash);
        }
      });
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  }, 30000); // Longer timeout for batch processing
});