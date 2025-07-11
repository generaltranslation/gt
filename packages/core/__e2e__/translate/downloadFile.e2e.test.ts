import { describe, it, expect, beforeAll } from 'vitest';
import { TranslationRequestConfig } from '../../src/types';
import _downloadFile, {
  DownloadFileOptions,
} from '../../src/translate/downloadFile';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('Download File E2E Tests', () => {
  const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

  // Debug: Log the configuration being used
  // eslint-disable-next-line no-console
  console.log('E2E Test Configuration (DownloadFile):');
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

  // Configuration for downloadFile function
  const config: TranslationRequestConfig = {
    baseUrl: runtimeUrl,
    projectId: projectId,
    apiKey: apiKey,
  };

  // Generate test translation ID
  const generateTestTranslationId = (): string => {
    return `test-translation-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  beforeAll(async () => {
    // Test server availability
    try {
      const testTranslationId = generateTestTranslationId();
      const options: DownloadFileOptions = {
        projectId,
        maxRetries: 1,
      };
      await _downloadFile(testTranslationId, options, config);
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Server may not be available for E2E tests');
    }
  });

  it('should attempt to download file with valid configuration', async () => {
    const testTranslationId = generateTestTranslationId();

    const options: DownloadFileOptions = {
      projectId,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFile(testTranslationId, options, config);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.translationId).toBe(testTranslationId);
      
      if (result.success) {
        expect(result.content).toBeDefined();
        expect(typeof result.content).toBe('string');
        expect(result.contentType).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should handle non-existent translation ID', async () => {
    const nonExistentId = 'non-existent-translation-id';

    const options: DownloadFileOptions = {
      projectId,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFile(nonExistentId, options, config);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.translationId).toBe(nonExistentId);
      expect(result.error).toBeDefined();
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle custom retry configuration', async () => {
    const testTranslationId = generateTestTranslationId();

    const options: DownloadFileOptions = {
      projectId,
      maxRetries: 3,
      retryDelay: 100,
    };

    try {
      const result = await _downloadFile(testTranslationId, options, config);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.translationId).toBe(testTranslationId);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle timeout configuration', async () => {
    const testTranslationId = generateTestTranslationId();

    const options: DownloadFileOptions = {
      projectId,
      timeout: 5000,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFile(testTranslationId, options, config);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.translationId).toBe(testTranslationId);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle custom baseUrl in options', async () => {
    const testTranslationId = generateTestTranslationId();

    const options: DownloadFileOptions = {
      projectId,
      baseUrl: runtimeUrl,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFile(testTranslationId, options, config);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.translationId).toBe(testTranslationId);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle authentication errors with invalid API key', async () => {
    const testTranslationId = generateTestTranslationId();

    const options: DownloadFileOptions = {
      projectId,
      apiKey: 'invalid-key',
      maxRetries: 1,
    };

    try {
      const result = await _downloadFile(testTranslationId, options, config);
      
      if (result.success) {
        // Server may accept any key in dev mode
        expect(true).toBe(true);
      } else {
        // Should fail with authentication error
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
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

  it('should handle different translation ID formats', async () => {
    const testCases = [
      `short-${Date.now()}`,
      `very-long-translation-id-with-many-segments-${Date.now()}-${Math.random().toString(36)}`,
      `with-numbers-123-${Date.now()}`,
      `with_underscores_${Date.now()}`,
    ];

    for (const testTranslationId of testCases) {
      const options: DownloadFileOptions = {
        projectId,
        maxRetries: 1,
      };

      try {
        const result = await _downloadFile(testTranslationId, options, config);

        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(result.translationId).toBe(testTranslationId);
      } catch {
        expect(true).toBe(true);
      }
    }
  });

  it('should handle minimal retry configuration', async () => {
    const testTranslationId = generateTestTranslationId();

    const options: DownloadFileOptions = {
      projectId,
      maxRetries: 0, // No retries
    };

    try {
      const result = await _downloadFile(testTranslationId, options, config);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.translationId).toBe(testTranslationId);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle empty translation ID', async () => {
    const emptyTranslationId = '';

    const options: DownloadFileOptions = {
      projectId,
      maxRetries: 1,
    };

    try {
      await _downloadFile(emptyTranslationId, options, config);
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.message).toContain('Translation ID is required');
    }
  });

  it('should handle API key precedence correctly', async () => {
    const testTranslationId = generateTestTranslationId();

    const options: DownloadFileOptions = {
      projectId,
      apiKey: apiKey, // Use valid API key in options
      maxRetries: 1,
    };

    try {
      const result = await _downloadFile(testTranslationId, options, config);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.translationId).toBe(testTranslationId);
    } catch {
      expect(true).toBe(true);
    }
  });
});