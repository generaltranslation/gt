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
vi.mock('../../console/logger.js');

// Surface logErrorAndExit as a throw so tests can assert on it
vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    yellow: vi.fn((str) => str),
  },
}));

import fg from 'fast-glob';
import { logger } from '../../console/logger.js';

describe('parseFilesConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveLocaleFiles', () => {
    it('replaces every [locale] in every supported file type and the GT output', () => {
      const files: ResolvedFiles = { gt: 'dist/[locale]/[locale].json' };
      for (const ext of SUPPORTED_FILE_EXTENSIONS) {
        files[ext] = [
          `src/[locale]/[locale]-file.${ext}`,
          `static/file.${ext}`,
        ];
      }

      const result = resolveLocaleFiles(files, 'ja');

      for (const ext of SUPPORTED_FILE_EXTENSIONS) {
        expect(result[ext]).toEqual([
          `src/ja/ja-file.${ext}`,
          `static/file.${ext}`,
        ]);
      }
      expect(result.gt).toBe('dist/ja/ja.json');
    });

    it('spells the locale as an Android resource qualifier, and only there', () => {
      // Only Android is respelled. Every other file type keeps the locale as
      // configured, which transforms and static URLs also depend on.
      const files = {
        androidStrings: ['res/values-[locale]/strings.xml'],
        json: ['src/[locale]/messages.json'],
        dotStrings: ['[locale].lproj/Localizable.strings'],
        gt: 'dist/[locale].json',
      };

      expect(resolveLocaleFiles(files, 'fr-CA')).toMatchObject({
        androidStrings: ['res/values-fr-rCA/strings.xml'],
        json: ['src/fr-CA/messages.json'],
        dotStrings: ['fr-CA.lproj/Localizable.strings'],
        gt: 'dist/fr-CA.json',
      });
    });

    it('leaves a plain language alone for Android', () => {
      expect(
        resolveLocaleFiles(
          { androidStrings: ['res/values-[locale]/s.xml'] },
          'es'
        )
      ).toMatchObject({ androidStrings: ['res/values-es/s.xml'] });
    });

    it('keeps empty and missing entries as they are', () => {
      expect(
        resolveLocaleFiles({ json: [], yaml: undefined, gt: undefined }, 'es')
      ).toEqual({ json: [], yaml: undefined, gt: undefined });
    });
  });

  describe('resolveFiles', () => {
    beforeEach(() => {
      vi.mocked(fg.sync).mockReturnValue([]);
    });

    const defaultLocales = ['en', 'fr', 'es'];

    it.each(['json', 'twilioContentJson'] as const)(
      'resolves %s include patterns to matched and placeholder paths',
      (fileType) => {
        vi.mocked(fg.sync).mockReturnValue([
          '/project/src/en/messages.json',
          '/project/src/en/common.json',
        ]);

        const result = resolveFiles(
          { [fileType]: { include: ['src/[locale]/*.json'] } },
          'en',
          defaultLocales,
          '/project'
        );

        expect(result.resolvedPaths[fileType]).toEqual([
          '/project/src/en/messages.json',
          '/project/src/en/common.json',
        ]);
        expect(result.placeholderPaths[fileType]).toEqual([
          '/project/src/[locale]/messages.json',
          '/project/src/[locale]/common.json',
        ]);
      }
    );

    it('should handle [locale] embedded mid-segment (Apple .lproj layout)', () => {
      const files = {
        dotStrings: {
          include: ['Guardian/[locale].lproj/Localizable.strings'],
        },
      };

      vi.mocked(fg.sync).mockReturnValue([
        '/project/Guardian/en.lproj/Localizable.strings',
      ]);

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(fg.sync).toHaveBeenCalledWith(
        '/project/Guardian/en.lproj/Localizable.strings',
        { absolute: true, ignore: [] }
      );
      expect(result.resolvedPaths.dotStrings).toEqual([
        '/project/Guardian/en.lproj/Localizable.strings',
      ]);
      expect(result.placeholderPaths.dotStrings).toEqual([
        '/project/Guardian/[locale].lproj/Localizable.strings',
      ]);

      const localized = resolveLocaleFiles(result.placeholderPaths, 'es');
      expect(localized.dotStrings).toEqual([
        '/project/Guardian/es.lproj/Localizable.strings',
      ]);
    });

    it('resolves the GT output without requiring include patterns', () => {
      const result = resolveFiles(
        { gt: { output: 'dist/[locale].json' } },
        'en',
        defaultLocales,
        '/project'
      );

      expect(result.placeholderPaths.gt).toBe('/project/dist/[locale].json');
      expect(result.resolvedPaths).toEqual({});
      expect(fg.sync).not.toHaveBeenCalled();
    });

    it('keeps each file type its own matches and transform option', () => {
      const files = {
        json: {
          include: ['src/[locale]/*.json'],
          transform: 'output/[locale]/',
        },
        yaml: {
          include: ['data/[locale]/*.yaml'],
          transform: { match: 'test', replace: 'processed/[locale]/' },
        },
        md: { include: ['docs/[locale]/*.md'] },
      };

      vi.mocked(fg.sync).mockImplementation((pattern) => [
        String(pattern).replaceAll(/\*/g, 'file'),
      ]);

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.transformPaths).toEqual({
        json: 'output/[locale]/',
        yaml: { match: 'test', replace: 'processed/[locale]/' },
      });
      expect(result.resolvedPaths).toEqual({
        json: ['/project/src/en/file.json'],
        yaml: ['/project/data/en/file.yaml'],
        md: ['/project/docs/en/file.md'],
      });
    });

    it('should resolve file format transformation options', () => {
      const files = {
        pot: {
          include: ['locales/[locale]/*.pot'],
          transformationFormat: 'PO' as const,
        },
      };

      vi.mocked(fg.sync).mockReturnValue(['/project/locales/en/messages.pot']);

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.transformFormats.pot).toBe('PO');
      expect(result.resolvedPaths.pot).toEqual([
        '/project/locales/en/messages.pot',
      ]);
    });

    it('throws for unsupported file format transformations', () => {
      const files = {
        mdx: {
          include: ['docs/[locale]/*.mdx'],
          transformationFormat: 'MD' as const,
        },
      };

      expect(() =>
        resolveFiles(files, 'en', defaultLocales, '/project')
      ).toThrow('Unsupported file format transform: MDX -> MD');
    });

    it('passes each file type its own exclude patterns', () => {
      const files = {
        json: {
          include: ['src/[locale]/**/*.json'],
          exclude: ['src/[locale]/**/*.test.json', 'temp/[locales]/*.json'],
        },
        yaml: {
          include: ['docs/[locale]/*.yaml'],
          exclude: ['docs/[locale]/drafts/**'],
        },
      };

      resolveFiles(files, 'en', defaultLocales, '/project');

      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/**/*.json', {
        absolute: true,
        ignore: [
          '/project/src/en/**/*.test.json',
          '/project/temp/en/*.json',
          '/project/temp/fr/*.json',
          '/project/temp/es/*.json',
        ],
      });
      expect(fg.sync).toHaveBeenCalledWith('/project/docs/en/*.yaml', {
        absolute: true,
        ignore: ['/project/docs/en/drafts/**'],
      });
    });

    it('passes composite patterns through, which silences the missing [locale] warning', () => {
      const files = { json: { include: ['src/static/*.json'] } };

      resolveFiles(files, 'en', defaultLocales, '/project', [
        'src/static/*.json',
      ]);
      expect(logger.warn).not.toHaveBeenCalled();

      resolveFiles(files, 'en', defaultLocales, '/project');
      expect(logger.warn).toHaveBeenCalledOnce();
    });
  });

  describe('expandGlobPatterns', () => {
    beforeEach(() => {
      vi.mocked(fg.sync).mockReturnValue([]);
    });

    const defaultLocales = ['en', 'fr', 'es'];

    it('concatenates the matches of every include pattern', () => {
      vi.mocked(fg.sync)
        .mockReturnValueOnce(['/project/src/en/messages.json'])
        .mockReturnValueOnce(['/project/data/en/content.yaml']);

      const result = expandGlobPatterns(
        '/project',
        ['src/[locale]/*.json', 'data/[locale]/*.yaml'],
        [],
        'en',
        defaultLocales
      );

      expect(result).toEqual({
        resolvedPaths: [
          '/project/src/en/messages.json',
          '/project/data/en/content.yaml',
        ],
        placeholderPaths: [
          '/project/src/[locale]/messages.json',
          '/project/data/[locale]/content.yaml',
        ],
      });
    });

    it('returns nothing without patterns or matches', () => {
      const empty = { resolvedPaths: [], placeholderPaths: [] };

      expect(
        expandGlobPatterns('/project', [], [], 'en', defaultLocales)
      ).toEqual(empty);
      expect(fg.sync).not.toHaveBeenCalled();
      expect(
        expandGlobPatterns(
          '/project',
          ['src/[locale]/*.json'],
          [],
          'en',
          defaultLocales
        )
      ).toEqual(empty);
    });

    it.each([
      [
        'repeated in nested segments',
        'nested/[locale]/deep/[locale]/files.json',
        'zh-CN',
        '/project/nested/zh-CN/deep/zh-CN/files.json',
        '/project/nested/[locale]/deep/[locale]/files.json',
      ],
      [
        'a multi-part locale code',
        'src/[locale]/*.json',
        'zh-Hans-CN',
        '/project/src/zh-Hans-CN/messages.json',
        '/project/src/[locale]/messages.json',
      ],
      [
        'the leading segment',
        '[locale]/src/[locale]/messages.json',
        'fr',
        '/project/fr/src/fr/messages.json',
        '/project/[locale]/src/[locale]/messages.json',
      ],
      [
        'a filename after a globstar',
        'src/content/**/[locale].mdx',
        'en',
        '/project/src/content/courses/en.mdx',
        '/project/src/content/courses/[locale].mdx',
      ],
    ])(
      'restores the [locale] placeholder for %s',
      (_case, pattern, locale, match, placeholder) => {
        vi.mocked(fg.sync).mockReturnValue([match]);

        const result = expandGlobPatterns('/project', [pattern], [], locale, [
          locale,
          'en',
        ]);

        expect(result.placeholderPaths).toEqual([placeholder]);
      }
    );

    it('keeps a match that does not fit the pattern as it is', () => {
      vi.mocked(fg.sync).mockReturnValue(['/project/data/en/config.yaml']);

      const result = expandGlobPatterns(
        '/project',
        ['docs/[locale]/*.md'],
        [],
        'en',
        defaultLocales
      );

      expect(result.placeholderPaths).toEqual(['/project/data/en/config.yaml']);
    });

    it('keeps the matched path for a pattern without [locale]', () => {
      vi.mocked(fg.sync).mockReturnValue(['/project/src/static/config.json']);

      const result = expandGlobPatterns(
        '/project',
        ['src/static/config.json'],
        [],
        'en',
        defaultLocales,
        'output/[locale]/'
      );

      expect(result).toEqual({
        resolvedPaths: ['/project/src/static/config.json'],
        placeholderPaths: ['/project/src/static/config.json'],
      });
    });

    it('expands [locale] to the source locale and [locales] to every locale in exclude patterns', () => {
      expandGlobPatterns(
        '/project',
        ['src/[locale]/*.json'],
        [
          'src/[locale]/temp.json',
          'cache/[locales]/files.json',
          'static/global.json',
          'backup/[locale]/old/[locale]/**/*.json',
          'cache/[locales]/build/[locales]/*.tmp',
        ],
        'en',
        ['en', 'fr', 'de']
      );

      expect(fg.sync).toHaveBeenCalledWith('/project/src/en/*.json', {
        absolute: true,
        ignore: [
          '/project/src/en/temp.json',
          '/project/cache/en/files.json',
          '/project/cache/fr/files.json',
          '/project/cache/de/files.json',
          '/project/static/global.json',
          '/project/backup/en/old/en/**/*.json',
          '/project/cache/en/build/en/*.tmp',
          '/project/cache/fr/build/fr/*.tmp',
          '/project/cache/de/build/de/*.tmp',
        ],
      });
    });

    // xcstrings catalogs hold every locale in one shared file, so a pattern
    // without [locale] is the expected layout there.
    it.each<
      [
        string,
        boolean,
        {
          transform?: string | { match: string; replace: string };
          composite?: string[];
          fileType?: 'xcstrings';
        },
      ]
    >([
      ['nothing else places the translation', true, {}],
      ['a string transform', false, { transform: 'output/[locale]/' }],
      [
        'a transform option',
        false,
        { transform: { match: 'pattern', replace: 'output/[locale]/' } },
      ],
      ['an xcstrings catalog', false, { fileType: 'xcstrings' }],
      [
        'a listed composite pattern',
        false,
        { composite: ['src/static/*.json'] },
      ],
      [
        'an unrelated composite pattern',
        true,
        { composite: ['src/other/*.json'] },
      ],
    ])(
      'for a pattern without [locale] and %s, warns: %s',
      (_case, warns, { transform, composite, fileType }) => {
        expandGlobPatterns(
          '/project',
          ['src/static/*.json'],
          [],
          'en',
          defaultLocales,
          transform,
          composite,
          fileType
        );

        expect(vi.mocked(logger.warn).mock.calls).toEqual(
          warns
            ? [
                [
                  'Pattern "src/static/*.json" does not include [locale], so the CLI tool may incorrectly save translated files.',
                ],
              ]
            : []
        );
      }
    );
  });

  describe('requiresReview classification', () => {
    const defaultLocales = ['en', 'fr', 'es'];
    const resolved = [
      '/project/locales/en/prod/a.json',
      '/project/locales/en/prod/public/b.json',
      '/project/locales/en/dev/c.json',
    ];

    beforeEach(() => {
      vi.mocked(fg.sync).mockReturnValue(resolved);
    });

    it('defaults to no review-required paths without any config', () => {
      const files = { json: { include: ['locales/[locale]/**/*.json'] } };

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.requiresReviewPaths.size).toBe(0);
    });

    it('marks all matched files when top-level default is true', () => {
      const files = { json: { include: ['locales/[locale]/**/*.json'] } };

      const result = resolveFiles(
        files,
        'en',
        defaultLocales,
        '/project',
        undefined,
        true
      );

      expect(result.requiresReviewPaths).toEqual(new Set(resolved));
    });

    it('marks all matched files when file-type requiresReview is true', () => {
      const files = {
        json: {
          include: ['locales/[locale]/**/*.json'],
          requiresReview: true,
        },
      };

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.requiresReviewPaths).toEqual(new Set(resolved));
    });

    it('file-type false overrides a top-level true default', () => {
      const files = {
        json: {
          include: ['locales/[locale]/**/*.json'],
          requiresReview: false,
        },
      };

      const result = resolveFiles(
        files,
        'en',
        defaultLocales,
        '/project',
        undefined,
        true
      );

      expect(result.requiresReviewPaths.size).toBe(0);
    });

    it('object include marks only matching files', () => {
      const files = {
        json: {
          include: ['locales/[locale]/**/*.json'],
          requiresReview: {
            include: ['locales/[locale]/prod/**/*.json'],
          },
        },
      };

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.requiresReviewPaths).toEqual(
        new Set([
          '/project/locales/en/prod/a.json',
          '/project/locales/en/prod/public/b.json',
        ])
      );
    });

    it('exclude wins over include', () => {
      const files = {
        json: {
          include: ['locales/[locale]/**/*.json'],
          requiresReview: {
            include: ['locales/[locale]/prod/**/*.json'],
            exclude: ['locales/[locale]/prod/public/**/*.json'],
          },
        },
      };

      const result = resolveFiles(files, 'en', defaultLocales, '/project');

      expect(result.requiresReviewPaths).toEqual(
        new Set(['/project/locales/en/prod/a.json'])
      );
    });

    it('files matching neither glob inherit the top-level default', () => {
      const files = {
        json: {
          include: ['locales/[locale]/**/*.json'],
          requiresReview: {
            exclude: ['locales/[locale]/prod/public/**/*.json'],
          },
        },
      };

      const result = resolveFiles(
        files,
        'en',
        defaultLocales,
        '/project',
        undefined,
        true
      );

      expect(result.requiresReviewPaths).toEqual(
        new Set([
          '/project/locales/en/prod/a.json',
          '/project/locales/en/dev/c.json',
        ])
      );
    });

    it('exclude wins even when top-level default is true', () => {
      const files = {
        json: {
          include: ['locales/[locale]/**/*.json'],
          requiresReview: {
            include: ['locales/[locale]/**/*.json'],
            exclude: ['locales/[locale]/dev/**/*.json'],
          },
        },
      };

      const result = resolveFiles(
        files,
        'en',
        defaultLocales,
        '/project',
        undefined,
        true
      );

      expect(result.requiresReviewPaths).toEqual(
        new Set([
          '/project/locales/en/prod/a.json',
          '/project/locales/en/prod/public/b.json',
        ])
      );
    });

    it('rejects string values instead of coercing them', () => {
      const files = {
        json: {
          include: ['locales/[locale]/**/*.json'],
          requiresReview: 'false' as unknown as boolean,
        },
      };

      expect(() =>
        resolveFiles(files, 'en', defaultLocales, '/project')
      ).toThrow(/files\.json\.requiresReview must be a boolean/);
    });

    it('rejects objects with unknown keys', () => {
      const files = {
        json: {
          include: ['locales/[locale]/**/*.json'],
          requiresReview: { includes: ['typo/**'] } as unknown as boolean,
        },
      };

      expect(() =>
        resolveFiles(files, 'en', defaultLocales, '/project')
      ).toThrow(/files\.json\.requiresReview must be a boolean/);
    });
  });

  describe('resolveFiles - xcstrings catalogs', () => {
    const defaultLocales = ['en', 'fr', 'es'];

    beforeEach(() => {
      vi.mocked(fg.sync).mockReturnValue([
        '/project/App/Localizable.xcstrings',
      ]);
    });

    it('resolves a catalog that is updated in place', () => {
      const result = resolveFiles(
        { xcstrings: { include: ['App/Localizable.xcstrings'] } },
        'en',
        defaultLocales,
        '/project'
      );

      expect(result.resolvedPaths.xcstrings).toEqual([
        '/project/App/Localizable.xcstrings',
      ]);
      expect(result.placeholderPaths.xcstrings).toEqual([
        '/project/App/Localizable.xcstrings',
      ]);
      expect(result.transformPaths.xcstrings).toBeUndefined();
    });

    it('rejects a path transform, which would write each locale to a separate catalog', () => {
      expect(() =>
        resolveFiles(
          {
            xcstrings: {
              include: ['App/Localizable.xcstrings'],
              transform: 'Localized/[locale]/*.xcstrings',
            },
          },
          'en',
          defaultLocales,
          '/project'
        )
      ).toThrow(/files\.xcstrings\.transform is not supported/);
    });

    it('rejects [locale] in an include pattern, which would map each locale to a separate catalog', () => {
      expect(() =>
        resolveFiles(
          { xcstrings: { include: [{ pattern: 'App/[locale].xcstrings' }] } },
          'en',
          defaultLocales,
          '/project'
        )
      ).toThrow(
        /files\.xcstrings\.include must not contain \[locale\]: "App\/\[locale\]\.xcstrings"/
      );
    });
  });
});
