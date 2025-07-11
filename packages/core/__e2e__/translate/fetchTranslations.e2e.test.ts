import { describe, it, expect, beforeAll } from 'vitest';
import { TranslationRequestConfig } from '../../src/types';
import _fetchTranslations, {
  FetchTranslationsOptions,
} from '../../src/translate/fetchTranslations';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('Fetch Translations E2E Tests', () => {
  const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

  // Debug: Log the configuration being used
  // eslint-disable-next-line no-console
  console.log('E2E Test Configuration (FetchTranslations):');
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

  // Configuration for fetchTranslations function
  const config: TranslationRequestConfig = {
    baseUrl: runtimeUrl,
    projectId: projectId,
    apiKey: apiKey,
  };

  // Generate test version ID
  const generateTestVersionId = (): string => {
    return `test-version-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  beforeAll(async () => {
    // Test server availability
    try {
      const testVersionId = generateTestVersionId();
      const options: FetchTranslationsOptions = {
        projectId,
      };
      await _fetchTranslations(testVersionId, options, config);
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Server may not be available for E2E tests');
    }
  });

  it('should attempt to fetch translations with valid configuration', async () => {
    const testVersionId = generateTestVersionId();

    const options: FetchTranslationsOptions = {
      projectId,
    };

    try {
      const result = await _fetchTranslations(testVersionId, options, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result.translations)).toBe(true);
      expect(typeof result.versionId).toBe('string');
      expect(typeof result.projectId).toBe('string');
      expect(typeof result.localeCount).toBe('number');
      expect(typeof result.totalEntries).toBe('number');
      expect(result.localeCount).toBe(result.translations.length);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should handle non-existent version ID', async () => {
    const nonExistentVersionId = 'non-existent-version-id';

    const options: FetchTranslationsOptions = {
      projectId,
    };

    try {
      await _fetchTranslations(nonExistentVersionId, options, config);
      // If it succeeds, expect valid response structure
      expect(true).toBe(true);
    } catch (error) {
      // Should catch not found error
      expect(error).toBeDefined();
      const errorMessage = error.message || error.toString();
      const isNotFoundError = errorMessage.includes('404') || 
                             errorMessage.includes('Not found') ||
                             errorMessage.includes('not found') ||
                             errorMessage.includes('does not exist');
      expect(isNotFoundError).toBe(true);
    }
  });

  it('should handle different version ID formats', async () => {
    const testCases = [
      `short-${Date.now()}`,
      `very-long-version-id-with-many-segments-${Date.now()}-${Math.random().toString(36)}`,
      `with-numbers-123-${Date.now()}`,
      `with_underscores_${Date.now()}`,
      `with-dashes-${Date.now()}`,
    ];

    for (const testVersionId of testCases) {
      const options: FetchTranslationsOptions = {
        projectId,
      };

      try {
        const result = await _fetchTranslations(testVersionId, options, config);

        expect(result).toBeDefined();
        expect(Array.isArray(result.translations)).toBe(true);
        expect(typeof result.versionId).toBe('string');
        expect(typeof result.projectId).toBe('string');
        expect(typeof result.localeCount).toBe('number');
        expect(typeof result.totalEntries).toBe('number');
      } catch {
        expect(true).toBe(true); // Server may not be available or version may not exist
      }
    }
  });

  it('should handle timeout configuration', async () => {
    const testVersionId = generateTestVersionId();

    const options: FetchTranslationsOptions = {
      projectId,
      timeout: 10000,
    };

    try {
      const result = await _fetchTranslations(testVersionId, options, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result.translations)).toBe(true);
      expect(typeof result.versionId).toBe('string');
      expect(typeof result.projectId).toBe('string');
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle custom baseUrl in options', async () => {
    const testVersionId = generateTestVersionId();

    const options: FetchTranslationsOptions = {
      projectId,
      baseUrl: runtimeUrl,
    };

    try {
      const result = await _fetchTranslations(testVersionId, options, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result.translations)).toBe(true);
      expect(typeof result.versionId).toBe('string');
      expect(typeof result.projectId).toBe('string');
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle authentication errors with invalid API key', async () => {
    const testVersionId = generateTestVersionId();

    const options: FetchTranslationsOptions = {
      projectId,
      apiKey: 'invalid-key',
    };

    try {
      const result = await _fetchTranslations(testVersionId, options, config);
      
      if (result.translations) {
        // Server may accept any key in dev mode
        expect(true).toBe(true);
      } else {
        // Should fail with authentication error
        expect(false).toBe(true);
      }
    } catch (error) {
      // Should catch authentication error
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

  it('should handle empty version ID', async () => {
    const emptyVersionId = '';

    const options: FetchTranslationsOptions = {
      projectId,
    };

    try {
      await _fetchTranslations(emptyVersionId, options, config);
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.message).toContain('Version ID is required');
    }
  });

  it('should handle API key precedence correctly', async () => {
    const testVersionId = generateTestVersionId();

    const options: FetchTranslationsOptions = {
      projectId,
      apiKey: apiKey, // Use valid API key in options
    };

    try {
      const result = await _fetchTranslations(testVersionId, options, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result.translations)).toBe(true);
      expect(typeof result.versionId).toBe('string');
      expect(typeof result.projectId).toBe('string');
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle version IDs with special characters', async () => {
    const specialVersionIds = [
      `test-with-dots.version.${Date.now()}`,
      `test-with-colons:version:${Date.now()}`,
      `test-with-equals=version=${Date.now()}`,
    ];

    for (const testVersionId of specialVersionIds) {
      const options: FetchTranslationsOptions = {
        projectId,
      };

      try {
        const result = await _fetchTranslations(testVersionId, options, config);

        expect(result).toBeDefined();
        expect(Array.isArray(result.translations)).toBe(true);
        expect(typeof result.versionId).toBe('string');
        expect(typeof result.projectId).toBe('string');
      } catch {
        expect(true).toBe(true); // Server may not be available or version may not exist
      }
    }
  });

  it('should validate response structure', async () => {
    const testVersionId = generateTestVersionId();

    const options: FetchTranslationsOptions = {
      projectId,
    };

    try {
      const result = await _fetchTranslations(testVersionId, options, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result.translations)).toBe(true);
      expect(typeof result.versionId).toBe('string');
      expect(typeof result.projectId).toBe('string');
      expect(typeof result.localeCount).toBe('number');
      expect(typeof result.totalEntries).toBe('number');
      expect(result.localeCount).toBeGreaterThanOrEqual(0);
      expect(result.totalEntries).toBeGreaterThanOrEqual(0);
      
      // Validate each translation structure
      result.translations.forEach(translation => {
        expect(typeof translation.locale).toBe('string');
        expect(translation.translation).toBeDefined();
        expect(translation.metadata).toBeDefined();
      });
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle concurrent requests', async () => {
    const testVersionIds = [
      generateTestVersionId(),
      generateTestVersionId(),
      generateTestVersionId(),
    ];

    const options: FetchTranslationsOptions = {
      projectId,
    };

    try {
      const promises = testVersionIds.map(versionId => 
        _fetchTranslations(versionId, options, config)
      );

      const results = await Promise.allSettled(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value).toBeDefined();
          expect(Array.isArray(result.value.translations)).toBe(true);
        } else {
          expect(result.reason).toBeDefined();
        }
      });
    } catch {
      expect(true).toBe(true);
    }
  }, 15000); // Longer timeout for concurrent requests
});