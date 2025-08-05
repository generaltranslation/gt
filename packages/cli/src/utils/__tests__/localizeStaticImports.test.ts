import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import localizeStaticImports from '../localizeStaticImports';

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

vi.mock('../../console/logging.js', () => ({
  logError: vi.fn(),
  logErrorAndExit: vi.fn(),
}));

import { createFileMapping } from '../../formats/files/fileMapping.js';

describe('localizeStaticImports', () => {
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
              experimentalExcludeStaticImports: ['/components/en/images.mdx'],
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
              experimentalExcludeStaticImports: [
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
              experimentalExcludeStaticImports: [
                '/components/[locale]/images/**',
              ],
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
              experimentalExcludeStaticImports: ['/components/images.mdx'],
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
              experimentalExcludeStaticImports: [
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
              experimentalExcludeStaticImports: ['/components/images/**'],
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
              experimentalExcludeStaticImports: [],
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
              // experimentalExcludeStaticImports not provided
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
              experimentalExcludeStaticImports: [
                '/components/[locale]/{images,assets}/**',
              ],
            },
          };

          await localizeStaticImports(settings as any);
        });
      });
    });
  });
});
