import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import localizeStaticImports from '../localizeStaticImports';

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

vi.mock('../../console/logging.js', () => ({
  logError: vi.fn(),
  logErrorAndExit: vi.fn(),
}));

import { createFileMapping } from '../../formats/files/fileMapping.js';

describe('localizeStaticImports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default, assume all files exist (most tests expect transformations to work)
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

      await localizeStaticImports(settings as any);

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

      await localizeStaticImports(settings as any);

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

      const mockFileContent = `import Component from '/components/en/special-component.mdx'`;

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);

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

  describe('localization behavior', () => {
    describe('with hideDefaultLocale = false', () => {
      it('should replace default locale with target locale in import statements', async () => {
        const fileContent = `import Component from '/components/en/special-component.mdx'`;
        const expected = `import Component from '/components/ja/special-component.mdx'`;

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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/components/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle double quotes in import statements', async () => {
        const fileContent = `import Component from "/components/en/special-component.mdx"`;
        const expected = `import Component from "/components/ja/special-component.mdx"`;

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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/components/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle multiple import statements', async () => {
        const fileContent = `
import Component1 from '/components/en/component1.mdx'
import Component2 from '/components/en/component2.mdx'

const text = 'Some other content'

import Component3 from '/components/en/component3.mdx'
`;
        const expected = `
import Component1 from '/components/ja/component1.mdx'
import Component2 from '/components/ja/component2.mdx'

const text = 'Some other content'

import Component3 from '/components/ja/component3.mdx'
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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/components/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle pattern without leading slash', async () => {
        const fileContent = `import Component from '/components/en/special-component.mdx'`;
        const expected = `import Component from '/components/ja/special-component.mdx'`;

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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: 'components/[locale]', // No leading slash
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle nested paths correctly', async () => {
        const fileContent = `import Component from '/docs/en/advanced/guide.mdx'`;
        const expected = `import Component from '/docs/ja/advanced/guide.mdx'`;

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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/docs/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });
    });

    describe('with hideDefaultLocale = true', () => {
      it('should add target locale to import path when hideDefaultLocale is true', async () => {
        const fileContent = `import Component from '/components/special-component.mdx'`;
        const expected = `import Component from '/components/ja/special-component.mdx'`;

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
          options: {
            docsHideDefaultLocaleImport: true,
            docsImportPattern: '/components/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle empty path after pattern', async () => {
        const fileContent = `import Component from '/components'`;
        const expected = `import Component from '/components/ja'`;

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
          options: {
            docsHideDefaultLocaleImport: true,
            docsImportPattern: '/components/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should replace default locale with target locale when hideDefaultLocale is true and import contains default locale', async () => {
        const fileContent = `import Component from '/components/en/special-component.mdx'`;
        const expected = `import Component from '/components/ja/special-component.mdx'`;

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
          options: {
            docsHideDefaultLocaleImport: true,
            docsImportPattern: '/components/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });
    });

    describe('edge cases', () => {
      it('should return unchanged content when no matching imports found', async () => {
        const fileContent = `
const something = 'value';
import SomeOtherThing from '@/other/path';
export default function Component() {}
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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/components/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle mixed quote types', async () => {
        const fileContent = `
import Component1 from '/components/en/component1.mdx'
import Component2 from "/components/en/component2.mdx"
`;
        const expected = `
import Component1 from '/components/ja/component1.mdx'
import Component2 from "/components/ja/component2.mdx"
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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/components/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle complex import patterns', async () => {
        const fileContent = `
import { Button, Card } from '/ui/en/components.mdx'
import { Table as DataTable } from '/ui/en/table.mdx'
`;
        const expected = `
import { Button, Card } from '/ui/ja/components.mdx'
import { Table as DataTable } from '/ui/ja/table.mdx'
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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/ui/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle imports with no path after locale', async () => {
        const fileContent = `import Component from '/components/en'`;
        const expected = `import Component from '/components/ja'`;

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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/components/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });
    });

    describe('different target locales', () => {
      it('should work with different target locales', async () => {
        const fileContent = `import Component from '/components/en/special-component.mdx'`;

        const testLocales = [
          {
            locale: 'fr',
            expected: `import Component from '/components/fr/special-component.mdx'`,
          },
          {
            locale: 'de',
            expected: `import Component from '/components/de/special-component.mdx'`,
          },
          {
            locale: 'es',
            expected: `import Component from '/components/es/special-component.mdx'`,
          },
        ];

        for (const { locale, expected } of testLocales) {
          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/components/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        }
      });
    });

    describe('different default locales', () => {
      it('should work with different default locales', async () => {
        const fileContent = `import Component from '/components/fr/special-component.mdx'`;
        const expected = `import Component from '/components/ja/special-component.mdx'`;

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
          defaultLocale: 'fr', // Different default locale
          locales: ['fr', 'ja'],
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/components/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });
    });

    describe('no docsImportPattern (defaults to /[locale])', () => {
      it('should use default pattern /[locale] when docsImportPattern is not provided with hideDefaultLocale false', async () => {
        const fileContent = `import Component from '/en/special-component.mdx'`;
        const expected = `import Component from '/ja/special-component.mdx'`;

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
          options: {
            docsHideDefaultLocaleImport: false,
            // docsImportPattern not provided - should default to '/[locale]'
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should use default pattern /[locale] when docsImportPattern is not provided with hideDefaultLocale true', async () => {
        const fileContent = `import Component from '/special-component.mdx'`;
        const expected = `import Component from '/ja/special-component.mdx'`;

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
          options: {
            docsHideDefaultLocaleImport: true,
            // docsImportPattern not provided - should default to '/[locale]'
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle nested paths with default pattern /[locale]', async () => {
        const fileContent = `import Component from '/en/components/special-component.mdx'`;
        const expected = `import Component from '/ja/components/special-component.mdx'`;

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
          options: {
            docsHideDefaultLocaleImport: false,
            // docsImportPattern not provided - should default to '/[locale]'
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle empty options object (no docsImportPattern or docsHideDefaultLocaleImport)', async () => {
        const fileContent = `import Component from '/en/special-component.mdx'`;
        const expected = `import Component from '/ja/special-component.mdx'`;

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
          // No options object at all
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle undefined docsImportPattern specifically', async () => {
        const fileContent = `import Component from '/en/special-component.mdx'`;
        const expected = `import Component from '/ja/special-component.mdx'`;

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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: undefined, // Explicitly undefined
          },
        };

        await localizeStaticImports(settings as any);
      });
    });

    describe('exclude parameter functionality', () => {
      describe('with docsHideDefaultLocaleImport = false', () => {
        it('should exclude import statements matching exact paths', async () => {
          const fileContent = `
import Guide from '/components/en/guide.mdx'  
import Images from '/components/en/images.mdx'
import API from '/components/en/api.mdx'
`;
          const expected = `
import Guide from '/components/ja/guide.mdx'  
import Images from '/components/en/images.mdx'
import API from '/components/ja/api.mdx'
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/components/[locale]',
              excludeStaticImports: ['/components/en/images.mdx'],
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should exclude paths matching glob patterns', async () => {
          const fileContent = `
import Guide from '/components/en/guide.mdx'
import Image1 from '/components/en/images/photo.mdx'  
import Snippet from '/components/en/snippets/code.mdx'
`;
          const expected = `
import Guide from '/components/ja/guide.mdx'
import Image1 from '/components/en/images/photo.mdx'  
import Snippet from '/components/en/snippets/code.mdx'
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/components/[locale]',
              excludeStaticImports: [
                '/components/en/images/**',
                '/components/en/snippets/**',
              ],
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle [locale] placeholder in exclude patterns', async () => {
          const fileContent = `
import Guide from '/components/en/guide.mdx'
import Images from '/components/en/images/logo.mdx'
`;
          const expected = `
import Guide from '/components/ja/guide.mdx'
import Images from '/components/en/images/logo.mdx'
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/components/[locale]',
              excludeStaticImports: ['/components/[locale]/images/**'],
            },
          };

          await localizeStaticImports(settings as any);
        });
      });

      describe('with docsHideDefaultLocaleImport = true', () => {
        it('should exclude import statements matching exact paths', async () => {
          const fileContent = `
import Guide from '/components/guide.mdx'
import Images from '/components/images.mdx'
import API from '/components/api.mdx'
`;
          const expected = `
import Guide from '/components/ja/guide.mdx'
import Images from '/components/images.mdx'
import API from '/components/ja/api.mdx'
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/components/[locale]',
              excludeStaticImports: ['/components/images.mdx'],
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should exclude paths matching glob patterns', async () => {
          const fileContent = `
import Guide from '/components/guide.mdx'
import Image1 from '/components/images/photo.mdx'
import Snippet from '/components/snippets/code.mdx'
`;
          const expected = `
import Guide from '/components/ja/guide.mdx'
import Image1 from '/components/images/photo.mdx'
import Snippet from '/components/snippets/code.mdx'
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/components/[locale]',
              excludeStaticImports: [
                '/components/images/**',
                '/components/snippets/**',
              ],
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle [locale] placeholder in exclude patterns with hideDefaultLocale', async () => {
          const fileContent = `
import Guide from '/components/guide.mdx'
import Images from '/components/images/logo.mdx'
`;
          const expected = `
import Guide from '/components/ja/guide.mdx'
import Images from '/components/images/logo.mdx'
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/components/[locale]',
              excludeStaticImports: ['/components/images/**'],
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle [locale] placeholder without pathContent', async () => {
          const fileContent = `
import Guide from '/components'
import Images from '/components/images/logo.mdx'
`;
          const expected = `
import Guide from '/components/ja'
import Images from '/components/images/logo.mdx'
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/components/[locale]',
              excludeStaticImports: ['/components/images/**'],
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle [locale] placeholder without pathContent with a default locale import', async () => {
          const fileContent = `
import Guide from '/components'
import Images from '/components/en/images/logo.mdx'
`;
          const expected = `
import Guide from '/components/ja'
import Images from '/components/en/images/logo.mdx'
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/components/[locale]',
              excludeStaticImports: ['/components/[locale]/images/**'],
            },
          };

          await localizeStaticImports(settings as any);
        });
      });

      describe('edge cases for excludes', () => {
        it('should work when exclude array is empty', async () => {
          const fileContent = `import Guide from '/components/en/guide.mdx'`;
          const expected = `import Guide from '/components/ja/guide.mdx'`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/components/[locale]',
              excludeStaticImports: [],
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should work when exclude parameter is undefined', async () => {
          const fileContent = `import Guide from '/components/en/guide.mdx'`;
          const expected = `import Guide from '/components/ja/guide.mdx'`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/components/[locale]',
              // excludeStaticImports not provided
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle complex glob patterns', async () => {
          const fileContent = `
import Image1 from '/components/en/images/photos/photo1.mdx'
import Image2 from '/components/en/images/icons/icon.mdx'
import Asset from '/components/en/assets/logo.mdx'
import Guide from '/components/en/guide.mdx'
`;
          const expected = `
import Image1 from '/components/en/images/photos/photo1.mdx'
import Image2 from '/components/en/images/icons/icon.mdx'
import Asset from '/components/en/assets/logo.mdx'
import Guide from '/components/ja/guide.mdx'
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/components/[locale]',
              excludeStaticImports: ['/components/[locale]/{images,assets}/**'],
            },
          };

          await localizeStaticImports(settings as any);
        });
      });

      describe('ignores import-like text in MDX content', () => {
        it('should only rewrite real import statements, not code snippets or text', async () => {
          const fileContent = `
import Real from '/components/en/real.mdx'

Here is code: \`import Fake from '/components/en/fake.mdx'\`

\`\`\`js
import Fence from '/components/en/fence.mdx'
\`\`\`
`;
          const expected = `
import Real from '/components/ja/real.mdx'

Here is code: \`import Fake from '/components/en/fake.mdx'\`

\`\`\`js
import Fence from '/components/en/fence.mdx'
\`\`\`
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation((_, content) => {
            expect(content).toBe(expected);
            return Promise.resolve();
          });

          const mockFileMapping = { ja: { 'test.mdx': '/path/test.mdx' } };
          vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

          const settings = {
            files: {
              placeholderPaths: { docs: '/docs' },
              resolvedPaths: ['test'],
              transformPaths: {},
            },
            defaultLocale: 'en',
            locales: ['en', 'ja'],
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/components/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });
      });
    });
  });

  describe('default locale import adjustments', () => {
    describe('with hideDefaultLocale = false (default locale has its own directory)', () => {
      describe('when processing default locale files', () => {
        it('should add default locale to imports without locale prefix', async () => {
          const fileContent = `import SnippetIntro from '/snippets/snippet-intro.mdx';`;
          const expected = `import SnippetIntro from '/snippets/en/snippet-intro.mdx';`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: { 'test.mdx': '/path/test.mdx' },
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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle real-world scenario - file in en directory with missing locale in imports', async () => {
          const fileContent = `---
title: "Reusable snippets"
description: "Reusable, custom snippets to keep content in sync"
icon: "recycle"
---

import SnippetIntro from '/snippets/snippet-intro.mdx';

<SnippetIntro />`;
          const expected = `---
title: "Reusable snippets"
description: "Reusable, custom snippets to keep content in sync"
icon: "recycle"
---

import SnippetIntro from '/snippets/en/snippet-intro.mdx';

<SnippetIntro />`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: {
              'reusable-snippets.mdx':
                '/path/en/essentials/reusable-snippets.mdx',
            },
          };
          vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

          const settings = {
            files: {
              placeholderPaths: { docs: '/docs' },
              resolvedPaths: ['reusable-snippets'],
              transformPaths: {},
            },
            defaultLocale: 'en',
            locales: ['en', 'ja'],
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle exact user scenario - snippets pattern', async () => {
          const fileContent = `---
title: "Reusable snippets"
description: "Reusable, custom snippets to keep content in sync"
icon: "recycle"
---

import SnippetIntro from '/snippets/snippet-intro.mdx';

<SnippetIntro />`;
          const expected = `---
title: "Reusable snippets"
description: "Reusable, custom snippets to keep content in sync"
icon: "recycle"
---

import SnippetIntro from '/snippets/en/snippet-intro.mdx';

<SnippetIntro />`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: {
              'reusable-snippets.mdx':
                '/path/en/essentials/reusable-snippets.mdx',
            },
          };
          vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

          const settings = {
            files: {
              placeholderPaths: { docs: '/docs' },
              resolvedPaths: ['reusable-snippets'],
              transformPaths: {},
            },
            defaultLocale: 'en',
            locales: ['en', 'ja'],
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should not modify imports that already have the default locale', async () => {
          const fileContent = `import Component from '/snippets/en/component.mdx';`;
          const expected = fileContent; // Should remain unchanged

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: { 'test.mdx': '/path/test.mdx' },
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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle multiple imports with mixed patterns', async () => {
          const fileContent = `
import Component1 from '/snippets/intro.mdx';
import Component2 from '/snippets/en/existing.mdx';
import Component3 from '/snippets/outro.mdx';
`;
          const expected = `
import Component1 from '/snippets/en/intro.mdx';
import Component2 from '/snippets/en/existing.mdx';
import Component3 from '/snippets/en/outro.mdx';
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: { 'test.mdx': '/path/test.mdx' },
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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should work with different quote types', async () => {
          const fileContent = `
import Component1 from '/snippets/single.mdx';
import Component2 from "/snippets/double.mdx";
`;
          const expected = `
import Component1 from '/snippets/en/single.mdx';
import Component2 from "/snippets/en/double.mdx";
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: { 'test.mdx': '/path/test.mdx' },
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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle nested path patterns', async () => {
          const fileContent = `import Guide from '/docs/advanced/guide.mdx';`;
          const expected = `import Guide from '/docs/en/advanced/guide.mdx';`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: { 'test.mdx': '/path/test.mdx' },
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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/docs/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });
      });

      describe('when processing non-default locale files', () => {
        it('should continue to work as before for non-default locales', async () => {
          const fileContent = `import Component from '/snippets/en/component.mdx';`;
          const expected = `import Component from '/snippets/ja/component.mdx';`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: false,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });
      });
    });

    describe('with hideDefaultLocale = true (default locale at root)', () => {
      describe('when processing default locale files', () => {
        it('should remove default locale from imports with locale prefix', async () => {
          const fileContent = `import SnippetIntro from '/snippets/en/snippet-intro.mdx';`;
          const expected = `import SnippetIntro from '/snippets/snippet-intro.mdx';`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: { 'test.mdx': '/path/test.mdx' },
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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should not modify imports that already have the correct format', async () => {
          const fileContent = `import Component from '/snippets/component.mdx';`;
          const expected = fileContent; // Should remain unchanged

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: { 'test.mdx': '/path/test.mdx' },
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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle multiple imports with mixed patterns', async () => {
          const fileContent = `
import Component1 from '/snippets/en/intro.mdx';
import Component2 from '/snippets/existing.mdx';
import Component3 from '/snippets/en/outro.mdx';
`;
          const expected = `
import Component1 from '/snippets/intro.mdx';
import Component2 from '/snippets/existing.mdx';
import Component3 from '/snippets/outro.mdx';
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: { 'test.mdx': '/path/test.mdx' },
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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should work with different quote types', async () => {
          const fileContent = `
import Component1 from '/snippets/en/single.mdx';
import Component2 from "/snippets/en/double.mdx";
`;
          const expected = `
import Component1 from '/snippets/single.mdx';
import Component2 from "/snippets/double.mdx";
`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: { 'test.mdx': '/path/test.mdx' },
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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });

        it('should handle nested path patterns', async () => {
          const fileContent = `import Guide from '/docs/en/advanced/guide.mdx';`;
          const expected = `import Guide from '/docs/advanced/guide.mdx';`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

          const mockFileMapping = {
            en: { 'test.mdx': '/path/test.mdx' },
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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/docs/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });
      });

      describe('when processing non-default locale files', () => {
        it('should continue to work as before for non-default locales', async () => {
          const fileContent = `import Component from '/snippets/component.mdx';`;
          const expected = `import Component from '/snippets/ja/component.mdx';`;

          vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
          vi.mocked(fs.promises.writeFile).mockImplementation(
            (path, content) => {
              expect(content).toBe(expected);
              return Promise.resolve();
            }
          );

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
            options: {
              docsHideDefaultLocaleImport: true,
              docsImportPattern: '/snippets/[locale]',
            },
          };

          await localizeStaticImports(settings as any);
        });
      });
    });

    describe('default locale files not in fileMapping', () => {
      it('should process default locale files even when not in fileMapping (real-world scenario)', async () => {
        const fileContent = `import SnippetIntro from '/snippets/snippet-intro.mdx';`;
        const expected = `import SnippetIntro from '/snippets/en/snippet-intro.mdx';`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          // Only check the content for the default locale file (en)
          if (path === '/path/en/essentials/reusable-snippets.mdx') {
            expect(content).toBe(expected);
          }
          return Promise.resolve();
        });

        // Simulate real scenario: only fr in fileMapping, but en files exist in sourceFiles
        const mockFileMapping = {
          fr: {
            'reusable-snippets.mdx':
              '/path/fr/essentials/reusable-snippets.mdx',
          },
          // Note: no 'en' key, which is the real-world scenario
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: {
              mdx: ['/path/en/essentials/reusable-snippets.mdx'], // Source file exists
            },
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'fr'], // en is in locales but not being translated
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/snippets/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should handle non-default locale files that have imports without locale (real-world case)', async () => {
        // This tests the scenario where French files have '/snippets/file.mdx' instead of '/snippets/en/file.mdx'
        const fileContent = `---
title: "Extraits réutilisables"
description: "Extraits personnalisés réutilisables pour maintenir le contenu synchronisé"
icon: "recycle"
---

import SnippetIntro from '/snippets/snippet-intro.mdx';

<SnippetIntro />`;
        const expected = `---
title: "Extraits réutilisables"
description: "Extraits personnalisés réutilisables pour maintenir le contenu synchronisé"
icon: "recycle"
---

import SnippetIntro from '/snippets/fr/snippet-intro.mdx';

<SnippetIntro />`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          // Only check the French file
          if (path === '/path/fr/essentials/reusable-snippets.mdx') {
            expect(content).toBe(expected);
          }
          return Promise.resolve();
        });

        const mockFileMapping = {
          fr: {
            'reusable-snippets.mdx':
              '/path/fr/essentials/reusable-snippets.mdx',
          },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: { mdx: [] }, // No default locale files
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'fr'],
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/snippets/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should still handle standard case where imports already have default locale', async () => {
        const fileContent = `import SnippetIntro from '/snippets/en/snippet-intro.mdx';`;
        const expected = `import SnippetIntro from '/snippets/fr/snippet-intro.mdx';`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
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
            resolvedPaths: { mdx: [] },
            transformPaths: {},
          },
          defaultLocale: 'en',
          locales: ['en', 'fr'],
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/snippets/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });
    });

    describe('edge cases for default locale handling', () => {
      it('should respect exclusion patterns when adjusting default locale imports', async () => {
        const fileContent = `
import Component1 from '/snippets/intro.mdx';
import Component2 from '/snippets/excluded.mdx';
`;
        const expected = `
import Component1 from '/snippets/en/intro.mdx';
import Component2 from '/snippets/excluded.mdx';
`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          en: { 'test.mdx': '/path/test.mdx' },
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
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/snippets/[locale]',
            excludeStaticImports: ['/snippets/excluded.mdx'],
          },
        };

        await localizeStaticImports(settings as any);
      });

      it('should work with different default locales', async () => {
        const fileContent = `import Component from '/snippets/component.mdx';`;
        const expected = `import Component from '/snippets/fr/component.mdx';`;

        vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
        vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
          expect(content).toBe(expected);
          return Promise.resolve();
        });

        const mockFileMapping = {
          fr: { 'test.mdx': '/path/test.mdx' },
        };
        vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

        const settings = {
          files: {
            placeholderPaths: { docs: '/docs' },
            resolvedPaths: ['test'],
            transformPaths: {},
          },
          defaultLocale: 'fr',
          locales: ['fr', 'ja'],
          options: {
            docsHideDefaultLocaleImport: false,
            docsImportPattern: '/snippets/[locale]',
          },
        };

        await localizeStaticImports(settings as any);
      });
    });
  });

  describe('invalid MDX error handling', () => {
    it('should return original content unchanged when MDX starts with closing tag', async () => {
      const invalidFileContent = `</Component>
import ValidComponent from '/components/en/valid.mdx'`;

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should return original content unchanged when MDX has unclosed JSX tags', async () => {
      const invalidFileContent = `<Card title="Test">
import Component from '/components/en/test.mdx'
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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should return original content unchanged when MDX has nested unclosed tags', async () => {
      const invalidFileContent = `<Card>
  <Button>
    <Icon name="test"
  </Button>
</Card>

import Component from '/components/en/test.mdx'`;

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should return original content unchanged when MDX has mismatched JSX tags', async () => {
      const invalidFileContent = `<Card title="Test">
  import Component from '/components/en/test.mdx'
</NotCard>

Some content here`;

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should return original content unchanged when MDX has invalid JSX attributes', async () => {
      const invalidFileContent = `<Card title=invalid-attribute>
  import Component from '/components/en/test.mdx'
</Card>`;

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should return original content unchanged when MDX has complex invalid syntax', async () => {
      const invalidFileContent = `import Component from '/components/en/valid.mdx'

<Card>
  <nested-tag without-proper-closing>
    import AnotherComponent from '/components/en/another.mdx'
  </different-closing-tag>
</Card`;

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);
    });
  });

  describe('file existence checking', () => {
    it('should not transform imports when target file does not exist', async () => {
      const fileContent = `import Component from '/components/en/component.mdx'`;
      const expected = fileContent; // Should remain unchanged

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      // Mock file existence - target file doesn't exist
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        // Only the original /components/en/component.mdx exists
        return (
          typeof filePath === 'string' && filePath.includes('/components/en/')
        );
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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should transform imports when target file exists', async () => {
      const fileContent = `import Component from '/components/en/component.mdx'`;
      const expected = `import Component from '/components/ja/component.mdx'`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      // Mock file existence - both files exist
      vi.mocked(fs.existsSync).mockReturnValue(true);

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should check for files with common extensions', async () => {
      const fileContent = `import Component from '/components/en/component'`; // No extension
      const expected = `import Component from '/components/ja/component'`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      // Mock file existence - target exists with .mdx extension
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        const pathStr = String(filePath);
        // The transformed path /components/ja/component should match when we try with .mdx extension
        return pathStr.includes('/components/ja/component');
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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should handle mixed scenarios - some files exist, others do not', async () => {
      const fileContent = `
import ExistingComponent from '/components/en/existing.mdx'
import MissingComponent from '/components/en/missing.mdx'
import AnotherExisting from '/components/en/another.mdx'
`;
      const expected = `
import ExistingComponent from '/components/ja/existing.mdx'
import MissingComponent from '/components/en/missing.mdx'
import AnotherExisting from '/components/ja/another.mdx'
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      // Mock file existence - only some target files exist
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        const pathStr = String(filePath);
        return (
          pathStr.includes('existing.mdx') || pathStr.includes('another.mdx')
        );
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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should handle relative import paths with proper separator', async () => {
      const fileContent = `import Component from '../en/component.mdx'`;
      const expected = `import Component from '../ja/component.mdx'`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      // Mock file existence - relative path resolution should work
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const mockFileMapping = {
        ja: { 'test.mdx': '/project/subdir/test.mdx' },
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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '../[locale]/', // Relative pattern with trailing slash
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should handle absolute/root import paths', async () => {
      const fileContent = `import Component from '/components/en/component.mdx'`;
      const expected = `import Component from '/components/ja/component.mdx'`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      // Mock file existence - absolute path resolution should work
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const mockFileMapping = {
        ja: { 'test.mdx': '/project/test.mdx' },
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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]', // Absolute pattern
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should not transform relative paths when target file does not exist', async () => {
      const fileContent = `import Component from './en/component.mdx'`;
      const expected = fileContent; // Should remain unchanged

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      // Mock file existence - target relative file doesn't exist
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        const pathStr = String(filePath);
        // Only original ./en/component.mdx exists (relative to current file)
        return pathStr.includes('/en/component.mdx') && !pathStr.includes('/ja/');
      });

      const mockFileMapping = {
        ja: { 'test.mdx': '/project/subdir/test.mdx' },
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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: './[locale]', // Relative pattern
        },
      };

      await localizeStaticImports(settings as any);
    });
  });

  describe('complex nested patterns', () => {
    it('should handle deeply nested locale patterns', async () => {
      const fileContent = `import Guide from '/docs/advanced/en/tutorials/guide.mdx'`;
      const expected = `import Guide from '/docs/advanced/ja/tutorials/guide.mdx'`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/docs/advanced/[locale]/tutorials/',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should handle locale at root level', async () => {
      const fileContent = `import Component from '/en/docs/components/button.mdx'`;
      const expected = `import Component from '/ja/docs/components/button.mdx'`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/[locale]/docs/',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should handle complex relative patterns with multiple levels', async () => {
      const fileContent = `import Shared from '../../shared/en/components/header.mdx'`;
      const expected = `import Shared from '../../shared/ja/components/header.mdx'`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '../../shared/[locale]/components/',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should not transform paths that contain pattern but are not at the expected position', async () => {
      const fileContent = `import Component from '/other/components/en/nested.mdx'`;
      const expected = fileContent; // Should remain unchanged

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/components/[locale]/', // Pattern doesn't match the path structure
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should handle patterns with multiple path segments after locale', async () => {
      const fileContent = `import Guide from '/docs/en/category/subcategory/guide.mdx'`;
      const expected = `import Guide from '/docs/ja/category/subcategory/guide.mdx'`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '/docs/[locale]/',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should add locale to relative imports in non-default locale files', async () => {
      const fileContent = `import Button from '../components/button.mdx'`; // No locale in source
      const expected = `import Button from '../components/es/button.mdx'`; // Should add locale

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '../components/[locale]/',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should add locale to current directory relative imports', async () => {
      const fileContent = `import Modal from './shared/modal.mdx'`; // No locale in source
      const expected = `import Modal from './shared/fr/modal.mdx'`; // Should add locale

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const mockFileMapping = {
        fr: { 'test.mdx': '/path/fr/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: ['test'],
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: './shared/[locale]/',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should handle deeply nested relative imports without locale', async () => {
      const fileContent = `import Utils from '../../utils/helpers/formatter.mdx'`; // No locale
      const expected = `import Utils from '../../utils/helpers/de/formatter.mdx'`; // Should add locale

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);

      const mockFileMapping = {
        de: { 'test.mdx': '/path/de/test.mdx' },
      };
      vi.mocked(createFileMapping).mockReturnValue(mockFileMapping);

      const settings = {
        files: {
          placeholderPaths: { docs: '/docs' },
          resolvedPaths: ['test'],
          transformPaths: {},
        },
        defaultLocale: 'en',
        locales: ['en', 'de'],
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '../../utils/helpers/[locale]/',
        },
      };

      await localizeStaticImports(settings as any);
    });

    it('should not add locale to relative imports when target file does not exist', async () => {
      const fileContent = `import Missing from '../components/missing.mdx'`; // No locale in source
      const expected = fileContent; // Should remain unchanged since target doesn't exist

      vi.mocked(fs.promises.readFile).mockResolvedValue(fileContent);
      vi.mocked(fs.promises.writeFile).mockImplementation((path, content) => {
        expect(content).toBe(expected);
        return Promise.resolve();
      });

      // Mock that the target with locale doesn't exist
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        const pathStr = String(filePath);
        // Original file exists, but not the one with locale added
        return pathStr.includes('missing.mdx') && !pathStr.includes('/ja/');
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
        options: {
          docsHideDefaultLocaleImport: false,
          docsImportPattern: '../components/[locale]/',
        },
      };

      await localizeStaticImports(settings as any);
    });
  });
});
