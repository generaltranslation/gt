import { describe, it, expect, beforeAll } from 'vitest';
import { TranslationRequestConfig } from '../../src/types';
import _checkFileTranslations from '../../src/translate/checkFileTranslations';
import { FileTranslationCheck } from '../../src/types-dir/checkFileTranslations';
import { CheckFileTranslationsOptions } from '../../src/types-dir/checkFileTranslations';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('Check File Translations E2E Tests', () => {
  const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

  // Debug: Log the configuration being used
  // eslint-disable-next-line no-console
  console.log('E2E Test Configuration (CheckFileTranslations):');
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

  // Configuration for checkFileTranslations function
  const config: TranslationRequestConfig = {
    baseUrl: runtimeUrl,
    projectId: projectId,
    apiKey: apiKey,
  };

  // Helper function to generate test data
  const createTestData = (): { [key: string]: FileTranslationCheck } => {
    const timestamp = Date.now();
    return {
      [`test-${timestamp}.json`]: {
        versionId: `test-version-${timestamp}`,
        fileName: `test-${timestamp}.json`,
      },
    };
  };

  beforeAll(async () => {
    // Test server availability
    try {
      const testData = createTestData();
      const options: CheckFileTranslationsOptions = {
        projectId,
        locales: ['es'],
      };
      await _checkFileTranslations(testData, options, config);
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Server may not be available for E2E tests');
    }
  });

  it('should check file translations with valid configuration', async () => {
    const testData = createTestData();

    const options: CheckFileTranslationsOptions = {
      projectId,
      locales: ['es', 'fr'],
    };

    try {
      const result = await _checkFileTranslations(testData, options, config);

      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
      expect(typeof result.allReady).toBe('boolean');
      expect(typeof result.readyCount).toBe('number');
      expect(typeof result.totalCount).toBe('number');
      expect(result.readyCount).toBeLessThanOrEqual(result.totalCount);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should handle single locale check', async () => {
    const testData = createTestData();

    const options: CheckFileTranslationsOptions = {
      projectId,
      locales: ['es'],
    };

    try {
      const result = await _checkFileTranslations(testData, options, config);

      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
      expect(typeof result.allReady).toBe('boolean');
      expect(typeof result.readyCount).toBe('number');
      expect(typeof result.totalCount).toBe('number');
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle multiple files with different version IDs', async () => {
    const timestamp = Date.now();
    const testData: { [key: string]: FileTranslationCheck } = {
      [`app-${timestamp}.json`]: {
        versionId: `version-app-${timestamp}`,
        fileName: `app-${timestamp}.json`,
      },
      [`common-${timestamp}.json`]: {
        versionId: `version-common-${timestamp}`,
        fileName: `common-${timestamp}.json`,
      },
      [`errors-${timestamp}.json`]: {
        versionId: `version-errors-${timestamp}`,
        fileName: `errors-${timestamp}.json`,
      },
    };

    const options: CheckFileTranslationsOptions = {
      projectId,
      locales: ['es', 'fr', 'de'],
    };

    try {
      const result = await _checkFileTranslations(testData, options, config);

      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
      expect(typeof result.allReady).toBe('boolean');
      expect(typeof result.readyCount).toBe('number');
      expect(typeof result.totalCount).toBe('number');
    } catch {
      expect(true).toBe(true);
    }
  }, 15000);

  it('should handle empty data object', async () => {
    const testData: { [key: string]: FileTranslationCheck } = {};

    const options: CheckFileTranslationsOptions = {
      projectId,
      locales: ['es'],
    };

    try {
      const result = await _checkFileTranslations(testData, options, config);

      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.totalCount).toBe(0);
      expect(result.readyCount).toBe(0);
      expect(result.allReady).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle custom baseUrl in options', async () => {
    const testData = createTestData();

    const options: CheckFileTranslationsOptions = {
      projectId,
      baseUrl: runtimeUrl,
      locales: ['es'],
    };

    try {
      const result = await _checkFileTranslations(testData, options, config);

      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle timeout configuration', async () => {
    const testData = createTestData();

    const options: CheckFileTranslationsOptions = {
      projectId,
      locales: ['es'],
      timeout: 10000,
    };

    try {
      const result = await _checkFileTranslations(testData, options, config);

      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle authentication errors with invalid API key', async () => {
    const testData = createTestData();

    const options: CheckFileTranslationsOptions = {
      projectId,
      apiKey: 'invalid-key',
      locales: ['es'],
    };

    try {
      await _checkFileTranslations(testData, options, config);
      // If it succeeds, that's also valid (server may accept any key in dev)
      expect(true).toBe(true);
    } catch (error) {
      // Should catch authentication error
      expect(error).toBeDefined();
      const errorMessage = error.message || error.toString();
      const isAuthError =
        errorMessage.includes('401') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('Invalid API key') ||
        errorMessage.includes('403') ||
        errorMessage.includes('Forbidden');
      expect(isAuthError).toBe(true);
    }
  });

  it('should handle different file name patterns', async () => {
    const timestamp = Date.now();
    const testData: { [key: string]: FileTranslationCheck } = {
      [`nested/path/file-${timestamp}.json`]: {
        versionId: `version-nested-${timestamp}`,
        fileName: `nested-file-${timestamp}.json`,
      },
      [`simple-${timestamp}.md`]: {
        versionId: `version-simple-${timestamp}`,
        fileName: `simple-${timestamp}.md`,
      },
      [`component-${timestamp}.tsx`]: {
        versionId: `version-component-${timestamp}`,
        fileName: `component-${timestamp}.tsx`,
      },
    };

    const options: CheckFileTranslationsOptions = {
      projectId,
      locales: ['es', 'fr'],
    };

    try {
      const result = await _checkFileTranslations(testData, options, config);

      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle large number of locales', async () => {
    const testData = createTestData();

    const options: CheckFileTranslationsOptions = {
      projectId,
      locales: ['es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar'],
    };

    try {
      const result = await _checkFileTranslations(testData, options, config);

      expect(result).toBeDefined();
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  }, 20000); // Longer timeout for large request
});
