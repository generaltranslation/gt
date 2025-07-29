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
});
