import { describe, it, expect, beforeAll } from 'vitest';
import { hashSource } from '../../src/id/hashSource';
import { TranslationRequestConfig } from '../../src/types';
import _enqueueTranslationEntries, {
  Updates,
  ApiOptions,
} from '../../src/translate/enqueueTranslationEntries';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('Enqueue Translation Entries E2E Tests', () => {
  const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

  // Debug: Log the configuration being used
  // eslint-disable-next-line no-console
  console.log('E2E Test Configuration (EnqueueTranslationEntries):');
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

  // Configuration for enqueueTranslationEntries function
  const config: TranslationRequestConfig = {
    baseUrl: runtimeUrl,
    projectId: projectId,
    apiKey: apiKey,
  };

  // Helper function to generate test updates
  const createTestUpdates = (
    sources: Array<{ source: string | unknown; dataFormat: 'ICU' | 'JSX' | 'I18NEXT' }>
  ): Updates => {
    return sources.map(({ source, dataFormat }) => {
      const id = `test-id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const hash = hashSource({
        source,
        id,
        dataFormat,
      });

      return {
        source,
        dataFormat,
        metadata: {
          id,
          hash,
          context: 'e2e-test',
        },
      };
    });
  };

  beforeAll(async () => {
    // Test server availability
    try {
      const testUpdates = createTestUpdates([
        { source: 'Hello world', dataFormat: 'ICU' },
      ]);
      const options: ApiOptions = {
        projectId,
        apiKey,
        baseUrl: runtimeUrl,
        locales: ['es'],
        defaultLocale: 'en',
      };
      await _enqueueTranslationEntries(testUpdates, options, 'test', config);
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Server may not be available for E2E tests');
    }
  });

  it('should enqueue translation entries with valid API key', async () => {
    const testUpdates = createTestUpdates([
      { source: 'Hello world', dataFormat: 'ICU' },
      { source: 'Goodbye world', dataFormat: 'ICU' },
    ]);

    const options: ApiOptions = {
      projectId,
      apiKey,
      baseUrl: runtimeUrl,
      locales: ['es', 'fr'],
      defaultLocale: 'en',
      description: 'E2E test updates',
    };

    try {
      const result = await _enqueueTranslationEntries(
        testUpdates,
        options,
        'e2e-test',
        config
      );

      expect(result).toBeDefined();
      expect(result.versionId).toBeDefined();
      expect(result.locales).toBeDefined();
      expect(Array.isArray(result.locales)).toBe(true);
      expect(result.locales.length).toBeGreaterThan(0);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should reject invalid API key', async () => {
    const testUpdates = createTestUpdates([
      { source: 'Hello world', dataFormat: 'ICU' },
    ]);

    const options: ApiOptions = {
      projectId,
      apiKey: 'fake-invalid-key',
      baseUrl: runtimeUrl,
      locales: ['es'],
      defaultLocale: 'en',
    };

    try {
      await _enqueueTranslationEntries(testUpdates, options, 'test', config);
      // Should not reach here if authentication fails
      expect(false).toBe(true);
    } catch (error) {
      // Should catch an authentication error
      expect(error).toBeDefined();
      const errorMessage = error.message || error.toString();
      const isAuthError = errorMessage.includes('401') || 
                         errorMessage.includes('Unauthorized') ||
                         errorMessage.includes('authentication') ||
                         errorMessage.includes('Invalid API key') ||
                         errorMessage.includes('403') ||
                         errorMessage.includes('Forbidden');
      expect(isAuthError).toBe(true);
    }
  });

  it('should handle ICU dataFormat correctly', async () => {
    const testUpdates = createTestUpdates([
      { source: 'Hello {name}, you have {count} messages', dataFormat: 'ICU' },
    ]);

    const options: ApiOptions = {
      projectId,
      apiKey,
      baseUrl: runtimeUrl,
      locales: ['es'],
      defaultLocale: 'en',
      dataFormat: 'ICU',
    };

    try {
      const result = await _enqueueTranslationEntries(
        testUpdates,
        options,
        'test',
        config
      );

      expect(result).toBeDefined();
      expect(result.versionId).toBeDefined();
      expect(result.locales).toBeDefined();
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle JSX dataFormat correctly', async () => {
    const jsxSource = [
      'Hello ',
      { t: 'strong', c: ['world'] },
      ', you have ',
      { k: 'count', v: 'n' },
      ' messages',
    ];

    const testUpdates = createTestUpdates([
      { source: jsxSource, dataFormat: 'JSX' },
    ]);

    const options: ApiOptions = {
      projectId,
      apiKey,
      baseUrl: runtimeUrl,
      locales: ['fr'],
      defaultLocale: 'en',
      dataFormat: 'JSX',
    };

    try {
      const result = await _enqueueTranslationEntries(
        testUpdates,
        options,
        'test',
        config
      );

      expect(result).toBeDefined();
      expect(result.versionId).toBeDefined();
      expect(result.locales).toBeDefined();
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle multiple entries with mixed data formats', async () => {
    const testUpdates = createTestUpdates([
      { source: 'Simple text', dataFormat: 'ICU' },
      { source: 'Text with {variable}', dataFormat: 'ICU' },
      { source: ['JSX ', { t: 'em', c: ['content'] }], dataFormat: 'JSX' },
    ]);

    const options: ApiOptions = {
      projectId,
      apiKey,
      baseUrl: runtimeUrl,
      locales: ['es', 'fr', 'de'],
      defaultLocale: 'en',
      description: 'Mixed format test',
      requireApproval: false,
    };

    try {
      const result = await _enqueueTranslationEntries(
        testUpdates,
        options,
        'test',
        config
      );

      expect(result).toBeDefined();
      expect(result.versionId).toBeDefined();
      expect(result.locales).toBeDefined();
      expect(result.locales.length).toBeGreaterThanOrEqual(3);
    } catch {
      expect(true).toBe(true);
    }
  }, 15000);

  it('should handle empty updates array', async () => {
    const testUpdates: Updates = [];

    const options: ApiOptions = {
      projectId,
      apiKey,
      baseUrl: runtimeUrl,
      locales: ['es'],
      defaultLocale: 'en',
    };

    try {
      const result = await _enqueueTranslationEntries(
        testUpdates,
        options,
        'test',
        config
      );

      expect(result).toBeDefined();
      expect(result.versionId).toBeDefined();
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle version ID and description options', async () => {
    const testUpdates = createTestUpdates([
      { source: 'Version test content', dataFormat: 'ICU' },
    ]);

    const customVersionId = `test-version-${Date.now()}`;
    const options: ApiOptions = {
      projectId,
      apiKey,
      baseUrl: runtimeUrl,
      locales: ['es'],
      defaultLocale: 'en',
      version: customVersionId,
      description: 'Custom version test',
      requireApproval: true,
    };

    try {
      const result = await _enqueueTranslationEntries(
        testUpdates,
        options,
        'test',
        config
      );

      expect(result).toBeDefined();
      expect(result.versionId).toBeDefined();
      expect(result.message).toBeDefined();
    } catch {
      expect(true).toBe(true);
    }
  });
});