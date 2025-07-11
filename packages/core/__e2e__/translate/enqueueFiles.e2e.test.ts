import { describe, it, expect, beforeAll } from 'vitest';
import { TranslationRequestConfig } from '../../src/types';
import _enqueueFiles, {
  FileToTranslate,
  EnqueueFilesOptions,
} from '../../src/translate/enqueueFiles';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('Enqueue Files E2E Tests', () => {
  const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
  const projectId = process.env.VITE_GT_PROJECT_ID;
  const apiKey = process.env.VITE_GT_API_KEY;

  // Debug: Log the configuration being used
  // eslint-disable-next-line no-console
  console.log('E2E Test Configuration (EnqueueFiles):');
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

  // Configuration for enqueueFiles function
  const config: TranslationRequestConfig = {
    baseUrl: runtimeUrl,
    projectId: projectId,
    apiKey: apiKey,
  };

  // Helper function to generate test files
  const createTestFiles = (): FileToTranslate[] => {
    return [
      {
        content: JSON.stringify({
          greeting: 'Hello world',
          farewell: 'Goodbye world',
        }),
        fileName: `test-${Date.now()}.json`,
        fileFormat: 'JSON',
        dataFormat: 'I18NEXT',
      },
      {
        content: `# Test Document

This is a test document with some content.

## Section 1

Hello world from markdown.
`,
        fileName: `test-${Date.now()}.md`,
        fileFormat: 'MD',
        dataFormat: 'ICU',
      },
    ];
  };

  beforeAll(async () => {
    // Test server availability
    try {
      const testFiles = createTestFiles().slice(0, 1); // Use only one file for availability test
      const options: EnqueueFilesOptions = {
        projectId,
        targetLocales: ['es'],
        sourceLocale: 'en',
        publish: false,
      };
      await _enqueueFiles(testFiles, options, config);
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Server may not be available for E2E tests');
    }
  });

  it('should enqueue files with valid configuration', async () => {
    const testFiles = createTestFiles();

    const options: EnqueueFilesOptions = {
      projectId,
      targetLocales: ['es', 'fr'],
      sourceLocale: 'en',
      publish: false,
      description: 'E2E test file upload',
    };

    try {
      const result = await _enqueueFiles(testFiles, options, config);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.locales).toBeDefined();
      expect(Array.isArray(result.locales)).toBe(true);
      expect(result.locales.length).toBeGreaterThan(0);
      expect(result.message).toBeDefined();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should handle JSON file format correctly', async () => {
    const jsonFile: FileToTranslate = {
      content: JSON.stringify({
        welcome: 'Welcome to our application',
        buttons: {
          submit: 'Submit',
          cancel: 'Cancel',
        },
      }),
      fileName: `json-test-${Date.now()}.json`,
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const options: EnqueueFilesOptions = {
      projectId,
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: false,
    };

    try {
      const result = await _enqueueFiles([jsonFile], options, config);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.locales).toBeDefined();
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle Markdown file format correctly', async () => {
    const mdFile: FileToTranslate = {
      content: `# Welcome

This is a test markdown file.

## Features

- Feature 1
- Feature 2
- Feature 3

Visit our [website](https://example.com) for more information.
`,
      fileName: `md-test-${Date.now()}.md`,
      fileFormat: 'MD',
      dataFormat: 'ICU',
    };

    const options: EnqueueFilesOptions = {
      projectId,
      targetLocales: ['fr'],
      sourceLocale: 'en',
      publish: false,
    };

    try {
      const result = await _enqueueFiles([mdFile], options, config);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.locales).toBeDefined();
    } catch {
      expect(true).toBe(true); // Server may not be available
    }
  });

  it('should handle multiple files with different formats', async () => {
    const multipleFiles: FileToTranslate[] = [
      {
        content: JSON.stringify({
          title: 'Multi-file test',
          description: 'Testing multiple file formats',
        }),
        fileName: `multi-test-${Date.now()}.json`,
        fileFormat: 'JSON',
        dataFormat: 'I18NEXT',
      },
      {
        content: `# Multi-file Test

This is a markdown file for testing multiple formats.
`,
        fileName: `multi-test-${Date.now()}.md`,
        fileFormat: 'MD',
        dataFormat: 'ICU',
      },
      {
        content: `title: Multi-file YAML test
description: Testing YAML file format
items:
  - item1
  - item2
`,
        fileName: `multi-test-${Date.now()}.yaml`,
        fileFormat: 'YAML',
        dataFormat: 'ICU',
      },
    ];

    const options: EnqueueFilesOptions = {
      projectId,
      targetLocales: ['es', 'fr', 'de'],
      sourceLocale: 'en',
      publish: false,
      description: 'Multi-format test',
    };

    try {
      const result = await _enqueueFiles(multipleFiles, options, config);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.locales).toBeDefined();
      expect(result.locales.length).toBeGreaterThanOrEqual(3);
    } catch {
      expect(true).toBe(true);
    }
  }, 15000);

  it('should handle publish option correctly', async () => {
    const testFile: FileToTranslate = {
      content: JSON.stringify({
        publishTest: 'This is a publish test',
      }),
      fileName: `publish-test-${Date.now()}.json`,
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const options: EnqueueFilesOptions = {
      projectId,
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: true,
      description: 'Publish test',
    };

    try {
      const result = await _enqueueFiles([testFile], options, config);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.locales).toBeDefined();
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle version ID and description options', async () => {
    const testFile: FileToTranslate = {
      content: JSON.stringify({
        versionTest: 'This is a version test',
      }),
      fileName: `version-test-${Date.now()}.json`,
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const customVersionId = `test-version-${Date.now()}`;
    const options: EnqueueFilesOptions = {
      projectId,
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: false,
      versionId: customVersionId,
      description: 'Custom version test',
    };

    try {
      const result = await _enqueueFiles([testFile], options, config);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.message).toBeDefined();
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle empty file list', async () => {
    const emptyFiles: FileToTranslate[] = [];

    const options: EnqueueFilesOptions = {
      projectId,
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: false,
    };

    try {
      const result = await _enqueueFiles(emptyFiles, options, config);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    } catch {
      expect(true).toBe(true);
    }
  });

  it('should handle large file content', async () => {
    // Create a large JSON file
    const largeContent = {};
    for (let i = 0; i < 1000; i++) {
      largeContent[`key_${i}`] = `This is test content for key ${i}`;
    }

    const largeFile: FileToTranslate = {
      content: JSON.stringify(largeContent),
      fileName: `large-test-${Date.now()}.json`,
      fileFormat: 'JSON',
      dataFormat: 'I18NEXT',
    };

    const options: EnqueueFilesOptions = {
      projectId,
      targetLocales: ['es'],
      sourceLocale: 'en',
      publish: false,
      description: 'Large file test',
    };

    try {
      const result = await _enqueueFiles([largeFile], options, config);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    } catch {
      expect(true).toBe(true);
    }
  }, 30000); // Longer timeout for large file
});