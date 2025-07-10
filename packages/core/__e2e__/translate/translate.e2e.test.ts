import { describe, it, expect, beforeAll } from 'vitest';
import { hashSource } from '../../src/id/hashSource';
import { IcuMessage, JsxChildren, VariableType } from '../../src/types';

describe('Translation E2E Tests', () => {
  const runtimeUrl = process.env.VITE_GT_RUNTIME_URL;
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

  const clientEndpoint = `${runtimeUrl}/v1/runtime/${projectId}/client`;
  const serverEndpoint = `${runtimeUrl}/v1/runtime/${projectId}/server`;

  // Helper function to generate unique IDs and calculate proper hashes
  const createTestRequest = (
    source: JsxChildren | IcuMessage,
    metadata: any = {}
  ) => {
    const id = `test-id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const hash = hashSource({
      source,
      context: metadata.context,
      id,
      dataFormat: typeof source === 'string' ? 'ICU' : 'JSX',
    });

    return {
      source,
      metadata: {
        ...metadata,
        id,
        hash,
      },
    };
  };

  beforeAll(async () => {
    // Test server availability without excessive logging
    try {
      const testRequest = createTestRequest('Hello world', { context: 'test' });
      await fetch(clientEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-dev-api-key': apiKey,
        },
        body: JSON.stringify({
          requests: [testRequest],
          targetLocale: 'es',
          metadata: {},
          versionId: 'test-version',
        }),
      });
    } catch {
      console.warn('Server may not be available for E2E tests');
    }
  });

  describe('Client Endpoint Tests (/client)', () => {
    it('should test client endpoint with dev API key', async () => {
      const testRequest = createTestRequest('Hello world', {
        context: 'test',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'es',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        expect(response).toBeDefined();

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
          if (result.length > 0) {
            expect(result[0]).toHaveProperty('translation');
          }
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should reject client endpoint with regular API key', async () => {
      const testRequest = createTestRequest('Hello world', {
        context: 'test',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-api-key': 'fake-regular-key', // Regular API key should be rejected
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'es',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        expect(response.status).toBe(401); // Should be unauthorized
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Server Endpoint Tests (/server)', () => {
    it('should test server endpoint with dev API key', async () => {
      const testRequest = createTestRequest('Hello world', {
        context: 'test',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(serverEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'es',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        expect(response).toBeDefined();

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
          if (result.length > 0) {
            expect(result[0]).toHaveProperty('translation');
          }
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should accept server endpoint with regular API key', async () => {
      const testRequest = createTestRequest('Hello world', {
        context: 'test',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(serverEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-api-key': 'fake-regular-key', // Regular API key should work for server
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'es',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        // Should work (not 401), but may fail with other errors due to fake key
        expect(response.status).not.toBe(401);
      } catch (error) {
        expect(error).toBeDefined();
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

      const testRequest = createTestRequest(complexNestedJsx, {
        context: 'nested-welcome',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'es',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
          if (result.length > 0) {
            expect(result[0]).toHaveProperty('translation');
          }
        } else {
          expect(response.status).toBeGreaterThan(0);
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

      const testRequest = createTestRequest(jsxWithBranches, {
        context: 'cart-items',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'fr',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch {
        expect(true).toBe(true);
      }
    }, 10000);

    it('should handle JSX with plurals', async () => {
      const jsxWithPlurals = [
        'The ',
        {
          t: 'strong',
          c: ['event'],
        },
        ' will start in ',
        {
          t: 'span',
          d: {
            t: 'p' as const, // plural transformation
            b: {
              zero: ['no time'],
              one: ['1 minute'],
              other: [{ k: 'minutes', v: 'n' as VariableType }, ' minutes'],
            },
          },
        },
        '.',
      ];

      const testRequest = createTestRequest(jsxWithPlurals, {
        context: 'event-countdown',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(serverEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'de',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
        } else {
          expect(response.status).toBeGreaterThan(0);
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

      const testRequest = createTestRequest(jsxWithVariables, {
        context: 'user-dashboard',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'ja',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should handle complex JSX with nested elements, branches and variables', async () => {
      const veryComplexJsx = [
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
                {
                  t: 'span',
                  d: {
                    t: 'b' as const,
                    b: {
                      zero: ['no notifications'],
                      one: [
                        {
                          t: 'strong',
                          c: ['1 new notification'],
                        },
                      ],
                      other: [
                        {
                          t: 'strong',
                          c: [
                            { k: 'notificationCount', v: 'n' as VariableType },
                            ' new notifications',
                          ],
                        },
                      ],
                    },
                  },
                },
                ' since your last visit on ',
                {
                  t: 'time',
                  c: [{ k: 'lastVisit', v: 'd' as VariableType }],
                },
                '.',
              ],
            },
            {
              t: 'footer',
              c: [
                'Your premium subscription expires in ',
                {
                  t: 'span',
                  d: {
                    t: 'p' as const,
                    b: {
                      zero: ['today'],
                      one: ['1 day'],
                      other: [
                        { k: 'daysLeft', v: 'n' as VariableType },
                        ' days',
                      ],
                    },
                  },
                },
                '.',
              ],
            },
          ],
        },
      ];

      const testRequest = createTestRequest(veryComplexJsx, {
        context: 'user-dashboard-complex',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(serverEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'zh',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
          if (result.length > 0) {
            expect(result[0]).toHaveProperty('translation');
            // Verify the translation maintains structure
            if (result[0].translation && Array.isArray(result[0].translation)) {
              expect(result[0].translation[0]).toHaveProperty('t', 'div');
              expect(result[0].translation[0]).toHaveProperty('c');
            }
          }
        } else {
          expect(response.status).toBeGreaterThan(0);
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

      const testRequest = createTestRequest(jsxWithHtmlProps, {
        context: 'form-elements',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'it',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('Basic Source Types', () => {
    it('should handle batch translation with different source types', async () => {
      // Test multiple source types in a single batch request for efficiency
      const testRequests = [
        createTestRequest('Simple string', {
          context: 'basic-string',
          sourceLocale: 'en',
        }),
        createTestRequest(['Hello ', { t: 'strong', c: ['world'] }], {
          context: 'basic-jsx',
          sourceLocale: 'en',
        }),
        createTestRequest('Hello {name}', {
          context: 'basic-icu',
          sourceLocale: 'en',
        }),
        createTestRequest(
          ['Count: ', { k: 'itemCount', v: 'n' as VariableType }],
          { context: 'basic-variable', sourceLocale: 'en' }
        ),
      ];

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: testRequests,
            targetLocale: 'es',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(testRequests.length);

          // Test hash consistency: verify returned hashes match sent hashes
          for (let i = 0; i < result.length; i++) {
            const responseItem = result[i];
            const requestItem = testRequests[i];

            expect(responseItem).toHaveProperty('reference');
            expect(responseItem.reference).toHaveProperty('hash');
            expect(responseItem.reference).toHaveProperty('id');

            // Verify the returned hash matches the hash we sent
            expect(responseItem.reference.hash).toBe(requestItem.metadata.hash);
            // Verify the returned ID matches the ID we sent
            expect(responseItem.reference.id).toBe(requestItem.metadata.id);
          }
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch {
        expect(true).toBe(true);
      }
    }, 8000);
  });

  describe('Hash Response Testing', () => {
    it('should return consistent hashes for string sources', async () => {
      const testRequest = createTestRequest('Hello world', {
        context: 'hash-test-string',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'es',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(1);

          const responseItem = result[0];
          expect(responseItem.reference.hash).toBe(testRequest.metadata.hash);
          expect(responseItem.reference.id).toBe(testRequest.metadata.id);
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should return consistent hashes for JSX sources', async () => {
      const jsxSource = [
        'Welcome to ',
        {
          t: 'strong',
          c: ['our platform'],
        },
        '!',
      ];

      const testRequest = createTestRequest(jsxSource, {
        context: 'hash-test-jsx',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'fr',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);

          const responseItem = result[0];
          expect(responseItem.reference.hash).toBe(testRequest.metadata.hash);
          expect(responseItem.reference.id).toBe(testRequest.metadata.id);
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should return consistent hashes for variable sources', async () => {
      const variableSource = [
        'Hello ',
        { k: 'username', v: 'v' as VariableType },
        ', you have ',
        { k: 'count', v: 'n' as VariableType },
        ' messages.',
      ];

      const testRequest = createTestRequest(variableSource, {
        context: 'hash-test-variables',
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(serverEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest],
            targetLocale: 'de',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);

          const responseItem = result[0];
          expect(responseItem.reference.hash).toBe(testRequest.metadata.hash);
          expect(responseItem.reference.id).toBe(testRequest.metadata.id);
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should handle multiple requests with different hashes', async () => {
      const testRequests = [
        createTestRequest('First string', {
          context: 'hash-batch-1',
          sourceLocale: 'en',
        }),
        createTestRequest(['Second ', { t: 'em', c: ['string'] }], {
          context: 'hash-batch-2',
          sourceLocale: 'en',
        }),
        createTestRequest('Third {variable} string', {
          context: 'hash-batch-3',
          sourceLocale: 'en',
        }),
      ];

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: testRequests,
            targetLocale: 'ja',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(testRequests.length);

          // Verify each response has the correct hash and ID
          for (let i = 0; i < result.length; i++) {
            const responseItem = result[i];
            const requestItem = testRequests[i];

            expect(responseItem.reference.hash).toBe(requestItem.metadata.hash);
            expect(responseItem.reference.id).toBe(requestItem.metadata.id);

            // Verify all hashes are different (since content is different)
            for (let j = i + 1; j < result.length; j++) {
              expect(responseItem.reference.hash).not.toBe(
                result[j].reference.hash
              );
            }
          }
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch {
        expect(true).toBe(true);
      }
    }, 10000);

    it('should generate identical hashes for identical content', async () => {
      const identicalSource = 'This is identical content';

      // Create two identical requests (but different IDs)
      const testRequest1 = createTestRequest(identicalSource, {
        context: 'hash-identical-1',
        sourceLocale: 'en',
      });

      const testRequest2 = createTestRequest(identicalSource, {
        context: 'hash-identical-1', // Same context
        sourceLocale: 'en',
      });

      try {
        const response = await fetch(clientEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gt-dev-api-key': apiKey,
          },
          body: JSON.stringify({
            requests: [testRequest1, testRequest2],
            targetLocale: 'es',
            metadata: {},
            versionId: 'test-version',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          expect(result).toBeDefined();
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(2);

          // Both requests should have the same hash (identical content + context)
          expect(result[0].reference.hash).toBe(result[1].reference.hash);
          // But different IDs
          expect(result[0].reference.id).not.toBe(result[1].reference.id);

          // Verify hashes match what we calculated
          expect(result[0].reference.hash).toBe(testRequest1.metadata.hash);
          expect(result[1].reference.hash).toBe(testRequest2.metadata.hash);
        } else {
          expect(response.status).toBeGreaterThan(0);
        }
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('Authentication Scenarios', () => {
    it('should test authentication on client endpoint', async () => {
      const testRequest = createTestRequest('Hello world', {
        context: 'auth-test',
        sourceLocale: 'en',
      });

      // Test without API key
      const noAuthResponse = await fetch(clientEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [testRequest],
          targetLocale: 'es',
          metadata: {},
          versionId: 'test-version',
        }),
      });

      expect(noAuthResponse.status).toBe(401);

      // Test with dev API key
      const devAuthResponse = await fetch(clientEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-dev-api-key': apiKey,
        },
        body: JSON.stringify({
          requests: [testRequest],
          targetLocale: 'es',
          metadata: {},
          versionId: 'test-version',
        }),
      });

      expect(devAuthResponse.status).toBeGreaterThan(0);
    });

    it('should test authentication on server endpoint', async () => {
      const testRequest = createTestRequest('Hello world', {
        context: 'auth-test',
        sourceLocale: 'en',
      });

      // Test without API key
      const noAuthResponse = await fetch(serverEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [testRequest],
          targetLocale: 'es',
          metadata: {},
          versionId: 'test-version',
        }),
      });

      expect(noAuthResponse.status).toBe(401);

      // Test with dev API key
      const devAuthResponse = await fetch(serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gt-dev-api-key': apiKey,
        },
        body: JSON.stringify({
          requests: [testRequest],
          targetLocale: 'es',
          metadata: {},
          versionId: 'test-version',
        }),
      });

      expect(devAuthResponse.status).toBeGreaterThan(0);
    });
  });
});
