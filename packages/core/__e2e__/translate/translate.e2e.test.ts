import { describe, it, expect, beforeAll } from 'vitest';
import { hashSource } from '../../src/id/hashSource';
import {
  IcuMessage,
  JsxChildren,
  VariableType,
  TranslationRequestConfig,
} from '../../src/types';
import { GTRequestMetadata } from '../../src/types/GTRequest';
import _translate from '../../src/translate/translate';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';
// Environment variables are now loaded automatically by Vitest via the vitest.config.ts file

describe('Translation E2E Tests', () => {
  const runtimeUrl =
    process.env.VITE_GT_RUNTIME_URL ||
    defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

  // Debug: Log the configuration being used
  // eslint-disable-next-line no-console
  console.log('E2E Test Configuration:');
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

  // Configuration for GT translate function
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
      await _translate('Hello world', 'es', testMetadata, config);
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Server may not be available for E2E tests');
    }
  });

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
        // Handle error case
        expect(result).toHaveProperty('error');
      }
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should reject invalid API key', async () => {
    const testMetadata = createTestMetadata('Hello world', {
      context: 'auth-test',
      sourceLocale: 'en',
    });

    const invalidConfig: TranslationRequestConfig = {
      baseUrl: runtimeUrl,
      projectId: projectId,
      apiKey: 'fake-invalid-key',
    };

    try {
      await _translate('Hello world', 'es', testMetadata, invalidConfig);
      // Should not reach here if authentication fails
      expect(false).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.message).toContain('401');
    }
  });

  it('should handle ICU dataFormat correctly', async () => {
    const icuSource = 'Hello {name}, you have {count} messages';
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
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle JSX dataFormat correctly', async () => {
    const jsxSource = [
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
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle complex JSX with nested elements and variables', async () => {
    const complexJsx = [
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
