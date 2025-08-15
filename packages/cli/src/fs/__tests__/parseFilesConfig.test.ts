import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveLocaleFiles,
  resolveFiles,
  expandGlobPatterns,
} from '../config/parseFilesConfig';
import { SUPPORTED_FILE_EXTENSIONS } from '../../formats/files/supportedFiles.js';
import { ResolvedFiles } from '../../types/index.js';

// Mock fast-glob
vi.mock('fast-glob', () => ({
  default: {
    sync: vi.fn(),
  },
}));

// Mock logging module
vi.mock('../../console/logging.js', () => ({
  logWarning: vi.fn(),
}));

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    yellow: vi.fn((str) => str),
  },
}));

// Mock localeUtils
vi.mock('../localeUtils.js', () => ({
  detectExcludedLocaleDirectories: vi.fn(),
}));

import fg from 'fast-glob';
import { logWarning } from '../../console/logging.js';
import { detectExcludedLocaleDirectories } from '../localeUtils.js';

describe('parseFilesConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default return value for auto-exclude function to prevent existing tests from breaking
    vi.mocked(detectExcludedLocaleDirectories).mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveLocaleFiles', () => {
    it('should replace [locale] with the actual locale in all file paths', () => {
      const files = {
        json: ['src/[locale]/messages.json', 'assets/[locale]/config.json'],
        yaml: ['data/[locale]/content.yaml'],
        gt: 'dist/[locale].json',
      };

      const result = resolveLocaleFiles(files, 'fr');

      expect(result).toEqual({
        json: ['src/fr/messages.json', 'assets/fr/config.json'],
        yaml: ['data/fr/content.yaml'],
        gt: 'dist/fr.json',
      });
    });

    it('should handle empty file arrays', () => {
      const files = {
        json: [],
        yaml: undefined,
        gt: undefined,
      };

      const result = resolveLocaleFiles(files, 'es');

      expect(result).toEqual({
        json: [],
        yaml: undefined,
        gt: undefined,
      });
    });

    it('should replace multiple [locale] occurrences in the same path', () => {
      const files = {
        json: ['src/[locale]/[locale]-messages.json'],
        gt: 'dist/[locale]/[locale].json',
      };

      const result = resolveLocaleFiles(files, 'zh-CN');

      expect(result).toEqual({
        json: ['src/zh-CN/zh-CN-messages.json'],
        gt: 'dist/zh-CN/zh-CN.json',
      });
    });

    it('should handle files without [locale] placeholder', () => {
      const files = {
        json: ['src/common/messages.json'],
        yaml: ['config/settings.yaml'],
        gt: 'dist/translations.json',
      };

      const result = resolveLocaleFiles(files, 'de');

      expect(result).toEqual({
        json: ['src/common/messages.json'],
        yaml: ['config/settings.yaml'],
        gt: 'dist/translations.json',
      });
    });

    it('should process all supported file extensions', () => {
      const files: ResolvedFiles = {};
      for (const ext of SUPPORTED_FILE_EXTENSIONS) {
        files[ext] = [`test/[locale]/file.${ext}`];
      }
      files.gt = 'output/[locale].json';

      const result = resolveLocaleFiles(files, 'ja');

      for (const ext of SUPPORTED_FILE_EXTENSIONS) {
        expect(result[ext]).toEqual([`test/ja/file.${ext}`]);
      }
      expect(result.gt).toBe('output/ja.json');
    });
  });

  describe('resolveFiles', () => {
    beforeEach(() => {
      vi.mocked(fg.sync).mockReturnValue([]);
    });

    const defaultLocales = ['en', 'fr', 'es'];

    it('should resolve files with include patterns', () => {
      const files = {
        json: {
          include: ['src/[locale]/*.json'],
          exclude: ['src/[locale]/ignore.json'],
        },
      };

      vi.mocked(fg.sync).mockReturnValue([
        '/project/src/en/messages.json',
        '/project/src/en/common.json',
      ]);

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.resolvedPaths.json).toEqual([
        '/project/src/en/messages.json',
        '/project/src/en/common.json',
      ]);
      expect(result.placeholderPaths.json).toEqual([
        '/project/src/[locale]/messages.json',
        '/project/src/[locale]/common.json',
      ]);
    });

    it('should handle GT output files', () => {
      const files = {
        gt: {
          output: 'dist/[locale].json',
        },
      };

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.placeholderPaths.gt).toBe('/project/dist/[locale].json');
    });

    it('should handle transform options as string', () => {
      const files = {
        json: {
          include: ['src/[locale]/*.json'],
          transform: 'output/[locale]/',
        },
      };

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.transformPaths.json).toBe('output/[locale]/');
    });

    it('should handle transform options as TransformOption object', () => {
      const files = {
        json: {
          include: ['src/[locale]/*.json'],
          transform: {
            match: 'pattern',
            replace: 'output/[locale]/',
          },
        },
      };

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.transformPaths.json).toEqual({
        match: 'pattern',
        replace: 'output/[locale]/',
      });
    });

    it('should handle transform options as object', () => {
      const files = {
        json: {
          include: ['src/[locale]/*.json'],
          transform: {
            match: 'pattern',
            replace: 'replacement',
          },
        },
      };

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.transformPaths.json).toEqual({
        match: 'pattern',
        replace: 'replacement',
      });
    });

    it('should handle TransformOption with optional match', () => {
      const files = {
        json: {
          include: ['src/[locale]/*.json'],
          transform: {
            replace: 'output/[locale]/',
          },
        },
      };

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.transformPaths.json).toEqual({
        replace: 'output/[locale]/',
      });
    });

    it('should handle files without transform options', () => {
      const files = {
        json: {
          include: ['src/[locale]/*.json'],
        },
      };

      vi.mocked(fg.sync).mockReturnValue(['/project/src/en/messages.json']);

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.transformPaths.json).toBeUndefined();
      expect(result.resolvedPaths.json).toEqual([
        '/project/src/en/messages.json',
      ]);
    });

    it('should handle mixed transform types across file extensions', () => {
      const files = {
        json: {
          include: ['src/[locale]/*.json'],
          transform: 'output/[locale]/',
        },
        yaml: {
          include: ['data/[locale]/*.yaml'],
          transform: {
            match: 'test',
            replace: 'processed/[locale]/',
          },
        },
        md: {
          include: ['docs/[locale]/*.md'],
        },
      };

      vi.mocked(fg.sync)
        .mockReturnValueOnce(['/project/src/en/messages.json'])
        .mockReturnValueOnce(['/project/data/en/config.yaml'])
        .mockReturnValueOnce(['/project/docs/en/readme.md']);

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.transformPaths.json).toBe('output/[locale]/');
      expect(result.transformPaths.yaml).toEqual({
        match: 'test',
        replace: 'processed/[locale]/',
      });
      expect(result.transformPaths.md).toBeUndefined();
    });

    it('should handle files without include patterns', () => {
      const files = {
        gt: {
          output: 'dist/[locale].json',
        },
      };

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.resolvedPaths.json).toBeUndefined();
      expect(result.resolvedPaths.yaml).toBeUndefined();
      expect(result.placeholderPaths.gt).toBe('/project/dist/[locale].json');
    });

    it('should process multiple file types', () => {
      const files = {
        json: { include: ['src/[locale]/*.json'] },
        yaml: { include: ['data/[locale]/*.yaml'] },
        gt: { output: 'dist/[locale].json' },
      };

      vi.mocked(fg.sync)
        .mockReturnValueOnce(['/project/src/en/messages.json'])
        .mockReturnValueOnce(['/project/data/en/content.yaml']);

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.resolvedPaths.json).toEqual([
        '/project/src/en/messages.json',
      ]);
      expect(result.resolvedPaths.yaml).toEqual([
        '/project/data/en/content.yaml',
      ]);
      expect(result.placeholderPaths.gt).toBe('/project/dist/[locale].json');
    });

    it('should handle complex exclude patterns in resolveFiles', () => {
      const files = {
        json: {
          include: ['src/[locale]/**/*.json'],
          exclude: [
            'src/[locale]/**/*.test.json',
            'src/[locale]/node_modules/**',
            'temp/[locales]/*.json',
          ],
        },
        yaml: {
          include: ['docs/[locale]/*.yaml'],
          exclude: ['docs/[locale]/drafts/**'],
        },
      };

      vi.mocked(fg.sync)
        .mockReturnValueOnce(['/project/src/en/app/config.json'])
        .mockReturnValueOnce(['/project/docs/en/guide.yaml']);

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      // Verify exclude patterns were passed correctly to expandGlobPatterns
      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/**/*.json', {
        absolute: true,
        ignore: [
          // Test exclusions (deduplicated)
          '/project/src/en/**/*.test.json',
          // Node modules exclusions (deduplicated)
          '/project/src/en/node_modules/**',
          // Temp exclusions with [locales] (unique per locale)
          '/project/temp/en/*.json',
          '/project/temp/fr/*.json',
          '/project/temp/es/*.json',
        ],
      });

      expect(fg.sync).toHaveBeenCalledWith('/project/docs/en/*.yaml', {
        absolute: true,
        ignore: [
          // Drafts exclusions (deduplicated)
          '/project/docs/en/drafts/**',
        ],
      });

      expect(result.resolvedPaths.json).toEqual([
        '/project/src/en/app/config.json',
      ]);
      expect(result.resolvedPaths.yaml).toEqual([
        '/project/docs/en/guide.yaml',
      ]);
    });

    it('should handle files with exclude patterns but no matches', () => {
      const files = {
        json: {
          include: ['src/[locale]/*.json'],
          exclude: ['src/[locale]/*.test.json'],
        },
      };

      vi.mocked(fg.sync).mockReturnValue([]); // No matches found

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.resolvedPaths.json).toEqual([]);
      expect(result.placeholderPaths.json).toEqual([]);
    });
  });

  describe('expandGlobPatterns', () => {
    beforeEach(() => {
      vi.mocked(fg.sync).mockReturnValue([]);
    });

    const defaultLocales = ['en', 'fr', 'es'];

    it('should expand glob patterns and return resolved and placeholder paths', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = ['src/[locale]/ignore.json'];

      vi.mocked(fg.sync).mockReturnValue([
        '/project/src/en/messages.json',
        '/project/src/en/common.json',
      ]);

      const result = expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'en',
        defaultLocales
      );

      expect(result.resolvedPaths).toEqual([
        '/project/src/en/messages.json',
        '/project/src/en/common.json',
      ]);
      expect(result.placeholderPaths).toEqual([
        '/project/src/[locale]/messages.json',
        '/project/src/[locale]/common.json',
      ]);
    });

    it('should warn when pattern does not include [locale] and no transform patterns', () => {
      const includePatterns = ['src/static/*.json'];
      const excludePatterns = [];

      vi.mocked(fg.sync).mockReturnValue(['/project/src/static/config.json']);

      expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'en',
        defaultLocales
      );

      expect(logWarning).toHaveBeenCalledWith(
        'Pattern "src/static/*.json" does not include [locale], so the CLI tool may incorrectly save translated files.'
      );
    });

    it('should not warn when pattern does not include [locale] but has string transform patterns', () => {
      const includePatterns = ['src/static/*.json'];
      const excludePatterns = [];
      const transformPatterns = 'output/[locale]/';

      vi.mocked(fg.sync).mockReturnValue(['/project/src/static/config.json']);

      expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'en',
        defaultLocales,
        transformPatterns
      );

      expect(logWarning).not.toHaveBeenCalled();
    });

    it('should not warn when pattern does not include [locale] but has TransformOption patterns', () => {
      const includePatterns = ['src/static/*.json'];
      const excludePatterns = [];
      const transformPatterns = {
        match: 'pattern',
        replace: 'output/[locale]/',
      };

      vi.mocked(fg.sync).mockReturnValue(['/project/src/static/config.json']);

      expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'en',
        defaultLocales,
        transformPatterns
      );

      expect(logWarning).not.toHaveBeenCalled();
    });

    it('should handle multiple include patterns', () => {
      const includePatterns = ['src/[locale]/*.json', 'data/[locale]/*.yaml'];
      const excludePatterns = [];

      vi.mocked(fg.sync)
        .mockReturnValueOnce(['/project/src/en/messages.json'])
        .mockReturnValueOnce(['/project/data/en/content.yaml']);

      const result = expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'en',
        defaultLocales
      );

      expect(result.resolvedPaths).toEqual([
        '/project/src/en/messages.json',
        '/project/data/en/content.yaml',
      ]);
    });

    it('should handle exclude patterns with [locale] and [locales] replacement', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = [
        'src/[locale]/ignore.json',
        'temp/[locales]/cache.json',
      ];

      vi.mocked(fg.sync).mockReturnValue(['/project/src/en/messages.json']);

      expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'en',
        defaultLocales
      );

      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/*.json', {
        absolute: true,
        ignore: [
          // First pattern: src/[locale]/ignore.json (deduplicated)
          '/project/src/en/ignore.json',
          // Second pattern: temp/[locales]/cache.json expanded for each locale
          '/project/temp/en/cache.json',
          '/project/temp/fr/cache.json',
          '/project/temp/es/cache.json',
        ],
      });
    });

    it('should handle complex locale replacement in paths', () => {
      const includePatterns = ['nested/[locale]/deep/[locale]/files.json'];
      const excludePatterns = [];

      vi.mocked(fg.sync).mockReturnValue([
        '/project/nested/zh-CN/deep/zh-CN/files.json',
      ]);

      const result = expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'zh-CN',
        ['zh-CN', 'en']
      );

      expect(result.placeholderPaths).toEqual([
        '/project/nested/[locale]/deep/[locale]/files.json',
      ]);
    });

    it('should handle patterns without [locale] placeholder', () => {
      const includePatterns = ['src/static/config.json'];
      const excludePatterns = [];
      const transformPatterns = 'output/[locale]/';

      vi.mocked(fg.sync).mockReturnValue(['/project/src/static/config.json']);

      const result = expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'en',
        defaultLocales,
        transformPatterns
      );

      expect(result.resolvedPaths).toEqual(['/project/src/static/config.json']);
      expect(result.placeholderPaths).toEqual([
        '/project/src/static/config.json',
      ]);
    });

    it('should handle empty patterns', () => {
      const result = expandGlobPatterns(
        '/project',
        [],
        [],
        'en',
        defaultLocales
      );

      expect(result.resolvedPaths).toEqual([]);
      expect(result.placeholderPaths).toEqual([]);
      expect(fg.sync).not.toHaveBeenCalled();
    });

    it('should handle no glob matches', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = [];

      vi.mocked(fg.sync).mockReturnValue([]);

      const result = expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'en',
        defaultLocales
      );

      expect(result.resolvedPaths).toEqual([]);
      expect(result.placeholderPaths).toEqual([]);
    });

    it('should handle special characters in locale codes', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = [];

      vi.mocked(fg.sync).mockReturnValue([
        '/project/src/zh-Hans-CN/messages.json',
      ]);

      const result = expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'zh-Hans-CN',
        ['zh-Hans-CN', 'en']
      );

      expect(result.placeholderPaths).toEqual([
        '/project/src/[locale]/messages.json',
      ]);
    });

    it('should handle paths with multiple segments containing [locale]', () => {
      const includePatterns = ['[locale]/src/[locale]/messages.json'];
      const excludePatterns = [];

      vi.mocked(fg.sync).mockReturnValue(['/project/fr/src/fr/messages.json']);

      const result = expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'fr',
        ['fr', 'en']
      );

      expect(result.placeholderPaths).toEqual([
        '/project/[locale]/src/[locale]/messages.json',
      ]);
    });

    it('should handle mixed exclude patterns with [locale] and [locales]', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = [
        'src/[locale]/temp.json', // per-locale exclusion
        'cache/[locales]/files.json', // all-locales exclusion
        'static/global.json', // static exclusion
      ];

      vi.mocked(fg.sync).mockReturnValue(['/project/src/en/messages.json']);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'en', [
        'en',
        'fr',
        'de',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/*.json', {
        absolute: true,
        ignore: [
          // First pattern: src/[locale]/temp.json (deduplicated)
          '/project/src/en/temp.json',
          // Second pattern: cache/[locales]/files.json expanded for each locale
          '/project/cache/en/files.json',
          '/project/cache/fr/files.json',
          '/project/cache/de/files.json',
          // Third pattern: static/global.json (deduplicated)
          '/project/static/global.json',
        ],
      });
    });

    it('should handle exclude patterns without placeholders', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = ['src/global/config.json', 'build/temp.json'];

      vi.mocked(fg.sync).mockReturnValue(['/project/src/en/messages.json']);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'en', [
        'en',
        'fr',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/*.json', {
        absolute: true,
        ignore: [
          // Static patterns (deduplicated)
          '/project/src/global/config.json',
          '/project/build/temp.json',
        ],
      });
    });

    it('should handle exclude patterns with nested [locale] replacements', () => {
      const includePatterns = ['projects/[locale]/src/**/*.json'];
      const excludePatterns = [
        'projects/[locale]/src/[locale]/ignore.json',
        'projects/[locale]/node_modules/**/*',
      ];

      vi.mocked(fg.sync).mockReturnValue([
        '/project/projects/en/src/components/app.json',
      ]);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'en', [
        'en',
        'es',
      ]);

      expect(fg.sync).toHaveBeenCalledWith(
        '/project/projects/en/src/**/*.json',
        {
          absolute: true,
          ignore: [
            // Nested [locale] patterns (deduplicated)
            '/project/projects/en/src/en/ignore.json',
            '/project/projects/en/node_modules/**/*',
          ],
        }
      );
    });

    it('should handle exclude patterns with glob wildcards', () => {
      const includePatterns = ['src/[locale]/**/*.json'];
      const excludePatterns = [
        'src/[locale]/**/*.test.json',
        'src/[locale]/**/node_modules/**',
        'src/[locales]/temp/**/*',
      ];

      vi.mocked(fg.sync).mockReturnValue(['/project/src/en/app/config.json']);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'en', [
        'en',
        'fr',
        'ja',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/**/*.json', {
        absolute: true,
        ignore: [
          // Test file exclusions (deduplicated)
          '/project/src/en/**/*.test.json',
          // Node modules exclusions (deduplicated)
          '/project/src/en/**/node_modules/**',
          // Temp directory exclusions with [locales] (unique per locale)
          '/project/src/en/temp/**/*',
          '/project/src/fr/temp/**/*',
          '/project/src/ja/temp/**/*',
        ],
      });
    });

    it('should handle empty exclude patterns', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = [];

      vi.mocked(fg.sync).mockReturnValue(['/project/src/en/messages.json']);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'en', [
        'en',
        'fr',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/*.json', {
        absolute: true,
        ignore: [],
      });
    });

    it('should handle exclude patterns with relative paths', () => {
      const includePatterns = ['[locale]/data/*.json'];
      const excludePatterns = [
        '[locale]/data/temp.json',
        '[locales]/cache/*.json',
        'global/shared.json',
      ];

      vi.mocked(fg.sync).mockReturnValue(['/project/zh-CN/data/config.json']);

      expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'zh-CN',
        ['zh-CN', 'en-US']
      );

      expect(fg.sync).toHaveBeenCalledWith('/project/zh-CN/data/*.json', {
        absolute: true,
        ignore: [
          // [locale] patterns (deduplicated)
          '/project/zh-CN/data/temp.json',
          // [locales] patterns (unique per locale)
          '/project/zh-CN/cache/*.json',
          '/project/en-US/cache/*.json',
          // Static patterns (deduplicated)
          '/project/global/shared.json',
        ],
      });
    });

    it('should handle exclude patterns with multiple [locale] and [locales] in same pattern', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = [
        'backup/[locale]/old/[locale]/*.json',
        'cache/[locales]/build/[locales]/*.tmp',
      ];

      vi.mocked(fg.sync).mockReturnValue(['/project/src/en/app.json']);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'en', [
        'en',
        'fr',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/*.json', {
        absolute: true,
        ignore: [
          // Multiple [locale] replacements in same pattern (deduplicated)
          '/project/backup/en/old/en/*.json',
          // Multiple [locales] replacements in same pattern (unique per locale)
          '/project/cache/en/build/en/*.tmp',
          '/project/cache/fr/build/fr/*.tmp',
        ],
      });
    });
  });

  describe('auto-exclude locale directories', () => {
    beforeEach(() => {
      vi.mocked(fg.sync).mockReturnValue([]);
      vi.mocked(detectExcludedLocaleDirectories).mockReturnValue([]);
    });

    it('should auto-exclude detected locale directories not in current config', () => {
      const includePatterns = ['src/[locale]/*.mdx'];
      const excludePatterns = ['src/[locale]/ignore.mdx'];

      vi.mocked(detectExcludedLocaleDirectories).mockReturnValue(['en', 'es']);
      vi.mocked(fg.sync).mockReturnValue(['/project/src/fr/content.mdx']);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'fr', [
        'fr',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/src/fr/*.mdx', {
        absolute: true,
        ignore: [
          '/project/src/fr/ignore.mdx',
          '/project/en/**',
          '/project/es/**',
        ],
      });

      expect(detectExcludedLocaleDirectories).toHaveBeenCalledWith(
        '/project',
        ['fr'],
        'fr'
      );
    });

    it('should auto-exclude nested locale directories', () => {
      const includePatterns = ['./**/*.mdx'];
      const excludePatterns = [
        './[locales]/**/*.mdx',
        './snippets/[locales]/**/*.mdx',
      ];

      vi.mocked(detectExcludedLocaleDirectories).mockReturnValue([
        'en',
        'snippets/en',
        'snippets/es',
      ]);
      vi.mocked(fg.sync).mockReturnValue(['/project/content.mdx']);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'fr', [
        'fr',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/**/*.mdx', {
        absolute: true,
        ignore: [
          '/project/fr/**/*.mdx',
          '/project/snippets/fr/**/*.mdx',
          '/project/en/**',
          '/project/snippets/en/**',
          '/project/snippets/es/**',
        ],
      });
    });

    it('should not auto-exclude directories that are in current locales config', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = [];

      vi.mocked(detectExcludedLocaleDirectories).mockReturnValue(['en', 'es']);
      vi.mocked(fg.sync).mockReturnValue(['/project/src/fr/config.json']);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'fr', [
        'fr',
        'de',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/src/fr/*.json', {
        absolute: true,
        ignore: ['/project/en/**', '/project/es/**'],
      });

      expect(detectExcludedLocaleDirectories).toHaveBeenCalledWith(
        '/project',
        ['fr', 'de'],
        'fr'
      );
    });

    it('should combine manual exclude patterns with auto-exclude patterns', () => {
      const includePatterns = ['./**/*.mdx'];
      const excludePatterns = ['./manual-exclude/**', './temp/[locales]/**'];

      vi.mocked(detectExcludedLocaleDirectories).mockReturnValue([
        'en',
        'snippets/en',
      ]);
      vi.mocked(fg.sync).mockReturnValue(['/project/content.mdx']);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'fr', [
        'fr',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/**/*.mdx', {
        absolute: true,
        ignore: [
          '/project/manual-exclude/**',
          '/project/temp/fr/**',
          '/project/en/**',
          '/project/snippets/en/**',
        ],
      });
    });

    it('should handle empty auto-exclude results', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = ['src/[locale]/ignore.json'];

      vi.mocked(detectExcludedLocaleDirectories).mockReturnValue([]);
      vi.mocked(fg.sync).mockReturnValue(['/project/src/en/config.json']);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'en', [
        'en',
        'fr',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/*.json', {
        absolute: true,
        ignore: ['/project/src/en/ignore.json'],
      });

      expect(detectExcludedLocaleDirectories).toHaveBeenCalledWith(
        '/project',
        ['en', 'fr'],
        'en'
      );
    });

    it('should never auto-exclude the default locale', () => {
      const includePatterns = ['src/[locale]/*.json'];
      const excludePatterns = [];

      // Mock detecting 'en' directory, but since 'en' is the default locale, it should not be excluded
      vi.mocked(detectExcludedLocaleDirectories).mockReturnValue([]);
      vi.mocked(fg.sync).mockReturnValue(['/project/src/en/config.json']);

      expandGlobPatterns(
        '/project',
        includePatterns,
        excludePatterns,
        'en', // 'en' is the default locale
        ['es'] // Only 'es' in locales config
      );

      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/*.json', {
        absolute: true,
        ignore: [],
      });

      // Verify function was called with 'en' as default locale parameter
      expect(detectExcludedLocaleDirectories).toHaveBeenCalledWith(
        '/project',
        ['es'],
        'en'
      );
    });

    it('should handle complex patterns with nested auto-excludes', () => {
      const includePatterns = ['./**/*.mdx'];
      const excludePatterns = [
        './[locales]/**/*.mdx',
        './snippets/[locales]/**/*.mdx',
      ];

      vi.mocked(detectExcludedLocaleDirectories).mockReturnValue([
        'en',
        'snippets/en',
      ]);
      vi.mocked(fg.sync).mockReturnValue([
        '/project/docs/guide.mdx',
        '/project/other/content.mdx',
      ]);

      expandGlobPatterns('/project', includePatterns, excludePatterns, 'fr', [
        'fr',
      ]);

      expect(fg.sync).toHaveBeenCalledWith('/project/**/*.mdx', {
        absolute: true,
        ignore: [
          '/project/fr/**/*.mdx',
          '/project/snippets/fr/**/*.mdx',
          '/project/en/**',
          '/project/snippets/en/**',
        ],
      });
    });
  });
});
