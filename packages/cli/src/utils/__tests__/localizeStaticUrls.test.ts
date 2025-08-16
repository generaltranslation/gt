import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import localizeStaticUrls from '../localizeStaticUrls';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// Mock other dependencies
vi.mock('../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(),
}));

import { createFileMapping } from '../../formats/files/fileMapping.js';

describe('localizeStaticUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('main function', () => {
    it('should return early if no files are provided', async () => {
      const settings = {
        files: null,
        defaultLocale: 'en',
        locales: ['en', 'ja'],
      };

      await localizeStaticUrls(settings as any);

      expect(createFileMapping).not.toHaveBeenCalled();
    });

    it('should return early if only gt placeholder path exists', async () => {
      const settings = {
        files: {
          placeholderPaths: { gt: 'some-path' },
          resolvedPaths: [],
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
      };

      await localizeStaticUrls(settings as any);

      expect(createFileMapping).not.toHaveBeenCalled();
    });

    it('should process md/mdx files for localization', async () => {
      const mockFileMapping = {
        ja: {
          'file1.md': '/path/to/ja/file1.md',
          'file2.mdx': '/path/to/ja/file2.mdx',
          'file3.txt': '/path/to/ja/file3.txt', // Should be filtered out
        },
      };

      const mockFileContent = `[Link](/docs/en/guide) and <a href="/docs/en/api">API</a>`;

      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);
      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: ['file1', 'file2'],
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        experimentalHideDefaultLocale: false,
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(settings as any);

      expect(createFileMapping).toHaveBeenCalledWith(
        ['file1', 'file2'],
        { docs: '/docs' },
        {},
        ['en', 'ja'],
        'en'
      );
      expect(fs.promises.readFile).toHaveBeenCalledTimes(2); // Only md/mdx files
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('markdown link localization', () => {
    describe('with hideDefaultLocale = false', () => {
      it('should replace default locale with target locale in markdown links', async () => {
        const fileContent = `[Guide](/docs/en/guide) and [API](/docs/en/api)`;
        const expected = `[Guide](/docs/ja/guide) and [API](/docs/ja/api)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle markdown links without trailing paths', async () => {
        const fileContent = `[Docs](/docs/en)`;
        const expected = `[Docs](/docs/ja)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });

    describe('with hideDefaultLocale = true', () => {
      it('should add target locale to markdown links when hideDefaultLocale is true', async () => {
        const fileContent = `[Guide](/docs/guide) and [API](/docs/api)`;
        const expected = `[Guide](/docs/ja/guide) and [API](/docs/ja/api)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should not modify already localized markdown links', async () => {
        const fileContent = `[Guide](/docs/ja/guide)`;
        const expected = fileContent; // Should remain unchanged

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });
  });

  describe('href attribute localization', () => {
    describe('with hideDefaultLocale = false', () => {
      it('should replace default locale with target locale in href attributes', async () => {
        const fileContent = `<a href="/docs/en/guide">Guide</a> and <a href="/docs/en/api">API</a>`;
        const expected = `<a href="/docs/ja/guide">Guide</a> and <a href="/docs/ja/api">API</a>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle href attributes without trailing paths', async () => {
        const fileContent = `<a href="/docs/en">Docs</a>`;
        const expected = `<a href="/docs/ja">Docs</a>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle complex href attributes with query parameters and fragments', async () => {
        const fileContent = `<a href="/docs/en/guide?tab=api#section">Guide</a>`;
        const expected = `<a href="/docs/ja/guide?tab=api#section">Guide</a>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });

    describe('with hideDefaultLocale = true', () => {
      it('should add target locale to href attributes when hideDefaultLocale is true', async () => {
        const fileContent = `<a href="/docs/guide">Guide</a> and <a href="/docs/api">API</a>`;
        const expected = `<a href="/docs/ja/guide">Guide</a> and <a href="/docs/ja/api">API</a>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle href attributes without trailing paths', async () => {
        const fileContent = `<a href="/docs">Docs</a>`;
        const expected = `<a href="/docs/ja">Docs</a>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should not modify already localized href attributes', async () => {
        const fileContent = `<a href="/docs/ja/guide">Guide</a>`;
        const expected = fileContent; // Should remain unchanged

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });
  });

  describe('mixed content localization', () => {
    it('should localize both markdown links and href attributes in the same content', async () => {
      const fileContent = `
[Markdown Link](/docs/en/guide)

<a href="/docs/en/api">HTML Link</a>

More content with [another link](/docs/en/tutorial) and <a href="/docs/en/reference">reference</a>.
`;
      const expected = `
[Markdown Link](/docs/ja/guide)

<a href="/docs/ja/api">HTML Link</a>

More content with [another link](/docs/ja/tutorial) and <a href="/docs/ja/reference">reference</a>.
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      const mockFileMapping = {
        ja: { 'test.mdx': '/path/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: ['test'],
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        experimentalHideDefaultLocale: false,
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(settings as any);
    });
  });

  describe('exclude parameter functionality', () => {
    describe('with hideDefaultLocale = false', () => {
      it('should exclude markdown links matching exact paths', async () => {
        const fileContent = `[Guide](/docs/en/guide) and [Images](/docs/en/images) and [API](/docs/en/api)`;
        const expected = `[Guide](/docs/ja/guide) and [Images](/docs/en/images) and [API](/docs/ja/api)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/en/images'],
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should exclude href attributes matching exact paths', async () => {
        const fileContent = `<a href="/docs/en/guide">Guide</a> and <a href="/docs/en/images">Images</a> and <a href="/docs/en/api">API</a>`;
        const expected = `<a href="/docs/ja/guide">Guide</a> and <a href="/docs/en/images">Images</a> and <a href="/docs/ja/api">API</a>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/en/images'],
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should exclude paths matching glob patterns', async () => {
        const fileContent = `[Guide](/docs/en/guide) and [Images](/docs/en/images/logo.png) and [Snippets](/docs/en/snippets/code.js)`;
        const expected = `[Guide](/docs/ja/guide) and [Images](/docs/en/images/logo.png) and [Snippets](/docs/en/snippets/code.js)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/en/images/**', '/docs/en/snippets/**'],
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle [locale] placeholder in exclude patterns', async () => {
        const fileContent = `[Guide](/docs/en/guide) and [Images](/docs/en/images/logo.png)`;
        const expected = `[Guide](/docs/ja/guide) and [Images](/docs/en/images/logo.png)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/[locale]/images/**'],
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });

    describe('with hideDefaultLocale = true', () => {
      it('should exclude markdown links matching exact paths', async () => {
        const fileContent = `[Guide](/docs/guide) and [Images](/docs/images) and [API](/docs/api)`;
        const expected = `[Guide](/docs/ja/guide) and [Images](/docs/images) and [API](/docs/ja/api)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/images/**'],
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should exclude href attributes matching exact paths', async () => {
        const fileContent = `<a href="/docs/guide">Guide</a> and <a href="/docs/images">Images</a> and <a href="/docs/api">API</a>`;
        const expected = `<a href="/docs/ja/guide">Guide</a> and <a href="/docs/images">Images</a> and <a href="/docs/ja/api">API</a>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/images/**'],
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should exclude paths matching glob patterns', async () => {
        const fileContent = `[Guide](/docs/guide) and [Images](/docs/images/logo.png) and [Snippets](/docs/snippets/code.js)`;
        const expected = `[Guide](/docs/ja/guide) and [Images](/docs/images/logo.png) and [Snippets](/docs/snippets/code.js)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/images/**', '/docs/snippets/**'],
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle [locale] placeholder in exclude patterns with hideDefaultLocale', async () => {
        const fileContent = `[Guide](/docs/guide) and [Images](/docs/images/logo.png)`;
        const expected = `[Guide](/docs/ja/guide) and [Images](/docs/images/logo.png)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/images/**'],
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });

    describe('mixed content with excludes', () => {
      it('should handle both markdown and href exclusions in same content', async () => {
        const fileContent = `
[Guide](/docs/en/guide) - should localize
[Images](/docs/en/images/photo.jpg) - should exclude
<a href="/docs/en/api">API</a> - should localize
<a href="/docs/en/snippets/example.js">Snippet</a> - should exclude
`;
        const expected = `
[Guide](/docs/ja/guide) - should localize
[Images](/docs/en/images/photo.jpg) - should exclude
<a href="/docs/ja/api">API</a> - should localize
<a href="/docs/en/snippets/example.js">Snippet</a> - should exclude
`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/en/images/**', '/docs/en/snippets/**'],
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });

    describe('edge cases for excludes', () => {
      it('should work when exclude array is empty', async () => {
        const fileContent = `[Guide](/docs/en/guide)`;
        const expected = `[Guide](/docs/ja/guide)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: [],
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should work when exclude parameter is undefined', async () => {
        const fileContent = `[Guide](/docs/en/guide)`;
        const expected = `[Guide](/docs/ja/guide)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
            // excludeStaticUrls not provided
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle complex glob patterns', async () => {
        const fileContent = `
[Image1](/docs/en/images/photos/photo1.jpg)
[Image2](/docs/en/images/icons/icon.svg)
[Image3](/docs/en/assets/logo.png)
[Guide](/docs/en/guide)
`;
        const expected = `
[Image1](/docs/en/images/photos/photo1.jpg)
[Image2](/docs/en/images/icons/icon.svg)
[Image3](/docs/en/assets/logo.png)
[Guide](/docs/ja/guide)
`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/[locale]/{images,assets}/**'],
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });
  });

  describe('basic /[locale] pattern functionality', () => {
    describe('with hideDefaultLocale = false', () => {
      it('should replace default locale with target locale using /[locale] pattern', async () => {
        const fileContent = `[Guide](/en/guide) and [API](/en/api)`;
        const expected = `[Guide](/ja/guide) and [API](/ja/api)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle href attributes with /[locale] pattern', async () => {
        const fileContent = `<a href="/en/guide">Guide</a> and <a href="/en/api">API</a>`;
        const expected = `<a href="/ja/guide">Guide</a> and <a href="/ja/api">API</a>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });

    describe('with hideDefaultLocale = true', () => {
      it('should add target locale using /[locale] pattern when hideDefaultLocale is true', async () => {
        const fileContent = `[Guide](/guide) and [API](/api)`;
        const expected = `[Guide](/ja/guide) and [API](/ja/api)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle href attributes with /[locale] pattern when hideDefaultLocale is true', async () => {
        const fileContent = `<a href="/guide">Guide</a> and <a href="/api">API</a>`;
        const expected = `<a href="/ja/guide">Guide</a> and <a href="/ja/api">API</a>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });

    describe('exclude functionality with /[locale] pattern', () => {
      it('should exclude paths with /[locale] pattern and [locale] placeholder excludes', async () => {
        const fileContent = `[Guide](/en/guide) and [Images](/en/images/logo.png)`;
        const expected = `[Guide](/ja/guide) and [Images](/en/images/logo.png)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/[locale]',
            excludeStaticUrls: ['/[locale]/images/**'],
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should include paths with /[locale] pattern when hideDefaultLocale is true when locale path is specified', async () => {
        const fileContent = `[Guide](/guide) and [Images](/images/logo.png)`;
        const expected = `[Guide](/ja/guide) and [Images](/ja/images/logo.png)`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/[locale]',
            excludeStaticUrls: ['/[locale]/images/**'],
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle content with no matching links', async () => {
      const fileContent = `
Some content without any matching links.
[External link](https://example.com)
<a href="https://external.com">External</a>
`;
      const expected = fileContent; // Should remain unchanged

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      const mockFileMapping = {
        ja: { 'test.mdx': '/path/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: ['test'],
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        experimentalHideDefaultLocale: false,
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(settings as any);
    });

    it('should handle special characters in pattern', async () => {
      const fileContent = `[Guide](/api-docs/en/guide)`;
      const expected = `[Guide](/api-docs/ja/guide)`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      const mockFileMapping = {
        ja: { 'test.mdx': '/path/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/api-docs' },
          resolvedPaths: ['test'],
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        experimentalHideDefaultLocale: false,
        options: {
          docsUrlPattern: '/api-docs/[locale]',
        },
      };

      await localizeStaticUrls(settings as any);
    });

    it('should handle pattern without leading slash', async () => {
      const fileContent = `[Guide](/docs/en/guide)`;
      const expected = `[Guide](/docs/ja/guide)`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      const mockFileMapping = {
        ja: { 'test.mdx': '/path/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: ['test'],
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        experimentalHideDefaultLocale: false,
        options: {
          docsUrlPattern: 'docs/[locale]', // No leading slash
        },
      };

      await localizeStaticUrls(settings as any);
    });

    it('should use default pattern when docsUrlPattern is not provided', async () => {
      const fileContent = `[Guide](/en/guide)`;
      const expected = `[Guide](/ja/guide)`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      const mockFileMapping = {
        ja: { 'test.mdx': '/path/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: ['test'],
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        experimentalHideDefaultLocale: false,
        options: {
          // docsUrlPattern not provided - should default to '/[locale]'
        },
      };

      await localizeStaticUrls(settings as any);
    });

    it('should work with different target locales', async () => {
      const fileContent = `[Guide](/docs/en/guide)`;

      const testLocales = [
        { locale: 'fr', expected: `[Guide](/docs/fr/guide)` },
        { locale: 'de', expected: `[Guide](/docs/de/guide)` },
        { locale: 'zh-CN', expected: `[Guide](/docs/zh-CN/guide)` },
      ];

      for (const { locale, expected } of testLocales) {
        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          [locale]: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', locale],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      }
    });
  });

  describe('JSX component href attribute processing', () => {
    describe('with hideDefaultLocale = false', () => {
      it('should replace default locale in JSX component href attributes', async () => {
        const fileContent = `<Card title="Start here" icon="rocket" href="/docs/en/quickstart" horizontal>
  Follow our quickstart guide.
</Card>`;
        const expected = `<Card title="Start here" icon="rocket" href="/docs/ja/quickstart" horizontal>
  Follow our quickstart guide.
</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle multiple Card components with different href patterns', async () => {
        const fileContent = `<Columns cols={2}>
  <Card title="Edit locally" icon="pen-to-square" href="/docs/en/development">
    Edit your docs locally.
  </Card>

  <Card title="Customize your site" icon="palette" href="/docs/en/essentials/settings">
    Customize the design.
  </Card>

  <Card title="API documentation" icon="terminal" href="/docs/en/api-reference/introduction">
    Auto-generate API docs.
  </Card>
</Columns>`;
        const expected = `<Columns cols={2}>
  <Card title="Edit locally" icon="pen-to-square" href="/docs/ja/development">
    Edit your docs locally.
  </Card>

  <Card title="Customize your site" icon="palette" href="/docs/ja/essentials/settings">
    Customize the design.
  </Card>

  <Card title="API documentation" icon="terminal" href="/docs/ja/api-reference/introduction">
    Auto-generate API docs.
  </Card>
</Columns>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle JSX components with single quotes in href', async () => {
        const fileContent = `<Card title='Start here' href='/docs/en/quickstart'>
  Follow our guide.
</Card>`;
        const expected = `<Card title="Start here" href="/docs/ja/quickstart">
  Follow our guide.
</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle JSX components mixed with markdown links and regular href attributes', async () => {
        const fileContent = `---
title: "Introduction"
---

import TestSnippet from "/snippets/en/test-snippet.mdx";

<TestSnippet />

## Getting Started

[Guide](/docs/en/guide) and <a href="/docs/en/api">API</a>

<Card title="Start here" icon="rocket" href="/docs/en/quickstart" horizontal>
  Follow our quickstart guide.
</Card>

<Card title="Advanced" href="/docs/en/advanced">
  Advanced topics.
</Card>`;
        const expected = `---
title: "Introduction"
---

import TestSnippet from "/snippets/en/test-snippet.mdx";

<TestSnippet />

## Getting Started

[Guide](/docs/ja/guide) and <a href="/docs/ja/api">API</a>

<Card title="Start here" icon="rocket" href="/docs/ja/quickstart" horizontal>
  Follow our quickstart guide.
</Card>

<Card title="Advanced" href="/docs/ja/advanced">
  Advanced topics.
</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });

    describe('with hideDefaultLocale = true', () => {
      it('should add target locale to JSX component href attributes when hideDefaultLocale is true', async () => {
        const fileContent = `<Card title="Start here" icon="rocket" href="/docs/quickstart" horizontal>
  Follow our quickstart guide.
</Card>`;
        const expected = `<Card title="Start here" icon="rocket" href="/docs/ja/quickstart" horizontal>
  Follow our quickstart guide.
</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should replace default locale with target locale when href contains default locale', async () => {
        const fileContent = `<Card title="Start here" icon="rocket" href="/docs/en/quickstart" horizontal>
  Follow our quickstart guide.
</Card>`;
        const expected = `<Card title="Start here" icon="rocket" href="/docs/ja/quickstart" horizontal>
  Follow our quickstart guide.
</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should not modify already localized JSX component href attributes', async () => {
        const fileContent = `<Card title="Start here" icon="rocket" href="/docs/ja/quickstart" horizontal>
  Follow our quickstart guide.
</Card>`;
        const expected = fileContent; // Should remain unchanged

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });
  });

  describe('default locale file processing', () => {
    describe('with hideDefaultLocale = false', () => {
      it('should process default locale files and add default locale to URLs without it', async () => {
        const fileContent = `[Guide](/docs/guide) and <Card href="/docs/quickstart">Start</Card>`;
        const expected = `[Guide](/docs/en/guide) and <Card href="/docs/en/quickstart">Start</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          // Only check the content for the default locale file (en)
          if (path === '/path/en/test.mdx') {
            expect(content).toBe(expected);
          }
          return Promise.resolve();
        });

        // Simulate scenario where default locale is not in fileMapping (not being translated)
        const mockFileMapping = {
          ja: { 'test.mdx': '/path/ja/test.mdx' },
          // No 'en' key - default locale files processed separately
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: {
              mdx: ['/path/en/test.mdx'], // Source file exists for default locale
            },
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should not modify URLs that already have default locale', async () => {
        const fileContent = `[Guide](/docs/en/guide) and <Card href="/docs/en/quickstart">Start</Card>`;
        const expected = fileContent; // Should remain unchanged

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          // Only check the content for the default locale file (en)
          if (path === '/path/en/test.mdx') {
            expect(content).toBe(expected);
          }
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/ja/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: {
              mdx: ['/path/en/test.mdx'],
            },
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });

    describe('with hideDefaultLocale = true', () => {
      it('should process default locale files and remove default locale from URLs', async () => {
        const fileContent = `[Guide](/docs/en/guide) and <Card href="/docs/en/quickstart">Start</Card>`;
        const expected = `[Guide](/docs/guide) and <Card href="/docs/quickstart">Start</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          // Only check the content for the default locale file (en)
          if (path === '/path/en/test.mdx') {
            expect(content).toBe(expected);
          }
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/ja/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: {
              mdx: ['/path/en/test.mdx'],
            },
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should not modify URLs that already lack default locale', async () => {
        const fileContent = `[Guide](/docs/guide) and <Card href="/docs/quickstart">Start</Card>`;
        const expected = fileContent; // Should remain unchanged

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          // Only check the content for the default locale file (en)
          if (path === '/path/en/test.mdx') {
            expect(content).toBe(expected);
          }
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/ja/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: {
              mdx: ['/path/en/test.mdx'],
            },
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });
  });

  describe('enhanced hideDefaultLocale scenarios', () => {
    describe('non-default locale with hideDefaultLocale = true', () => {
      it('should handle URLs without any locale by adding target locale', async () => {
        const fileContent = `[Guide](/docs/guide) and <Card href="/docs/quickstart">Start</Card>`;
        const expected = `[Guide](/docs/ja/guide) and <Card href="/docs/ja/quickstart">Start</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/ja/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should replace default locale with target locale when URL contains default locale', async () => {
        const fileContent = `[Guide](/docs/en/guide) and <Card href="/docs/en/quickstart">Start</Card>`;
        const expected = `[Guide](/docs/ja/guide) and <Card href="/docs/ja/quickstart">Start</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/ja/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle exact matches by adding target locale', async () => {
        const fileContent = `[Docs](/docs) and <Card href="/docs">Documentation</Card>`;
        const expected = `[Docs](/docs/ja) and <Card href="/docs/ja">Documentation</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/ja/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });

    describe('non-default locale with hideDefaultLocale = false', () => {
      it('should handle URLs without any locale by adding target locale', async () => {
        const fileContent = `[Guide](/docs/guide) and <Card href="/docs/quickstart">Start</Card>`;
        const expected = `[Guide](/docs/ja/guide) and <Card href="/docs/ja/quickstart">Start</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/ja/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should replace existing default locale with target locale', async () => {
        const fileContent = `[Guide](/docs/en/guide) and <Card href="/docs/en/quickstart">Start</Card>`;
        const expected = `[Guide](/docs/ja/guide) and <Card href="/docs/ja/quickstart">Start</Card>`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          ja: { 'test.mdx': '/path/ja/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          experimentalHideDefaultLocale: false,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });
    });
  });

  describe('debugging real-world scenario', () => {
    it('should handle /[locale] pattern with hideDefaultLocale=true like imports do', async () => {
      const fileContent = `---
title: "Introducción"
description: "Bienvenido al nuevo hogar de tu documentación"
---

<Card title="Comience aquí" icon="rocket" href="/en/quickstart" horizontal>
  Siga nuestra guía de inicio rápido en tres pasos.
</Card>

<Card title="Edita localmente" icon="pen-to-square" href="/en/development">
  Edita tu documentación de forma local.
</Card>`;

      const expected = `---
title: "Introducción"
description: "Bienvenido al nuevo hogar de tu documentación"
---

<Card title="Comience aquí" icon="rocket" href="/es/quickstart" horizontal>
  Siga nuestra guía de inicio rápido en tres pasos.
</Card>

<Card title="Edita localmente" icon="pen-to-square" href="/es/development">
  Edita tu documentación de forma local.
</Card>`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        console.log('Expected:', expected);
        console.log('Actual:', content);
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      const mockFileMapping = {
        es: { 'test.mdx': '/path/es/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: ['test'],
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'es'],
        experimentalHideDefaultLocale: true,
        options: {
          docsUrlPattern: '/[locale]', // Root-level locale pattern
        },
      };

      await localizeStaticUrls(settings as any);
    });
  });
});
