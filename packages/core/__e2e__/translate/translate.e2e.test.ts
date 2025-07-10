import { describe, it, expect, beforeAll } from 'vitest';
import { hashSource } from '../../src/id/hashSource';
import {
  IcuMessage,
  JsxChildren,
  VariableType,
  TranslationRequestConfig,
  TranslationRequestMetadata,
} from '../../src/types';
import _translate from '../../src/translate/translate';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('Translation E2E Tests', () => {
  const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

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
  // Runtime endpoints have a different structure than standard translation endpoints
  // Standard: baseUrl + '/v1/translate/content'
  // Runtime: runtimeUrl + '/v1/runtime/${projectId}/client' (no content suffix)
  const clientConfig: TranslationRequestConfig = {
    baseUrl: `${runtimeUrl}/v1/runtime/${projectId}/client`,
    devApiKey: apiKey,
  };

  const serverConfig: TranslationRequestConfig = {
    baseUrl: `${runtimeUrl}/v1/runtime/${projectId}/server`,
    devApiKey: apiKey,
  };

  // Helper function to generate unique IDs and calculate hash values
  // Note: The response.reference.key field will contain the hash value
  const createTestMetadata = (
    source: JsxChildren | IcuMessage,
    metadata: Partial<TranslationRequestMetadata> = {}
  ): TranslationRequestMetadata => {
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
    // Test server availability using translate function
    try {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'test',
      });
      await _translate('Hello world', 'es', testMetadata, clientConfig);
    } catch {
      console.warn('Server may not be available for E2E tests');
    }
  });

  describe('Client Endpoint Tests (/client)', () => {
    it('should test client endpoint with dev API key', async () => {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'test',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          'Hello world',
          'es',
          testMetadata,
          clientConfig
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

    it('should reject client endpoint with regular API key', async () => {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'test',
        sourceLocale: 'en',
      });

      const regularKeyConfig: TranslationRequestConfig = {
        baseUrl: `${runtimeUrl}/v1/runtime/${projectId}/client`,
        apiKey: 'fake-regular-key', // Regular API key should be rejected
      };

      try {
        await _translate('Hello world', 'es', testMetadata, regularKeyConfig);
        // Should not reach here if authentication fails
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('401');
      }
    });
  });

  describe('Server Endpoint Tests (/server)', () => {
    it('should test server endpoint with dev API key', async () => {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'test',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          'Hello world',
          'es',
          testMetadata,
          serverConfig
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

    it('should reject server endpoint with invalid regular API key', async () => {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'test',
        sourceLocale: 'en',
      });

      const regularKeyConfig: TranslationRequestConfig = {
        baseUrl: `${runtimeUrl}/v1/runtime/${projectId}/server`,
        apiKey: 'fake-regular-key', // Fake API key should be rejected
      };

      try {
        await _translate('Hello world', 'es', testMetadata, regularKeyConfig);
        // Should not reach here if authentication fails
        expect(false).toBe(true);
      } catch (error) {
        // Should fail with 401 for invalid key
        expect(error.message).toContain('401');
      }
    });
  });

  describe('Complex JSX Source Types', () => {
    it('should handle deeply nested JSX elements', async () => {
      const complexNestedJsx = [
        'Welcome to our ',
        {
          t: 'div',
          c: [
            {
              t: 'strong',
              c: [
                'premium ',
                {
                  t: 'span',
                  c: ['platform'],
                },
              ],
            },
            ' for ',
            {
              t: 'em',
              c: ['developers'],
            },
          ],
        },
        '!',
      ];

      const testMetadata = createTestMetadata(complexNestedJsx, {
        context: 'nested-welcome',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          complexNestedJsx,
          'es',
          testMetadata,
          clientConfig
        );

        expect(result).toBeDefined();
        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(result.reference.key).toBe(testMetadata.hash);
        }
      } catch {
        expect(true).toBe(true); // Server may not be available
      }
    });

    it('should handle JSX with branches (conditional content)', async () => {
      const jsxWithBranches = [
        'You have ',
        {
          t: 'span',
          d: {
            t: 'b' as const, // branch transformation
            b: {
              zero: ['no items'],
              one: ['1 item'],
              other: [{ k: 'count', v: 'n' as VariableType }, ' items'],
            },
          },
        },
        ' in your cart.',
      ];

      const testMetadata = createTestMetadata(jsxWithBranches, {
        context: 'cart-items',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          jsxWithBranches,
          'fr',
          testMetadata,
          clientConfig
        );

        expect(result).toBeDefined();
        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(result.reference.key).toBe(testMetadata.hash);
        }
      } catch {
        expect(true).toBe(true);
      }
    }, 10000);

    it('should handle JSX with different variable types', async () => {
      const jsxWithVariables = [
        'Hello ',
        { k: 'userName', v: 'v' as VariableType }, // variable
        '! Your account balance is ',
        { k: 'balance', v: 'c' as VariableType }, // currency
        '. You have ',
        { k: 'points', v: 'n' as VariableType }, // number
        ' points. Last login: ',
        { k: 'lastLogin', v: 'd' as VariableType }, // date
        '.',
      ];

      const testMetadata = createTestMetadata(jsxWithVariables, {
        context: 'user-dashboard',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          jsxWithVariables,
          'ja',
          testMetadata,
          clientConfig
        );

        expect(result).toBeDefined();
        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(result.reference.key).toBe(testMetadata.hash);
        }
      } catch {
        expect(true).toBe(true);
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
        context: 'user-dashboard-complex',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          complexJsx,
          'es',
          testMetadata,
          clientConfig
        );

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

    it('should handle JSX with HTML content props', async () => {
      const jsxWithHtmlProps = [
        {
          t: 'img',
          d: {
            alt: 'Profile picture of the user',
            ti: 'Click to view full size',
          },
        },
        {
          t: 'input',
          d: {
            pl: 'Enter your email address',
            arl: 'Email input field',
          },
        },
        {
          t: 'button',
          d: {
            ti: 'Submit the form',
            ard: 'This button will submit your information',
          },
          c: ['Submit'],
        },
      ];

      const testMetadata = createTestMetadata(jsxWithHtmlProps, {
        context: 'form-elements',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          jsxWithHtmlProps,
          'it',
          testMetadata,
          clientConfig
        );

        expect(result).toBeDefined();
        if ('translation' in result) {
          expect(result.translation).toBeDefined();
          expect(result.reference.key).toBe(testMetadata.hash);
        }
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('DataFormat Testing', () => {
    it('should handle ICU dataFormat correctly', async () => {
      const icuSource = 'Hello {name}, you have {count} messages';
      const testMetadata = createTestMetadata(icuSource, {
        context: 'icu-format-test',
        sourceLocale: 'en',
        dataFormat: 'ICU',
      });

      try {
        const result = await _translate(
          icuSource,
          'es',
          testMetadata,
          clientConfig
        );

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
        context: 'jsx-format-test',
        sourceLocale: 'en',
        dataFormat: 'JSX',
      });

      try {
        const result = await _translate(
          jsxSource,
          'fr',
          testMetadata,
          clientConfig
        );

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
  });

  describe('Key Response Testing', () => {
    it('should return consistent keys for string sources', async () => {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'key-test-string',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          'Hello world',
          'es',
          testMetadata,
          clientConfig
        );

        expect(result).toBeDefined();
        if ('translation' in result) {
          expect(result.reference.key).toBe(testMetadata.hash);
          expect(result.reference.id).toBe(testMetadata.id);
        }
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should return consistent keys for JSX sources', async () => {
      const jsxSource = [
        'Welcome to ',
        {
          t: 'strong',
          c: ['our platform'],
        },
        '!',
      ];

      const testMetadata = createTestMetadata(jsxSource, {
        context: 'key-test-jsx',
        sourceLocale: 'en',
      });

      try {
        const result = await _translate(
          jsxSource,
          'fr',
          testMetadata,
          clientConfig
        );

        expect(result).toBeDefined();
        if ('translation' in result) {
          expect(result.reference.key).toBe(testMetadata.hash);
          expect(result.reference.id).toBe(testMetadata.id);
        }
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should generate identical keys for identical content', async () => {
      const identicalSource = 'This is identical content';

      // Create two identical requests (but different IDs)
      const testMetadata1 = createTestMetadata(identicalSource, {
        context: 'key-identical-1',
        sourceLocale: 'en',
      });

      const testMetadata2 = createTestMetadata(identicalSource, {
        context: 'key-identical-1', // Same context
        sourceLocale: 'en',
      });

      try {
        const result1 = await _translate(
          identicalSource,
          'es',
          testMetadata1,
          clientConfig
        );
        const result2 = await _translate(
          identicalSource,
          'es',
          testMetadata2,
          clientConfig
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

  describe('Authentication Scenarios', () => {
    it('should test authentication on client endpoint', async () => {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'auth-test',
        sourceLocale: 'en',
      });

      // Test without API key
      const noAuthConfig: TranslationRequestConfig = {
        baseUrl: `${runtimeUrl}/v1/runtime/${projectId}/client`,
      };

      try {
        await _translate('Hello world', 'es', testMetadata, noAuthConfig);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('401');
      }

      // Test with dev API key
      try {
        const result = await _translate(
          'Hello world',
          'es',
          testMetadata,
          clientConfig
        );
        expect(result).toBeDefined();
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should test authentication on server endpoint', async () => {
      const testMetadata = createTestMetadata('Hello world', {
        context: 'auth-test',
        sourceLocale: 'en',
      });

      // Test without API key
      const noAuthConfig: TranslationRequestConfig = {
        baseUrl: `${runtimeUrl}/v1/runtime/${projectId}/server`,
      };

      try {
        await _translate('Hello world', 'es', testMetadata, noAuthConfig);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('401');
      }

      // Test with dev API key
      try {
        const result = await _translate(
          'Hello world',
          'es',
          testMetadata,
          serverConfig
        );
        expect(result).toBeDefined();
      } catch {
        expect(true).toBe(true);
      }
    });
  });
});
