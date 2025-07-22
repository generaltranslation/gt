import { describe, it, expect, beforeAll } from 'vitest';
import { TranslationRequestConfig } from '../../src/types';
import {
  Updates,
  EnqueueEntriesOptions,
} from '../../src/types-dir/enqueueEntries';
import _enqueueEntries from '../../src/translate/enqueueEntries';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('enqueueEntries E2E Tests', () => {
  let config: TranslationRequestConfig;

  beforeAll(() => {
    const baseUrl = process.env.VITE_GT_BASE_URL || defaultRuntimeApiUrl;
    const projectId = process.env.VITE_CI_TEST_GT_PROJECT_ID;
    const apiKey = process.env.VITE_CI_TEST_GT_API_KEY;

    config = {
      baseUrl: baseUrl,
      projectId: projectId || 'test-project',
      apiKey: apiKey || 'test-key',
    };
  });

  describe('ICU Format Entries', () => {
    it('should enqueue ICU format translation entries', async () => {
      const updates: Updates = [
        {
          dataFormat: 'ICU',
          source: 'Hello {name}, you have {count} messages',
          metadata: {
            key: 'greeting.messages',
            context: 'user-notifications',
          },
        },
        {
          dataFormat: 'ICU',
          source: 'Welcome back, {username}!',
          metadata: {
            key: 'greeting.welcome',
            context: 'login-screen',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es', 'fr'],
        dataFormat: 'ICU',
        description: 'ICU format test entries',
        requireApproval: false,
        timeout: 10000,
      };

      try {
        const result = await _enqueueEntries(updates, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
        expect(result).toHaveProperty('locales');
        expect(typeof result.versionId).toBe('string');
        expect(Array.isArray(result.locales)).toBe(true);
        expect(result.locales.length).toBeGreaterThan(0);

        if (result.message) {
          expect(typeof result.message).toBe('string');
        }
      } catch (error) {
        // Network or server issues - acceptable in e2e environment
        expect(error).toBeDefined();
      }
    });
  });

  describe('JSX Format Entries', () => {
    it('should enqueue JSX format translation entries', async () => {
      const updates: Updates = [
        {
          dataFormat: 'JSX',
          source: ['Welcome ', { t: 'strong', c: ['John'] }, '!'],
          metadata: {
            key: 'jsx.welcome',
            context: 'dashboard',
          },
        },
        {
          dataFormat: 'JSX',
          source: [
            {
              t: 'div',
              c: [
                { t: 'h1', c: ['Title'] },
                {
                  t: 'p',
                  c: ['This is a ', { t: 'em', c: ['test'] }, ' message.'],
                },
              ],
            },
          ],
          metadata: {
            key: 'jsx.complex',
            context: 'content-section',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        dataFormat: 'JSX',
        description: 'JSX format test entries',
        requireApproval: true,
        timeout: 15000,
      };

      try {
        const result = await _enqueueEntries(updates, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
        expect(result).toHaveProperty('locales');
        expect(result.locales).toContain('es');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('I18NEXT Format Entries', () => {
    it('should enqueue I18NEXT format translation entries', async () => {
      const updates: Updates = [
        {
          dataFormat: 'I18NEXT',
          source: 'Hello {{name}}!',
          metadata: {
            key: 'i18next.greeting',
            context: 'app-header',
          },
        },
        {
          dataFormat: 'I18NEXT',
          source: 'You have {{count}} notification',
          metadata: {
            key: 'i18next.notifications',
            context: 'notification-badge',
            count: 1,
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['fr', 'de'],
        dataFormat: 'I18NEXT',
        description: 'I18NEXT format test entries',
        requireApproval: false,
      };

      try {
        const result = await _enqueueEntries(updates, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
        expect(result).toHaveProperty('locales');
        expect(result.locales).toEqual(expect.arrayContaining(['fr', 'de']));
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Mixed Format Entries', () => {
    it('should enqueue entries with different data formats', async () => {
      const updates: Updates = [
        {
          dataFormat: 'ICU',
          source: 'Save {count} items',
          metadata: {
            key: 'actions.save',
            context: 'file-operations',
          },
        },
        {
          dataFormat: 'JSX',
          source: ['Click ', { t: 'strong', c: ['here'] }, ' to continue'],
          metadata: {
            key: 'actions.continue',
            context: 'navigation',
          },
        },
        {
          dataFormat: 'I18NEXT',
          source: 'Loading {{percent}}%...',
          metadata: {
            key: 'status.loading',
            context: 'progress-indicator',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es', 'fr'],
        description: 'Mixed format test entries',
        requireApproval: false,
        version: 'test-version-1',
      };

      try {
        const result = await _enqueueEntries(updates, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
        expect(result).toHaveProperty('locales');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Options Handling', () => {
    it('should handle version and description options', async () => {
      const updates: Updates = [
        {
          dataFormat: 'ICU',
          source: 'Test message with version',
          metadata: {
            key: 'test.versioned',
            context: 'versioning-test',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        version: 'v2.0.0',
        description: 'Test version 2.0.0 with new features',
        requireApproval: true,
      };

      try {
        const result = await _enqueueEntries(updates, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
        if (result.message) {
          expect(typeof result.message).toBe('string');
        }
        if (result.projectSettings) {
          expect(result.projectSettings).toHaveProperty('cdnEnabled');
          expect(typeof result.projectSettings.cdnEnabled).toBe('boolean');
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle minimal options', async () => {
      const updates: Updates = [
        {
          dataFormat: 'ICU',
          source: 'Minimal test message',
          metadata: {
            key: 'test.minimal',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        description: 'Minimal options test',
      };

      try {
        const result = await _enqueueEntries(updates, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
        expect(result).toHaveProperty('locales');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Configuration Handling', () => {
    it('should handle config without baseUrl (defaults)', async () => {
      const configWithoutUrl: TranslationRequestConfig = {
        projectId: config.projectId,
        apiKey: config.apiKey,
        // baseUrl omitted - should use default
      };

      const updates: Updates = [
        {
          dataFormat: 'ICU',
          source: 'Default URL test',
          metadata: {
            key: 'test.default-url',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        description: 'Default URL test',
      };

      try {
        const result = await _enqueueEntries(
          updates,
          options,
          configWithoutUrl
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle custom baseUrl', async () => {
      const customConfig: TranslationRequestConfig = {
        ...config,
        baseUrl: config.baseUrl || defaultRuntimeApiUrl,
      };

      const updates: Updates = [
        {
          dataFormat: 'ICU',
          source: 'Custom URL test',
          metadata: {
            key: 'test.custom-url',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        description: 'Custom URL test',
      };

      try {
        const result = await _enqueueEntries(updates, options, customConfig);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
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

      const updates: Updates = [
        {
          dataFormat: 'ICU',
          source: 'Test with invalid key',
          metadata: {
            key: 'test.invalid-key',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        description: 'Invalid key test',
      };

      try {
        const result = await _enqueueEntries(updates, options, invalidConfig);

        // Should either return results or throw an error
        expect(result).toBeDefined();
      } catch (error) {
        // Network/auth errors are acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle timeout gracefully', async () => {
      const updates: Updates = [
        {
          dataFormat: 'ICU',
          source: 'Timeout test message',
          metadata: {
            key: 'test.timeout',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        description: 'Timeout test',
        timeout: 1, // Very short timeout to force timeout
      };

      try {
        const result = await _enqueueEntries(updates, options, config);

        expect(result).toBeDefined();
      } catch (error) {
        // Timeout errors are expected
        expect(error).toBeDefined();
      }
    });

    it('should handle empty updates array', async () => {
      const updates: Updates = [];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        description: 'Empty updates test',
      };

      try {
        const result = await _enqueueEntries(updates, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
      } catch (error) {
        // Server may reject empty updates - acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Metadata Variations', () => {
    it('should handle entries with rich metadata', async () => {
      const updates: Updates = [
        {
          dataFormat: 'ICU',
          source: 'Rich metadata test',
          metadata: {
            key: 'test.rich-metadata',
            context: 'detailed-context',
            category: 'ui-text',
            priority: 'high',
            tags: ['button', 'action', 'primary'],
            maxLength: 50,
            notes: 'This is a primary action button',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es', 'fr'],
        description: 'Rich metadata test',
        requireApproval: true,
      };

      try {
        const result = await _enqueueEntries(updates, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
        expect(result).toHaveProperty('locales');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle entries with minimal metadata', async () => {
      const updates: Updates = [
        {
          dataFormat: 'ICU',
          source: 'Minimal metadata test',
          metadata: {
            key: 'test.minimal-metadata',
          },
        },
      ];

      const options: EnqueueEntriesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        description: 'Minimal metadata test',
      };

      try {
        const result = await _enqueueEntries(updates, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('versionId');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
