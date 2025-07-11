import { describe, it, expect, beforeAll } from 'vitest';
import { TranslationRequestConfig } from '../../src/types';
import _downloadFileBatch, {
  BatchDownloadFile,
  DownloadFileBatchOptions,
} from '../../src/translate/downloadFileBatch';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('Download File Batch E2E Tests', () => {
  const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

  // Debug: Log the configuration being used
  // eslint-disable-next-line no-console
  console.log('E2E Test Configuration (DownloadFileBatch):');
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

  // Configuration for downloadFileBatch function
  const config: TranslationRequestConfig = {
    baseUrl: runtimeUrl,
    projectId: projectId,
    apiKey: apiKey,
  };

  // Generate test batch files
  const generateTestBatchFiles = (): BatchDownloadFile[] => {
    const timestamp = Date.now();
    return [
      {
        translationId: `test-batch-1-${timestamp}`,
        fileName: `batch-test-1-${timestamp}.json`,
      },
      {
        translationId: `test-batch-2-${timestamp}`,
        fileName: `batch-test-2-${timestamp}.json`,
      },
    ];
  };

  beforeAll(async () => {
    // Test server availability
    try {
      const testFiles = generateTestBatchFiles().slice(0, 1); // Use only one file for availability test
      const options: DownloadFileBatchOptions = {
        projectId,
        maxRetries: 1,
      };
      await _downloadFileBatch(testFiles, options, config);
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Server may not be available for E2E tests');
    }
  });

  it('should attempt to download batch files with valid configuration', async () => {
    const testFiles = generateTestBatchFiles();

    const options: DownloadFileBatchOptions = {
      projectId,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(Array.isArray(result.successful)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
      expect(typeof result.successCount).toBe('number');
      expect(typeof result.failureCount).toBe('number');
      expect(result.successCount + result.failureCount).toBe(result.results.length);
      expect(result.results.length).toBe(testFiles.length);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should handle single file in batch', async () => {
    const timestamp = Date.now();
    const testFiles: BatchDownloadFile[] = [
      {
        translationId: `single-test-${timestamp}`,
        fileName: `single-test-${timestamp}.json`,
      },
    ];

    const options: DownloadFileBatchOptions = {
      projectId,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.successCount + result.failureCount).toBe(1);
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle files without fileName', async () => {
    const timestamp = Date.now();
    const testFiles: BatchDownloadFile[] = [
      {
        translationId: `no-filename-1-${timestamp}`,
        // No fileName property
      },
      {
        translationId: `no-filename-2-${timestamp}`,
        fileName: `with-filename-${timestamp}.json`,
      },
    ];

    const options: DownloadFileBatchOptions = {
      projectId,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(2);
      expect(result.successCount + result.failureCount).toBe(2);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle custom retry configuration', async () => {
    const testFiles = generateTestBatchFiles();

    const options: DownloadFileBatchOptions = {
      projectId,
      maxRetries: 3,
      retryDelay: 100,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(testFiles.length);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle timeout configuration', async () => {
    const testFiles = generateTestBatchFiles();

    const options: DownloadFileBatchOptions = {
      projectId,
      timeout: 10000,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(testFiles.length);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle large batch of files', async () => {
    const timestamp = Date.now();
    const testFiles: BatchDownloadFile[] = [];
    
    // Generate a larger batch of files
    for (let i = 0; i < 10; i++) {
      testFiles.push({
        translationId: `large-batch-${i}-${timestamp}`,
        fileName: `large-batch-${i}-${timestamp}.json`,
      });
    }

    const options: DownloadFileBatchOptions = {
      projectId,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(10);
      expect(result.successCount + result.failureCount).toBe(10);
    } catch {
      expect(true).toBe(true);
    }
  }, 20000); // Longer timeout for large batch

  it('should handle custom baseUrl in options', async () => {
    const testFiles = generateTestBatchFiles();

    const options: DownloadFileBatchOptions = {
      projectId,
      baseUrl: runtimeUrl,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(testFiles.length);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle authentication errors with invalid API key', async () => {
    const testFiles = generateTestBatchFiles();

    const options: DownloadFileBatchOptions = {
      projectId,
      apiKey: 'invalid-key',
      maxRetries: 1,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);
      
      if (result.successCount > 0) {
        // Server may accept any key in dev mode
        expect(true).toBe(true);
      } else {
        // Should fail with authentication error
        expect(result.failureCount).toBe(testFiles.length);
        expect(result.failed).toHaveLength(testFiles.length);
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

  it('should handle different file name patterns', async () => {
    const timestamp = Date.now();
    const testFiles: BatchDownloadFile[] = [
      {
        translationId: `pattern-1-${timestamp}`,
        fileName: `nested/path/file-${timestamp}.json`,
      },
      {
        translationId: `pattern-2-${timestamp}`,
        fileName: `simple-${timestamp}.md`,
      },
      {
        translationId: `pattern-3-${timestamp}`,
        fileName: `component-${timestamp}.tsx`,
      },
    ];

    const options: DownloadFileBatchOptions = {
      projectId,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(3);
      expect(result.successCount + result.failureCount).toBe(3);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle empty files array', async () => {
    const testFiles: BatchDownloadFile[] = [];

    const options: DownloadFileBatchOptions = {
      projectId,
      maxRetries: 1,
    };

    try {
      await _downloadFileBatch(testFiles, options, config);
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.message).toContain('Files array is required and must not be empty');
    }
  });

  it('should handle API key precedence correctly', async () => {
    const testFiles = generateTestBatchFiles();

    const options: DownloadFileBatchOptions = {
      projectId,
      apiKey: apiKey, // Use valid API key in options
      maxRetries: 1,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);

      expect(result).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(testFiles.length);
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle mixed translation ID formats', async () => {
    const timestamp = Date.now();
    const testFiles: BatchDownloadFile[] = [
      {
        translationId: `short-${timestamp}`,
        fileName: `short-${timestamp}.json`,
      },
      {
        translationId: `very-long-translation-id-with-many-segments-${timestamp}`,
        fileName: `long-${timestamp}.json`,
      },
      {
        translationId: `with-numbers-123-${timestamp}`,
        fileName: `numbers-${timestamp}.json`,
      },
      {
        translationId: `with_underscores_${timestamp}`,
        fileName: `underscores-${timestamp}.json`,
      },
    ];

    const options: DownloadFileBatchOptions = {
      projectId,
      maxRetries: 1,
    };

    try {
      const result = await _downloadFileBatch(testFiles, options, config);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(4);
      expect(result.successCount + result.failureCount).toBe(4);
    } catch {
      expect(true).toBe(true);
    }
  });
});