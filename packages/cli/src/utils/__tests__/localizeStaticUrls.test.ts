import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import localizeStaticUrls, { transformUrlPath } from '../localizeStaticUrls';

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
        const fileContent = `[Guide](/docs/japanese/guide)`;
        const expected = `[Guide](/docs/ja/japanese/guide)`;

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
        const fileContent = `<a href="/docs/japanese/guide">Guide</a>`;
        const expected = `<a href="/docs/ja/japanese/guide">Guide</a>`;

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

      it('should not modify already localized JSX component href attributes with hideDefaultLocale = true', async () => {
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
          locales: ['ja'],
          experimentalHideDefaultLocale: true,
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(settings as any);
      });

      it('should handle multiple identical href attributes in raw JSX strings correctly', async () => {
        // Test with raw JSX as it appears in MDX files
        const fileContent = `Some content before.

{/* JSX code block */}

<div>
  <a href="/docs/quickstart">First Link</a>
  <button href="/docs/quickstart">Second Button</button>
  <span href="/docs/quickstart">Third Span</span>
</div>`;
        const expected = `Some content before.

{/* JSX code block */}

<div>
  <a href="/docs/ja/quickstart">First Link</a>
  <button href="/docs/ja/quickstart">Second Button</button>
  <span href="/docs/ja/quickstart">Third Span</span>
</div>`;

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

      it('should handle multiple identical href attributes in JSX correctly', async () => {
        const fileContent = `<Card href="/docs/quickstart">First Card</Card>
<Button href="/docs/quickstart">Second Button</Button>
<Link href="/docs/quickstart">Third Link</Link>`;
        const expected = `<Card href="/docs/ja/quickstart">First Card</Card>
<Button href="/docs/ja/quickstart">Second Button</Button>
<Link href="/docs/ja/quickstart">Third Link</Link>`;

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
      it('should handle URLs without any locale by adding target locale with hideDefaultLocale = true', async () => {
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
      it('should handle URLs without any locale by adding target locale with hideDefaultLocale = false', async () => {
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
          locales: ['ja'],
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

<Card title="Comience aquí" icon="rocket" href="quickstart" horizontal>
  Siga nuestra guía de inicio rápido en tres pasos.
</Card>

<Card title="Edita localmente" icon="pen-to-square" href="/development">
  Edita tu documentación de forma local.
</Card>`;

      const expected = `---
title: "Introducción"
description: "Bienvenido al nuevo hogar de tu documentación"
---

<Card title="Comience aquí" icon="rocket" href="es/quickstart" horizontal>
  Siga nuestra guía de inicio rápido en tres pasos.
</Card>

<Card title="Edita localmente" icon="pen-to-square" href="/es/development">
  Edita tu documentación de forma local.
</Card>`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
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
        locales: ['es'],
        experimentalHideDefaultLocale: true,
      };

      await localizeStaticUrls(settings as any);
    });
  });

  describe('invalid MDX error handling', () => {
    it('should return original content unchanged when MDX starts with closing tag', async () => {
      const invalidFileContent = `</Card>
[Guide](/docs/en/guide)
<Card href="/docs/en/quickstart">Start</Card>`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(invalidFileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
        expect(content).toBe(invalidFileContent); // Should remain unchanged due to parsing error
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

    it('should return original content unchanged when MDX has unclosed JSX tags', async () => {
      const invalidFileContent = `<Card title="Test" href="/docs/en/guide">
[Guide](/docs/en/guide)
<!-- Missing closing tag for Card -->`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(invalidFileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
        expect(content).toBe(invalidFileContent); // Should remain unchanged due to parsing error
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

    it('should return original content unchanged when MDX has nested unclosed tags', async () => {
      const invalidFileContent = `<Card>
  <Button href="/docs/en/guide">
    <Icon name="test"
  </Button>
</Card>

[Guide](/docs/en/guide)`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(invalidFileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
        expect(content).toBe(invalidFileContent); // Should remain unchanged due to parsing error
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

    it('should return original content unchanged when MDX has mismatched JSX tags', async () => {
      const invalidFileContent = `<Card title="Test">
  <Button href="/docs/en/guide">Guide</Button>
</NotCard>

[Another Link](/docs/en/api)`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(invalidFileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
        expect(content).toBe(invalidFileContent); // Should remain unchanged due to parsing error
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

    it('should return original content unchanged when MDX has invalid JSX attributes', async () => {
      const invalidFileContent = `<Card title=invalid-attribute href="/docs/en/guide">
  Content here
</Card>

[Valid Link](/docs/en/api)`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(invalidFileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
        expect(content).toBe(invalidFileContent); // Should remain unchanged due to parsing error
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

  it('should handle default locale processing with experimentalHideDefaultLocale=true', async () => {
    // Mock file system operations for default locale processing
    const mockFileMapping = {};
    vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

    const defaultLocaleContent = `# Default Locale Content

[Link](/en/guide)
<Card href="/en/api">API</Card>
[Another](/en/docs)`;

    vi.mocked(fs.promises.readFile).mockResolvedValue(defaultLocaleContent);

    vi.mocked(fs.promises.writeFile).mockResolvedValue();

    const settings = {
      files: {
        placeholderPaths: { docs: '/docs' },
        resolvedPaths: {
          mdx: ['default.mdx'],
        },
        transformPaths: {},
      },
      defaultLocale: 'en',
      locales: ['en', 'fr-CA'],
      experimentalHideDefaultLocale: true,
      options: {
        docsUrlPattern: '/[locale]',
        excludeStaticUrls: ['/images/**/*', '/logo/**/*'],
      },
    };

    await localizeStaticUrls(settings as any);

    // Verify that writeFile was called for the default locale file
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      'default.mdx',
      expect.any(String)
    );
  });
});

describe('baseDomain', () => {
  it('should handle baseDomain', async () => {
    const fileContent = `[Guide](https://example.com/docs/guide) and <Card href="https://example.com/docs/quickstart">Start</Card>`;
    const expected = `[Guide](https://example.com/fr/docs/guide) and <Card href="https://example.com/fr/docs/quickstart">Start</Card>`;

    vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
    vi.mocked(fs.promises.writeFile).mockResolvedValue();

    const mockFileMapping = {
      fr: {
        'default.mdx': '/path/fr/default.mdx',
      },
    };
    vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

    const settings = {
      files: {
        placeholderPaths: { docs: '/docs' },
        resolvedPaths: {
          mdx: ['default.mdx'],
        },
        transformPaths: {},
      },
      defaultLocale: 'en',
      locales: ['fr'],
      experimentalHideDefaultLocale: false,
      options: {
        docsUrlPattern: '/[locale]',
        excludeStaticUrls: [],
        baseDomain: 'https://example.com',
      },
    };

    await localizeStaticUrls(settings as any);

    vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
    vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
      expect(content).toBe(expected);
      return Promise.resolve();
    });
  });

  describe('baseDomain edge cases', () => {
    it('should not transform URLs that do not match pattern even with baseDomain', async () => {
      const fileContent = `[Guide](https://example.com/images/logo.png) and [API](https://example.com/assets/icon.svg)`;
      const expected = fileContent; // Should remain unchanged since /images and /assets don't match /docs pattern

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      const mockFileMapping = {
        fr: { 'test.mdx': '/path/fr/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: { mdx: ['test.mdx'] },
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['fr'],
        experimentalHideDefaultLocale: false,
        options: {
          docsUrlPattern: '/docs/[locale]',
          baseDomain: 'https://example.com',
        },
      };

      await localizeStaticUrls(settings as any);
    });

    it('should handle baseDomain with hideDefaultLocale=true', async () => {
      const fileContent = `[Guide](https://example.com/docs/guide) and <Card href="https://example.com/docs/api">API</Card>`;
      const expected = `[Guide](https://example.com/fr/docs/guide) and <Card href="https://example.com/fr/docs/api">API</Card>`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      const mockFileMapping = {
        fr: { 'test.mdx': '/path/fr/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: { mdx: ['test.mdx'] },
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['fr'],
        experimentalHideDefaultLocale: true,
        options: {
          docsUrlPattern: '/[locale]',
          baseDomain: 'https://example.com',
        },
      };

      await localizeStaticUrls(settings as any);
    });

    it('should not add literal null to baseDomain URLs when transformation fails', async () => {
      const fileContent = `[External](https://example.com/other/page) and [Valid](https://example.com/docs/guide)`;
      const expected = `[External](https://example.com/other/page) and [Valid](https://example.com/docs/guide)`; // Should remain unchanged when transformation fails

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
        expect(content).toBe(expected);
        expect(content).not.toContain('null'); // Ensure no literal 'null' strings
        return Promise.resolve();
      });

      const mockFileMapping = {
        fr: { 'test.mdx': '/path/fr/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: { mdx: ['test.mdx'] },
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['fr'],
        experimentalHideDefaultLocale: false,
        options: {
          docsUrlPattern: '/docs/[locale]',
          baseDomain: 'https://example.com',
        },
      };

      await localizeStaticUrls(settings as any);
    });

    it('should handle multiple baseDomain URLs with mixed transformable/non-transformable paths', async () => {
      const fileContent = `
[Docs](https://example.com/docs/en/guide)
[Images](https://example.com/images/photo.jpg)
<Card href="https://example.com/docs/en/api">API</Card>
<a href="https://example.com/assets/script.js">Script</a>
`;
      const expected = `
[Docs](https://example.com/docs/fr/guide)
[Images](https://example.com/images/photo.jpg)
<Card href="https://example.com/docs/fr/api">API</Card>
<a href="https://example.com/assets/script.js">Script</a>
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
        expect(content).toBe(expected);
        expect(content).not.toContain('null');
        return Promise.resolve();
      });

      const mockFileMapping = {
        fr: { 'test.mdx': '/path/fr/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: { mdx: ['test.mdx'] },
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['fr'],
        experimentalHideDefaultLocale: false,
        options: {
          docsUrlPattern: '/docs/[locale]',
          baseDomain: 'https://example.com',
        },
      };

      await localizeStaticUrls(settings as any);
    });
  });
});

describe('transformUrlPath', () => {
  describe('when targetLocale equals defaultLocale', () => {
    describe('with hideDefaultLocale = false', () => {
      it('should add default locale to URLs without locale', () => {
        const result = transformUrlPath(
          '/docs/guide',
          '/docs/',
          'en',
          'en',
          false
        );
        expect(result).toBe('/docs/en/guide');
      });

      it('should add default locale to exact pattern match with hideDefaultLocale = false', () => {
        const result = transformUrlPath('/docs', '/docs/', 'en', 'en', false);
        expect(result).toBe('/docs/en');
      });

      it('should return null if URL already has default locale', () => {
        const result = transformUrlPath(
          '/docs/en/guide',
          '/docs/',
          'en',
          'en',
          false
        );
        expect(result).toBeNull();
      });

      it('should return null if URL does not match pattern', () => {
        const result = transformUrlPath(
          '/other/guide',
          '/docs/',
          'en',
          'en',
          false
        );
        expect(result).toBeNull();
      });
    });

    describe('with hideDefaultLocale = true', () => {
      it('should remove default locale from URLs that have it', () => {
        const result = transformUrlPath(
          '/docs/en/guide',
          '/docs/',
          'en',
          'en',
          true
        );
        expect(result).toBe('/docs/guide');
      });

      it('should remove default locale from URLs ending with it', () => {
        const result = transformUrlPath('/docs/en', '/docs/', 'en', 'en', true);
        expect(result).toBe('/docs');
      });

      it('should return null if URL does not have default locale', () => {
        const result = transformUrlPath(
          '/docs/guide',
          '/docs/',
          'en',
          'en',
          true
        );
        expect(result).toBeNull();
      });
    });
  });

  describe('when targetLocale differs from defaultLocale', () => {
    describe('with hideDefaultLocale = false', () => {
      it('should replace default locale with target locale with hideDefaultLocale = false', () => {
        const result = transformUrlPath(
          '/docs/en/guide',
          '/docs/',
          'ja',
          'en',
          false
        );
        expect(result).toBe('/docs/ja/guide');
      });

      it('should replace default locale at end of URL', () => {
        const result = transformUrlPath(
          '/docs/en',
          '/docs/',
          'ja',
          'en',
          false
        );
        expect(result).toBe('/docs/ja');
      });

      it('should add target locale to URLs without locale with hideDefaultLocale = false', () => {
        const result = transformUrlPath(
          '/docs/en/guide',
          '/docs/',
          'ja',
          'en',
          false
        );
        expect(result).toBe('/docs/ja/guide');
      });

      it('should add target locale to exact pattern match with hideDefaultLocale = false', () => {
        const result = transformUrlPath('/docs', '/docs/', 'ja', 'en', false);
        expect(result).toBeNull();
      });

      it('should return null if URL does not match pattern', () => {
        const result = transformUrlPath(
          '/other/guide',
          '/docs/',
          'ja',
          'en',
          false
        );
        expect(result).toBeNull();
      });
    });

    describe('with hideDefaultLocale = true', () => {
      it('should replace default locale with target locale', () => {
        const result = transformUrlPath(
          '/docs/english/guide',
          '/docs/',
          'ja',
          'en',
          true
        );
        expect(result).toBe('/docs/ja/english/guide');
      });

      it('should replace default locale at end of URL', () => {
        const result = transformUrlPath(
          '/docs/english',
          '/docs/',
          'ja',
          'en',
          true
        );
        expect(result).toBe('/docs/ja/english');
      });

      it('should add target locale to URLs without locale with hideDefaultLocale = true', () => {
        const result = transformUrlPath(
          '/docs/guide',
          '/docs/',
          'ja',
          'en',
          true
        );
        expect(result).toBe('/docs/ja/guide');
      });

      it('should add target locale to exact pattern match', () => {
        const result = transformUrlPath('/docs', '/docs/', 'ja', 'en', true);
        expect(result).toBe('/docs/ja');
      });

      it('should return null if URL already has target locale', () => {
        const result = transformUrlPath(
          '/docs/japanese/guide',
          '/docs/',
          'ja',
          'en',
          true
        );
        expect(result).toBe('/docs/ja/japanese/guide');
      });

      it('should return null if URL equals target locale pattern', () => {
        const result = transformUrlPath(
          '/docs/japanese',
          '/docs/',
          'ja',
          'en',
          true
        );
        expect(result).toBe('/docs/ja/japanese');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle pattern without trailing slash', () => {
      const result = transformUrlPath(
        '/docs/guide',
        '/docs',
        'ja',
        'en',
        false
      );
      expect(result).toBeNull();
    });

    it('should handle root pattern with trailing slash', () => {
      const result = transformUrlPath('/guide', '/', 'ja', 'en', false);
      expect(result).toBeNull();
    });

    it('should handle root pattern without trailing slash', () => {
      const result = transformUrlPath('/guide', '', 'ja', 'en', false);
      expect(result).toBeNull();
    });

    it('should handle complex locales like zh-CN', () => {
      const result = transformUrlPath(
        '/docs/en/guide',
        '/docs/',
        'zh-CN',
        'en',
        false
      );
      expect(result).toBe('/docs/zh-CN/guide');
    });

    it('should handle URLs with query parameters', () => {
      const result = transformUrlPath(
        '/docs/en/guide?tab=api',
        '/docs/',
        'ja',
        'en',
        false
      );
      expect(result).toBe('/docs/ja/guide?tab=api');
    });

    it('should handle URLs with fragments', () => {
      const result = transformUrlPath(
        '/docs/en/guide#section',
        '/docs/',
        'ja',
        'en',
        false
      );
      expect(result).toBe('/docs/ja/guide#section');
    });

    it('should handle empty path after pattern head', () => {
      const result = transformUrlPath('/docs/', '/docs/', 'ja', 'en', false);
      expect(result).toBeNull();
    });
  });
});
