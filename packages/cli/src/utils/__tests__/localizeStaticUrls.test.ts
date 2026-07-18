import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import localizeStaticUrls, {
  transformUrlPath,
  type StaticUrlSettings,
} from '../localizeStaticUrls';

const createSettings = (settings: StaticUrlSettings): StaticUrlSettings =>
  settings;

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  existsSync: vi.fn(),
}));

// Mock other dependencies
vi.mock('../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(),
}));

import { createFileMapping } from '../../formats/files/fileMapping.js';

describe('localizeStaticUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock existsSync to return true by default
    vi.mocked(fs.existsSync).mockReturnValue(true);
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

      await localizeStaticUrls(createSettings(settings));

      expect(createFileMapping).not.toHaveBeenCalled();
    });

    it('should return early if only gt placeholder path exists', async () => {
      const settings = {
        files: {
          placeholderPaths: { gt: 'some-path' },
          resolvedPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
      };

      await localizeStaticUrls(createSettings(settings));

      expect(createFileMapping).not.toHaveBeenCalled();
    });

    it('should process md/mdx files for localization', async () => {
      const mockFileMapping = {
        en: {},
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
          resolvedPaths: { mdx: ['file1', 'file2'] },
          transformPaths: {},
          transformFormats: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(createSettings(settings));

      expect(createFileMapping).toHaveBeenCalledWith(
        { mdx: ['file1', 'file2'] },
        { docs: '/docs' },
        {},
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
            experimentalHideDefaultLocale: true,
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
      });
    });

    it('should not duplicate target locale when hideDefaultLocale=true and target already present', async () => {
      const fileContent = `[Guide](/docs/ja/guide)`;
      const expected = `[Guide](/docs/ja/guide)`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        // Should not write when no changes
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: { docsUrlPattern: '/docs/[locale]' },
      };

      await localizeStaticUrls(createSettings(settings), ['ja']);

      // If no changes detected, writeFile may not be called
      // Ensure the content remains unchanged
      expect(vi.mocked(fs.promises.readFile)).toHaveBeenCalled();
    });

    it('should treat absolute URLs with baseDomain as idempotent when already localized', async () => {
      const fileContent = `<a href="https://example.com/docs/ja/guide">Guide</a>`;
      const expected = `<a href="https://example.com/docs/ja/guide">Guide</a>`;

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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/docs/[locale]',
          baseDomain: 'https://example.com',
        },
      };

      await localizeStaticUrls(createSettings(settings), ['ja']);
      expect(vi.mocked(fs.promises.readFile)).toHaveBeenCalled();
    });

    it('should respect exclude patterns and remain idempotent', async () => {
      const fileContent = `[Admin](/docs/ja/admin/settings)`;
      const expected = `[Admin](/docs/ja/admin/settings)`;

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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/docs/[locale]',
          excludeStaticUrls: ['/docs/[locale]/admin/**'],
        },
      };

      await localizeStaticUrls(createSettings(settings), ['ja']);
      expect(vi.mocked(fs.promises.readFile)).toHaveBeenCalled();
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: false,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: false,
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/en/images'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: false,
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/en/images'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: false,
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/en/images/**', '/docs/en/snippets/**'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/[locale]/images/**'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/images/**'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/images/**'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/images/**', '/docs/snippets/**'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/images/**'],
            experimentalHideDefaultLocale: true,
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/en/images/**', '/docs/en/snippets/**'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: [],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
            // excludeStaticUrls not provided
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
            excludeStaticUrls: ['/docs/[locale]/{images,assets}/**'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/[locale]',
            excludeStaticUrls: ['/[locale]/images/**'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/[locale]',
            excludeStaticUrls: ['/[locale]/images/**'],
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/api-docs/[locale]',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: 'docs/[locale]', // No leading slash
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          // docsUrlPattern not provided - should default to '/[locale]'
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', locale],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            experimentalHideDefaultLocale: true,
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
            experimentalHideDefaultLocale: true,
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: {
            docsUrlPattern: '/docs/[locale]',
          },
        };

        await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['es'],
        options: {
          experimentalHideDefaultLocale: true,
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'ja'],
        options: {
          docsUrlPattern: '/docs/[locale]',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
      locales: ['en'],
      options: {
        docsUrlPattern: '/[locale]',
        excludeStaticUrls: ['/images/**/*', '/logo/**/*'],
        experimentalHideDefaultLocale: true,
      },
    };

    await localizeStaticUrls(createSettings(settings));

    const expectedContent = `# Default Locale Content

[Link](/guide)
<Card href="/api">API</Card>
[Another](/docs)`;

    // Verify that writeFile was called with the correct transformed content
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      'default.mdx',
      expectedContent
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
      options: {
        docsUrlPattern: '/[locale]',
        excludeStaticUrls: [],
        baseDomain: 'https://example.com',
      },
    };

    await localizeStaticUrls(createSettings(settings));

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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['fr'],
        options: {
          docsUrlPattern: '/docs/[locale]',
          baseDomain: 'https://example.com',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['fr'],
        options: {
          docsUrlPattern: '/[locale]',
          baseDomain: 'https://example.com',
          experimentalHideDefaultLocale: true,
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['fr'],
        options: {
          docsUrlPattern: '/docs/[locale]',
          baseDomain: 'https://example.com',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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
          resolvedPaths: {},
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['fr'],
        options: {
          docsUrlPattern: '/docs/[locale]',
          baseDomain: 'https://example.com',
        },
      };

      await localizeStaticUrls(createSettings(settings));
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

  // The "Auth0 patch": URLs nested inside JSX expressions (component props,
  // conditional expressions) that never surface as mdast nodes.
  describe('urls inside JSX expressions', () => {
    const runOnContent = async (fileContent: string): Promise<string> => {
      let written = '';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_path, content) => {
        written = content as string;
        return Promise.resolve();
      });
      vi.mocked(createFileMapping).mockReturnValue({
        ja: { 'test.mdx': '/path/test.mdx' },
      });
      await localizeStaticUrls(
        createSettings({
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: { docsUrlPattern: '/docs/[locale]' },
        })
      );
      return written;
    };

    it('localizes an href nested in arbitrary JSX inside a component prop', async () => {
      const content = `<ParamField body="error" type={<span><a href="/docs/en/interfaces/Error">Error</a></span>}>An error</ParamField>`;
      const written = await runOnContent(content);
      expect(written).toContain('/docs/ja/interfaces/Error');
      expect(written).not.toContain('/docs/en/interfaces/Error');
    });

    it('localizes an href inside a standalone JSX expression', async () => {
      const content = `{showBeta && <a href="/docs/en/beta">Beta</a>}`;
      const written = await runOnContent(content);
      expect(written).toContain('/docs/ja/beta');
      expect(written).not.toContain('/docs/en/beta');
    });

    it('localizes a bare string url expression on a url attribute: href={"/docs/en/x"}', async () => {
      const content = `<Card href={"/docs/en/x"}>Card</Card>`;
      const written = await runOnContent(content);
      expect(written).toContain('/docs/ja/x');
      expect(written).not.toContain('/docs/en/x');
    });

    it('leaves dynamically-computed urls untouched', async () => {
      // A real link forces a write; the dynamic href in the same file must be
      // preserved verbatim (static localization can't resolve computed URLs).
      const content = `<a href="/docs/en/real">Real</a> <a href={"/docs/" + locale + "/x"}>Dyn</a>`;
      const written = await runOnContent(content);
      expect(written).toContain('/docs/ja/real');
      expect(written).toContain('"/docs/" + locale + "/x"');
    });

    it('does not localize non-link asset attributes like src', async () => {
      // href is localized; src (an asset attr, not in the allowlist) is left
      // alone so shared, locale-agnostic assets don't get a broken locale prefix.
      const content = `<a href="/docs/en/guide">G</a> <img src="/docs/en/images/x.png" />`;
      const written = await runOnContent(content);
      expect(written).toContain('/docs/ja/guide');
      expect(written).toContain('/docs/en/images/x.png');
    });
  });

  describe('complex path handling (md/mdx)', () => {
    const run = async (
      fileContent: string,
      options: Record<string, unknown> = { docsUrlPattern: '/docs/[locale]' }
    ): Promise<string> => {
      let written = '';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_path, content) => {
        written = content as string;
        return Promise.resolve();
      });
      vi.mocked(createFileMapping).mockReturnValue({
        ja: { 'test.mdx': '/path/test.mdx' },
      });
      await localizeStaticUrls(
        createSettings({
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options,
        })
      );
      return written;
    };

    it('preserves a query string on a markdown link', async () => {
      const written = await run(`[API](/docs/en/api?tab=auth)`);
      expect(written).toContain('/docs/ja/api?tab=auth');
      expect(written).not.toContain('/docs/en/api');
    });

    it('preserves an anchor on a markdown link', async () => {
      const written = await run(`[API](/docs/en/api#config)`);
      expect(written).toContain('/docs/ja/api#config');
      expect(written).not.toContain('/docs/en/api');
    });

    it('preserves a query + anchor combination on a markdown link', async () => {
      const written = await run(`[API](/docs/en/api?tab=auth#config)`);
      expect(written).toContain('/docs/ja/api?tab=auth#config');
      expect(written).not.toContain('/docs/en/api');
    });

    it('preserves a trailing slash', async () => {
      const written = await run(`[Setup](/docs/en/setup/)`);
      expect(written).toContain('/docs/ja/setup/');
    });

    it('preserves a colon inside a query string', async () => {
      const written = await run(`[Guide](/docs/en/guide?time=12:00)`);
      expect(written).toContain('/docs/ja/guide?time=12:00');
    });

    it('leaves relative markdown links untouched while localizing absolute ones', async () => {
      const written = await run(
        `[Abs](/docs/en/guide) [Here](./neighbor) [Up](../other/page)`
      );
      expect(written).toContain('/docs/ja/guide');
      expect(written).toContain('./neighbor');
      expect(written).toContain('../other/page');
      expect(written).not.toContain('/docs/ja/neighbor');
    });

    it('preserves a query + anchor combination on an href attribute', async () => {
      const written = await run(`<a href="/docs/en/x?y=1#z">X</a>`);
      expect(written).toContain('/docs/ja/x?y=1#z');
      expect(written).not.toContain('/docs/en/x');
    });
  });

  describe('html file support', () => {
    const runHtml = async (
      fileContent: string,
      options: Record<string, unknown> = { docsUrlPattern: '/docs/[locale]' }
    ): Promise<string> => {
      let written = '';
      let wrote = false;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((_path, content) => {
        written = content as string;
        wrote = true;
        return Promise.resolve();
      });
      vi.mocked(createFileMapping).mockReturnValue({
        ja: { 'test.html': '/path/test.html' },
      });
      await localizeStaticUrls(
        createSettings({
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options,
        })
      );
      return wrote ? written : fileContent;
    };

    it('localizes an href in a simple HTML anchor', async () => {
      const written = await runHtml(`<a href="/docs/en/intro">Intro</a>`);
      expect(written).toBe(`<a href="/docs/ja/intro">Intro</a>`);
    });

    it('collects and rewrites .html files, filtering out non-link types', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        `<a href="/docs/en/x">x</a>`
      );
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
      vi.mocked(createFileMapping).mockReturnValue({
        ja: {
          'a.html': '/path/a.html',
          'b.txt': '/path/b.txt', // must be filtered out
        },
      });
      await localizeStaticUrls(
        createSettings({
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: {},
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'ja'],
          options: { docsUrlPattern: '/docs/[locale]' },
        })
      );
      // The .html file is read and rewritten; the .txt file is never touched.
      expect(fs.promises.readFile).toHaveBeenCalledWith('/path/a.html', 'utf8');
      expect(fs.promises.readFile).not.toHaveBeenCalledWith(
        '/path/b.txt',
        'utf8'
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/path/a.html',
        expect.stringContaining('/docs/ja/x')
      );
      expect(fs.promises.writeFile).not.toHaveBeenCalledWith(
        '/path/b.txt',
        expect.anything()
      );
    });

    it('preserves quote style and surrounding formatting exactly', async () => {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Docs</title>
</head>
<body>
  <nav>
    <a href="/docs/en/intro">Intro</a>
    <a href='/docs/en/api'>API</a>
  </nav>
  <p>See <a href="https://example.com/x">external</a>.</p>
</body>
</html>`;
      const expected = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Docs</title>
</head>
<body>
  <nav>
    <a href="/docs/ja/intro">Intro</a>
    <a href='/docs/ja/api'>API</a>
  </nav>
  <p>See <a href="https://example.com/x">external</a>.</p>
</body>
</html>`;
      expect(await runHtml(html)).toBe(expected);
    });

    it('skips hrefs inside comments, pre, code, script and style', async () => {
      const html = `<a href="/docs/en/live">Live</a>
<!-- <a href="/docs/en/comment">c</a> -->
<pre><a href="/docs/en/pre">p</a></pre>
<code><a href="/docs/en/code">c</a></code>
<script>var s = '<a href="/docs/en/script">s</a>';</script>
<style>/* <a href="/docs/en/style">s</a> */</style>`;
      const written = await runHtml(html);
      expect(written).toContain('/docs/ja/live');
      expect(written).toContain('/docs/en/comment');
      expect(written).toContain('/docs/en/pre');
      expect(written).toContain('/docs/en/code');
      expect(written).toContain('/docs/en/script');
      expect(written).toContain('/docs/en/style');
      expect(written).not.toContain('/docs/ja/comment');
      expect(written).not.toContain('/docs/ja/pre');
    });

    it('preserves query strings and anchors in HTML hrefs', async () => {
      const written = await runHtml(
        `<a href="/docs/en/api?tab=auth#config">API</a>`
      );
      expect(written).toBe(`<a href="/docs/ja/api?tab=auth#config">API</a>`);
    });

    it('leaves external and non-matching hrefs untouched', async () => {
      const html = `<a href="/docs/en/guide">G</a> <a href="https://x.com/docs/en/y">Y</a> <a href="/blog/en/post">B</a>`;
      const written = await runHtml(html);
      expect(written).toContain('/docs/ja/guide');
      expect(written).toContain('https://x.com/docs/en/y');
      expect(written).toContain('/blog/en/post');
    });

    it('inserts the locale when hideDefaultLocale is true', async () => {
      const written = await runHtml(`<a href="/docs/quickstart">Q</a>`, {
        docsUrlPattern: '/docs/[locale]',
        experimentalHideDefaultLocale: true,
      });
      expect(written).toBe(`<a href="/docs/ja/quickstart">Q</a>`);
    });

    it('does not localize non-href attributes like src in HTML', async () => {
      const html = `<a href="/docs/en/guide">G</a> <img src="/docs/en/images/x.png" />`;
      const written = await runHtml(html);
      expect(written).toContain('/docs/ja/guide');
      expect(written).toContain('src="/docs/en/images/x.png"');
    });

    // Regression coverage for the failure surface (attribute over-match,
    // asset/base hrefs, quote handling, unquoted values, casing, multi-line).
    it('does not localize data-href, xlink:href or other *-href attributes', async () => {
      const html = `<a href="/docs/en/x">x</a> <div data-href="/docs/en/y"></div> <use xlink:href="/docs/en/z" />`;
      const written = await runHtml(html);
      expect(written).toContain('/docs/ja/x');
      expect(written).toContain('data-href="/docs/en/y"');
      expect(written).toContain('xlink:href="/docs/en/z"');
    });

    it('does not localize href on <link> or <base> (asset / base URLs)', async () => {
      const html = `<base href="/docs/en/"><link rel="stylesheet" href="/docs/en/app.css"><a href="/docs/en/x">x</a>`;
      const written = await runHtml(html);
      expect(written).toContain('/docs/ja/x');
      expect(written).toContain('<base href="/docs/en/">');
      expect(written).toContain('href="/docs/en/app.css"');
    });

    it('preserves an apostrophe inside a double-quoted href value', async () => {
      const written = await runHtml(`<a href="/docs/en/x?name=O'Brien">x</a>`);
      expect(written).toBe(`<a href="/docs/ja/x?name=O'Brien">x</a>`);
    });

    it('preserves a double quote inside a single-quoted href value', async () => {
      const written = await runHtml(`<a href='/docs/en/x?q="hi"'>x</a>`);
      expect(written).toBe(`<a href='/docs/ja/x?q="hi"'>x</a>`);
    });

    it('localizes uppercase HREF and preserves the attribute name casing', async () => {
      const written = await runHtml(`<A HREF="/docs/en/x">x</A>`);
      expect(written).toBe(`<A HREF="/docs/ja/x">x</A>`);
    });

    it('leaves unquoted href values unchanged (documented gap, no corruption)', async () => {
      const html = `<a href=/docs/en/x>x</a> <a href="/docs/en/y">y</a>`;
      const written = await runHtml(html);
      expect(written).toContain('href=/docs/en/x');
      expect(written).toContain('/docs/ja/y');
    });

    it('localizes an href split across multiple lines of attributes', async () => {
      const written = await runHtml(
        `<a\n  class="c"\n  href="/docs/en/x"\n>x</a>`
      );
      expect(written).toContain('/docs/ja/x');
    });

    it('skips hrefs inside <code> (not only <pre>)', async () => {
      const html = `<a href="/docs/en/live">L</a> <code><a href="/docs/en/sample">s</a></code>`;
      const written = await runHtml(html);
      expect(written).toContain('/docs/ja/live');
      expect(written).toContain('/docs/en/sample');
      expect(written).not.toContain('/docs/ja/sample');
    });

    it('is idempotent on a second pass', async () => {
      const once = await runHtml(`<a href="/docs/en/x">x</a>`);
      const twice = await runHtml(once);
      expect(twice).toBe(once);
      expect(once).toBe(`<a href="/docs/ja/x">x</a>`);
    });

    it('keeps <link>/<base> protection even with a raw > inside an attribute', async () => {
      const link = await runHtml(
        `<link title="a>b" href="/docs/en/app.css"><a href="/docs/en/x">x</a>`
      );
      expect(link).toContain('href="/docs/en/app.css"');
      expect(link).toContain('/docs/ja/x');
      const base = await runHtml(
        `<base data-x="p>q" href="/docs/en/base"><a href="/docs/en/y">y</a>`
      );
      expect(base).toContain('href="/docs/en/base"');
      expect(base).toContain('/docs/ja/y');
    });

    it('localizes an href with no whitespace before it (after a quote)', async () => {
      const written = await runHtml(
        `<a class="x"href="/docs/en/nospace">n</a>`
      );
      expect(written).toContain('/docs/ja/nospace');
    });

    it('skips aria_href and dotted foo.href boundaries too', async () => {
      const html = `<a href="/docs/en/x">x</a> <div aria_href="/docs/en/a" data.href="/docs/en/b"></div>`;
      const written = await runHtml(html);
      expect(written).toContain('/docs/ja/x');
      expect(written).toContain('aria_href="/docs/en/a"');
      expect(written).toContain('data.href="/docs/en/b"');
    });
  });
});
