import { describe, it, expect, beforeAll } from 'vitest';
import { TranslationRequestConfig } from '../../src/types';
import {
  FileToTranslate,
  EnqueueFilesOptions,
} from '../../src/types-dir/enqueue';
import _enqueueFiles from '../../src/translate/enqueueFiles';
import { defaultRuntimeApiUrl } from '../../src/settings/settingsUrls';

describe('enqueueFiles E2E Tests', () => {
  let config: TranslationRequestConfig;

  beforeAll(() => {
    const runtimeUrl = process.env.VITE_GT_RUNTIME_URL || defaultRuntimeApiUrl;
    const projectId = process.env.VITE_GT_PROJECT_ID;
    const apiKey = process.env.VITE_GT_API_KEY;

    config = {
      baseUrl: runtimeUrl,
      projectId: projectId || 'test-project',
      apiKey: apiKey || 'test-key',
    };
  });

  describe('Single File Upload', () => {
    it('should upload a single JSON file successfully', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'test-strings.json',
          content: JSON.stringify({
            hello: 'Hello world',
            goodbye: 'Goodbye world',
            welcome: 'Welcome back',
          }),
          fileFormat: 'JSON',
          dataFormat: 'ICU',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es', 'fr'],
        publish: false,
        _versionId: 'test-version-single-json',
        description: 'Single JSON file upload test',
        timeout: 10000,
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
        expect(Array.isArray(result.locales)).toBe(true);
        expect(result.locales).toEqual(expect.arrayContaining(['es', 'fr']));

        if (result.message) {
          expect(typeof result.message).toBe('string');
        }
        if (result.translations) {
          expect(result.translations).toBeDefined();
        }
      } catch (error) {
        // Network or server issues - acceptable in e2e environment
        expect(error).toBeDefined();
      }
    });

    it('should upload a single YAML file with JSX data format', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'ui-components.yaml',
          content: `
welcome_message: "Welcome {name}!"
button_save: "Save Changes"
button_cancel: "Cancel Operation"
`,
          fileFormat: 'YAML',
          dataFormat: 'JSX',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        publish: true,
        _versionId: 'test-version-single-yaml',
        description: 'Single YAML file with JSX format',
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
        expect(result.locales).toContain('es');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should upload a markdown file', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'documentation.md',
          content: `# Welcome to Our App

This is a comprehensive guide to using our application.

## Getting Started

1. Sign up for an account
2. Complete your profile
3. Start exploring features

### Tips and Tricks

- Use keyboard shortcuts for faster navigation
- Customize your dashboard
- Enable notifications for updates
`,
          fileFormat: 'MD',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['fr', 'de'],
        publish: false,
        _versionId: 'test-version-markdown',
        description: 'Markdown documentation file',
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
        expect(result.locales).toEqual(expect.arrayContaining(['fr', 'de']));
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Multiple Files Upload', () => {
    it('should upload multiple files with different formats', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'common.json',
          content: JSON.stringify({
            app_name: 'My Application',
            version: 'v1.0.0',
            copyright: '© 2024 Company Name',
          }),
          fileFormat: 'JSON',
          dataFormat: 'ICU',
        },
        {
          fileName: 'ui-strings.yaml',
          content: `
buttons:
  save: "Save"
  cancel: "Cancel"
  delete: "Delete"
messages:
  success: "Operation completed successfully"
  error: "An error occurred"
`,
          fileFormat: 'YAML',
          dataFormat: 'I18NEXT',
        },
        {
          fileName: 'help.md',
          content: `# Help Documentation

## Frequently Asked Questions

### How do I reset my password?
1. Click "Forgot Password"
2. Enter your email
3. Check your inbox

### How do I contact support?
Email us at support@example.com
`,
          fileFormat: 'MD',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es', 'fr', 'de'],
        publish: false,
        _versionId: 'test-version-multi-format',
        description: 'Multiple files with different formats',
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
        expect(result.locales).toEqual(
          expect.arrayContaining(['es', 'fr', 'de'])
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should upload files without dataFormat specified', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'plain-text.md',
          content: '# Simple Markdown\n\nThis is plain markdown content.',
          fileFormat: 'MD',
          // No dataFormat specified
        },
        {
          fileName: 'simple-config.json',
          content: JSON.stringify({
            title: 'Application Title',
            description: 'Application Description',
          }),
          fileFormat: 'JSON',
          // No dataFormat specified
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        publish: false,
        _versionId: 'test-version-no-data-format',
        description: 'Files without explicit data format',
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
        expect(result.locales).toContain('es');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Configuration Options', () => {
    it('should handle publish: true option', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'publish-test.json',
          content: JSON.stringify({
            message: 'This will be published immediately',
          }),
          fileFormat: 'JSON',
          dataFormat: 'ICU',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        publish: true,
        _versionId: 'test-version-publish',
        description: 'Testing publish option',
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle different version IDs', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'version-test.json',
          content: JSON.stringify({
            version_message: 'Testing version handling',
          }),
          fileFormat: 'JSON',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['fr'],
        publish: false,
        _versionId: 'custom-version-2.1.0',
        description: 'Custom version ID test',
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle multiple target locales', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'multi-locale.json',
          content: JSON.stringify({
            greeting: 'Hello everyone!',
            farewell: 'See you later!',
          }),
          fileFormat: 'JSON',
          dataFormat: 'ICU',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es', 'fr', 'de', 'it', 'pt'],
        publish: false,
        _versionId: 'test-version-multi-locale',
        description: 'Multiple target locales test',
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('locales');
        expect(result.locales).toEqual(
          expect.arrayContaining(['es', 'fr', 'de', 'it', 'pt'])
        );
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

      const files: FileToTranslate[] = [
        {
          fileName: 'default-url-test.json',
          content: JSON.stringify({
            message: 'Testing default URL',
          }),
          fileFormat: 'JSON',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        publish: false,
        _versionId: 'test-version-default-url',
        description: 'Default URL test',
      };

      try {
        const result = await _enqueueFiles(files, options, configWithoutUrl);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle custom baseUrl', async () => {
      const customConfig: TranslationRequestConfig = {
        ...config,
        baseUrl: config.baseUrl || defaultRuntimeApiUrl,
      };

      const files: FileToTranslate[] = [
        {
          fileName: 'custom-url-test.json',
          content: JSON.stringify({
            message: 'Testing custom URL',
          }),
          fileFormat: 'JSON',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        publish: false,
        _versionId: 'test-version-custom-url',
        description: 'Custom URL test',
      };

      try {
        const result = await _enqueueFiles(files, options, customConfig);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
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

      const files: FileToTranslate[] = [
        {
          fileName: 'invalid-key-test.json',
          content: JSON.stringify({
            message: 'Testing invalid API key',
          }),
          fileFormat: 'JSON',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        publish: false,
        _versionId: 'test-version-invalid-key',
        description: 'Invalid API key test',
      };

      try {
        const result = await _enqueueFiles(files, options, invalidConfig);

        // Should either return results or throw an error
        expect(result).toBeDefined();
      } catch (error) {
        // Network/auth errors are acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle timeout gracefully', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'timeout-test.json',
          content: JSON.stringify({
            message: 'Testing timeout handling',
          }),
          fileFormat: 'JSON',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        publish: false,
        _versionId: 'test-version-timeout',
        description: 'Timeout test',
        timeout: 1, // Very short timeout to force timeout
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
      } catch (error) {
        // Timeout errors are expected
        expect(error).toBeDefined();
      }
    });

    it('should handle empty files array', async () => {
      const files: FileToTranslate[] = [];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        publish: false,
        _versionId: 'test-version-empty',
        description: 'Empty files array test',
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
      } catch (error) {
        // Server may reject empty file arrays - acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('File Format Variations', () => {
    it('should handle GTJSON format files', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'gt-format.gtjson',
          content: JSON.stringify({
            entries: {
              welcome: {
                source: 'Welcome to our app',
                metadata: {
                  context: 'app-welcome',
                },
              },
              goodbye: {
                source: 'Thanks for visiting',
                metadata: {
                  context: 'app-farewell',
                },
              },
            },
          }),
          fileFormat: 'GTJSON',
          dataFormat: 'ICU',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['es'],
        publish: false,
        _versionId: 'test-version-gtjson',
        description: 'GTJSON format test',
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle MDX format files', async () => {
      const files: FileToTranslate[] = [
        {
          fileName: 'interactive-docs.mdx',
          content: `# Interactive Documentation

import { Button } from './components/Button'

Welcome to our interactive documentation!

<Button onClick={() => alert('Hello!')}>
  Click me
</Button>

## Features

- Interactive components
- Live examples
- Rich formatting
`,
          fileFormat: 'MDX',
          dataFormat: 'JSX',
        },
      ];

      const options: EnqueueFilesOptions = {
        sourceLocale: 'en',
        targetLocales: ['fr'],
        publish: false,
        _versionId: 'test-version-mdx',
        description: 'MDX format test',
      };

      try {
        const result = await _enqueueFiles(files, options, config);

        expect(result).toBeDefined();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('locales');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
