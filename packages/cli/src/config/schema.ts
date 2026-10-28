import * as v from 'valibot';
import {
  GTConfigSchema,
  GTOutputFileConfigSchema,
} from 'generaltranslation/config-schema';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import {
  FILE_EXT_TO_EXT_LABEL,
  SUPPORTED_FILE_EXTENSIONS,
} from '../formats/files/supportedFiles.js';
import { FILE_FORMAT_TO_CONFIG_FILE_TYPE } from '../formats/files/transformFormat.js';
import { SUPPORTED_FRAMEWORKS } from '../types/index.js';
import { GT_CONFIG_SCHEMA_URL } from '../utils/constants.js';

// Defaults are documentation only, as in the shared schema.

const stringArray = v.array(v.string());
const nonEmptyStringArray = v.pipe(stringArray, v.minLength(1));

export const IncludePatternSchema = v.union([
  v.string(),
  v.strictObject({ pattern: v.string(), publish: v.optional(v.boolean()) }),
]);

export const TransformOptionSchema = v.strictObject({
  match: v.optional(
    v.pipe(v.string(), v.description('Regex to match strings to replace'))
  ),
  replace: v.pipe(
    v.string(),
    v.description(
      "String or regex pattern to replace the match with. {locale} and other getLocaleProperties() keys are replaced with the target locale's value, or the default locale's value inside match."
    )
  ),
});

export const TransformOptionsSchema = v.record(
  v.string(),
  TransformOptionSchema
);

export const RequiresReviewConfigSchema = v.pipe(
  v.union([
    v.boolean(),
    v.strictObject({
      include: v.optional(
        v.pipe(
          stringArray,
          v.description('Glob patterns for files that require review approval')
        )
      ),
      exclude: v.optional(
        v.pipe(
          stringArray,
          v.description(
            'Glob patterns for files that never require review approval (wins over include)'
          )
        )
      ),
    }),
  ]),
  v.description(
    'Whether translated versions of matched files require approval before the CLI uses them. Files matching neither glob inherit the top-level requiresReview default.'
  )
);

const fileTypeExamples: Partial<
  Record<
    (typeof SUPPORTED_FILE_EXTENSIONS)[number],
    { include: string[][]; transform: string[] }
  >
> = {
  json: {
    include: [['content/[locale]/**/*.json', 'data/[locale]/*.json']],
    transform: ['*.[locale].json', '*-[locale].json'],
  },
  mdx: {
    include: [['content/docs/[locale]/**/*.mdx']],
    transform: ['*.[locale].mdx'],
  },
  md: { include: [['docs/[locale]/**/*.md']], transform: ['*.[locale].md'] },
  js: {
    include: [['scripts/[locale]/**/*.js']],
    transform: ['*.[locale].js'],
  },
  ts: {
    include: [['scripts/[locale]/**/*.ts']],
    transform: ['*.[locale].ts'],
  },
  yaml: {
    include: [['config/[locale]/**/*.yaml', 'data/[locale]/**/*.yml']],
    transform: ['*.[locale].yaml', '*-[locale].yml'],
  },
};

function createFileTypeSchema(
  fileType: (typeof SUPPORTED_FILE_EXTENSIONS)[number]
) {
  const label = FILE_EXT_TO_EXT_LABEL[fileType];
  const examples = fileTypeExamples[fileType];
  return v.pipe(
    v.strictObject({
      include: v.pipe(
        v.array(IncludePatternSchema),
        v.minLength(1),
        v.metadata({
          description: `Array of glob patterns that match the ${label} files you want to translate. Use { "pattern", "publish" } to set publishing per pattern.`,
          examples: examples?.include,
        })
      ),
      exclude: v.optional(
        v.pipe(
          stringArray,
          v.description(
            `Array of glob patterns that match the ${label} files you want to exclude from translation`
          )
        )
      ),
      transform: v.optional(
        v.pipe(
          v.union([
            v.string(),
            TransformOptionSchema,
            v.array(TransformOptionSchema),
          ]),
          v.metadata({
            description:
              'String defining a remapping of the file name. Should contain a wildcard * and [locale] placeholder. The object form rewrites file names with a regex.',
            examples: examples?.transform,
          })
        )
      ),
      transformationFormat: v.optional(
        v.pipe(
          v.string(),
          v.description(
            'File format to write translations in, when it differs from the source format'
          )
        )
      ),
      parsingFlags: v.optional(v.record(v.string(), v.unknown())),
      requiresReview: v.optional(RequiresReviewConfigSchema),
    }),
    v.description(`${label} files configuration`)
  );
}

const fileTypeSchemas = Object.fromEntries(
  SUPPORTED_FILE_EXTENSIONS.map((fileType) => [
    fileType,
    createFileTypeSchema(fileType),
  ])
) as {
  [K in (typeof SUPPORTED_FILE_EXTENSIONS)[number]]: ReturnType<
    typeof createFileTypeSchema
  >;
};

const optionalFileTypeSchemas = Object.fromEntries(
  Object.entries(fileTypeSchemas).map(([fileType, schema]) => [
    fileType,
    v.optional(schema),
  ])
) as {
  [K in keyof typeof fileTypeSchemas]: v.OptionalSchema<
    (typeof fileTypeSchemas)[K],
    undefined
  >;
};

export const FilesOptionsSchema = v.pipe(
  v.strictObject({
    gt: v.optional(GTOutputFileConfigSchema),
    ...optionalFileTypeSchemas,
    // Uppercase file format names are accepted as aliases of the file types.
    ...(Object.fromEntries(
      Object.entries(FILE_FORMAT_TO_CONFIG_FILE_TYPE).map(
        ([fileFormat, fileType]) => [
          fileFormat,
          optionalFileTypeSchemas[fileType],
        ]
      )
    ) as {
      [K in keyof typeof FILE_FORMAT_TO_CONFIG_FILE_TYPE]: (typeof optionalFileTypeSchemas)[(typeof FILE_FORMAT_TO_CONFIG_FILE_TYPE)[K]];
    }),
  }),
  v.description(
    'Configuration for different file types that you want to translate'
  )
);

export const SourceObjectOptionsSchema = v.pipe(
  v.strictObject({
    type: v.pipe(
      v.picklist(['array', 'object']),
      v.description('Type of the source object')
    ),
    include: v.pipe(
      stringArray,
      v.description(
        'Array of relative JSONPaths to include in the translated JSON'
      )
    ),
    key: v.optional(
      v.pipe(
        v.string(),
        v.description(
          'Relative JSONPath to the key to distinguish between source and target locales (required for array type)'
        )
      )
    ),
    localeProperty: v.optional(
      v.pipe(
        v.string(),
        v.metadata({
          description:
            'Specific locale property to use for the key for target locales',
          default: 'code',
        })
      )
    ),
    transform: v.optional(
      v.pipe(
        TransformOptionsSchema,
        v.description(
          'Optional config for transforming specific fields in the source item'
        )
      )
    ),
    omitProperties: v.optional(
      v.pipe(
        stringArray,
        v.description(
          'Top-level properties to remove from generated non-default-locale entries'
        )
      )
    ),
    experimentalSort: v.optional(
      v.pipe(
        v.picklist(['locales', 'localesAlphabetical']),
        v.description(
          "Optional sorting behavior for array type. When set to 'locales', items are ordered to match your locales array. When set to 'localesAlphabetical', the default locale stays first and the remaining locales are sorted alphabetically by locale code."
        )
      )
    ),
    splitEntries: v.optional(
      v.pipe(
        v.boolean(),
        v.description(
          'Extract non-default keyed entries into separate files and replace them with $ref pointers'
        )
      )
    ),
  }),
  v.description('Source object options for this JSONPath')
);

export const JsonSchemaSchema = v.pipe(
  v.strictObject({
    preset: v.optional(
      v.pipe(
        v.picklist(['mintlify', 'mintlify-hide-default', 'openapi']),
        v.description('Preset configuration to use')
      )
    ),
    structuralTransform: v.optional(
      v.array(
        v.strictObject({
          sourcePointer: v.string(),
          destinationPointer: v.string(),
        })
      )
    ),
    resolveRefs: v.optional(
      v.pipe(
        v.boolean(),
        v.description('Resolve $ref entries in this file before processing')
      )
    ),
    include: v.optional(
      v.pipe(
        stringArray,
        v.description(
          'Array of JSONPaths to include (mutually exclusive with composite)'
        )
      )
    ),
    composite: v.optional(
      v.pipe(
        v.record(v.string(), SourceObjectOptionsSchema),
        v.description(
          'Composite configuration (mutually exclusive with include)'
        )
      )
    ),
  }),
  v.description('JSON schema options for files matching this glob pattern')
);

export const YamlSchemaSchema = v.pipe(
  v.strictObject({
    preset: v.optional(
      v.pipe(
        v.picklist(['mintlify', 'openapi']),
        v.description('Preset configuration to use')
      )
    ),
    include: v.optional(
      v.pipe(
        stringArray,
        v.description('Array of YAML paths to include for translation')
      )
    ),
    transform: v.optional(
      v.pipe(
        TransformOptionsSchema,
        v.description('Optional config for transforming specific fields')
      )
    ),
  }),
  v.description('YAML schema options for files matching this glob pattern')
);

export const MintlifyOptionsSchema = v.pipe(
  v.strictObject({
    openapi: v.optional(
      v.pipe(
        v.strictObject({
          files: v.pipe(
            nonEmptyStringArray,
            v.description(
              'Ordered list of OpenAPI spec files (JSON only). Earlier entries win when resolving ambiguities.'
            )
          ),
          translateFields: v.optional(
            v.pipe(
              stringArray,
              v.description('JSONPaths to translate within OpenAPI specs.')
            )
          ),
        }),
        v.description(
          'OpenAPI localization settings for Mintlify. Framework defaults to mintlify.'
        )
      )
    ),
    inferTitleFromFilename: v.optional(
      v.pipe(
        v.boolean(),
        v.metadata({
          description:
            'Add a frontmatter title derived from the file name to MDX pages that have none.',
          default: false,
        })
      )
    ),
    localizeRedirects: v.optional(
      v.pipe(
        v.boolean(),
        v.metadata({
          description:
            'Add localized copies of English redirects for pages renamed or removed in a translate run. Uses docsUrlPattern and experimentalHideDefaultLocale to place the locale.',
          default: false,
        })
      )
    ),
  }),
  v.description('Mintlify-specific options.')
);

function optionalFlag(description: string) {
  return v.optional(
    v.pipe(v.boolean(), v.metadata({ description, default: false }))
  );
}

export const AdditionalOptionsSchema = v.pipe(
  v.strictObject({
    jsonSchema: v.optional(
      v.pipe(
        v.record(v.string(), JsonSchemaSchema),
        v.description('JSON schema configuration for specific file globs')
      )
    ),
    yamlSchema: v.optional(
      v.pipe(
        v.record(v.string(), YamlSchemaSchema),
        v.description('YAML schema configuration for specific file globs')
      )
    ),
    skipFileValidation: v.optional(
      v.pipe(
        v.strictObject({
          json: v.optional(
            v.pipe(v.boolean(), v.description('Skip JSON parseability checks.'))
          ),
          yaml: v.optional(
            v.pipe(v.boolean(), v.description('Skip YAML parseability checks.'))
          ),
          mdx: v.optional(
            v.pipe(
              v.boolean(),
              v.description('Skip MDX AST parseability checks.')
            )
          ),
        }),
        v.description(
          'Skip pre-parse validation for specific file types before sending content to the translation pipeline.'
        )
      )
    ),
    mintlify: v.optional(MintlifyOptionsSchema),
    docsUrlPattern: v.optional(
      v.pipe(
        v.union([v.string(), nonEmptyStringArray]),
        v.description(
          "Pattern for localizing static URLs in markdown files (e.g., '/docs/[locale]' or '/[locale]'). Use a list to localize several URL prefixes; each URL uses the longest pattern it matches."
        ),
        v.examples([
          '/docs/[locale]',
          '/[locale]',
          ['/docs/[locale]', '/ai/docs/[locale]'],
        ])
      )
    ),
    docsImportPattern: v.optional(
      v.pipe(
        v.string(),
        v.description(
          "Pattern for localizing static imports in markdown files (e.g., '/docs/[locale]/foo.md' or '/[locale]/foo.md')"
        ),
        v.examples(['/docs/[locale]/foo.md', '/[locale]/foo.md'])
      )
    ),
    excludeStaticUrls: v.optional(
      v.pipe(
        stringArray,
        v.description(
          'Glob patterns of URLs to leave unlocalized; [locale] matches the default locale'
        )
      )
    ),
    excludeStaticImports: v.optional(
      v.pipe(
        stringArray,
        v.description(
          'Glob patterns of import paths to leave unlocalized; [locale] matches the default locale'
        )
      )
    ),
    docsImportRewrites: v.optional(
      v.pipe(
        v.array(
          v.strictObject({
            match: v.pipe(
              v.string(),
              v.description("Prefix to match, e.g. '@site/docs'")
            ),
            replace: v.pipe(
              v.string(),
              v.description(
                'Replacement prefix, can include [locale] or [defaultLocale]'
              )
            ),
          })
        ),
        v.description(
          "Explicit rewrites for import prefixes before pattern-based localization (e.g., map '@site/docs' to '@site/i18n/[locale]/docusaurus-plugin-content-docs/current')"
        )
      )
    ),
    docsHideDefaultLocaleImport: optionalFlag(
      'If true, hide the default locale in the import path'
    ),
    copyFiles: v.optional(
      v.pipe(
        stringArray,
        v.description('Array of files to copy to the target locale'),
        v.examples([['static/images/**/*.png', 'public/assets/**/*.pdf']])
      )
    ),
    experimentalLocalizeStaticImports: optionalFlag(
      'Inserts locale in static import paths in md/mdx files'
    ),
    experimentalLocalizeStaticUrls: v.optional(
      v.pipe(
        v.union([
          v.boolean(),
          v.strictObject({
            skipUntranslatedPages: optionalFlag(
              'Keep links to source pages that have no translation on the default locale. Assumes URLs mirror source file paths and missing localized pages return a 404, as on Mintlify. Leave off for sites that serve untranslated pages at the localized URL, such as Docusaurus.'
            ),
            attributes: v.optional(
              v.pipe(
                stringArray,
                v.description(
                  'Extra JSX attribute names or glob patterns whose URLs are localized, such as "href2" or "href*". "href" is always localized. Avoid patterns that match asset attributes like "src", since shared assets would 404 with a locale prefix.'
                )
              )
            ),
          }),
        ]),
        v.metadata({
          description:
            'Inserts locale in static url paths in md/mdx files and adds anchor IDs to preserve navigation. Use the object form to enable it with extra behavior.',
          default: false,
        })
      )
    ),
    experimentalLocalizeRelativeAssets: optionalFlag(
      'Rewrites relative image asset URLs in translated md/mdx files to valid paths'
    ),
    experimentalAddHeaderAnchorIds: v.optional(
      v.pipe(
        v.picklist(['mintlify', 'default']),
        v.description(
          "Format for heading anchor IDs: 'mintlify' for Mintlify's native {#id} on every heading, 'default' for escaped inline \\{#id\\}. Can run without static URL localization."
        )
      )
    ),
    experimentalHideDefaultLocale: optionalFlag(
      'Hides the default locale in the import path'
    ),
    experimentalFlattenJsonFiles: optionalFlag(
      'Flattens JSON files into a single file'
    ),
    experimentalCanonicalLocaleKeys: optionalFlag(
      'For composite JSON schemas with locale keys, use the canonical locale even when an alias is provided'
    ),
    saveLocal: optionalFlag(
      'Detect and save local edits to translated output before enqueuing translations.'
    ),
    baseDomain: v.optional(
      v.pipe(
        v.string(),
        v.url(),
        v.description('The base http:// url where the project is hosted'),
        v.examples(['https://example.com', 'https://docs.example.com'])
      )
    ),
    experimentalClearLocaleDirs: optionalFlag(
      'If true, clear locale directories before writing translations'
    ),
    clearLocaleDirsExclude: v.optional(
      v.pipe(
        stringArray,
        v.description(
          "Array of glob patterns with [locale] or [locales] placeholder to exclude from clearing (e.g., './snippets/[locale]/preserved/**' or './[locales]/static/**')"
        ),
        v.examples([
          ['./snippets/[locale]/preserved/**', './[locales]/static/**'],
        ])
      )
    ),
  }),
  v.description('Additional configuration options')
);

export const SharedStaticAssetsConfigSchema = v.pipe(
  v.strictObject({
    include: v.pipe(
      v.union([v.string(), nonEmptyStringArray]),
      v.description(
        "Glob or array of globs (repo-root relative) that match static assets to consolidate (e.g., 'docs/**/*.{png,jpg,svg}')."
      )
    ),
    outDir: v.optional(
      v.pipe(
        v.string(),
        v.description(
          "Repo-root relative output directory where assets will be placed (on disk). Examples: 'public/shared', 'static/img', 'shared'. Required unless mirrorToLocales is true."
        )
      )
    ),
    publicPath: v.optional(
      v.pipe(
        v.string(),
        v.description(
          "Public URL prefix to use in rewritten content. If omitted, it is derived from outDir (public/* → '/…', static/* → '/…', otherwise '/basename(outDir)')."
        ),
        v.examples(['/shared', '/img', '/assets'])
      )
    ),
    mirrorToLocales: optionalFlag(
      'When true, copy matched assets to the equivalent location in each locale directory instead of centralizing them. This preserves relative paths in translated files. outDir and publicPath are ignored.'
    ),
  }),
  v.description(
    'Configuration for moving shared static assets to a single directory and rewriting references in source files, or mirroring assets to each locale directory.'
  )
);

export const FontsConfigSchema = v.pipe(
  v.strictObject({
    include: v.pipe(
      stringArray,
      v.description('Globs of .ttf and .otf font files')
    ),
    exclude: v.optional(stringArray),
  }),
  v.description('Fonts to sync to the API before translating')
);

/** The complete gt.config.json read by the gt CLI. */
export const GTConfigFileSchema = v.pipe(
  v.strictObject({
    ...GTConfigSchema.entries,
    $schema: v.optional(
      v.pipe(
        v.string(),
        v.description('JSON Schema reference for this configuration file')
      )
    ),
    apiKey: v.optional(
      v.pipe(
        v.never(),
        v.metadata({
          description: v.getDescription(GTConfigSchema.entries.apiKey.wrapped),
        })
      )
    ),
    baseUrl: v.optional(
      v.pipe(
        v.string(),
        v.url(),
        v.description('Base URL for the General Translation API')
      )
    ),
    dashboardUrl: v.optional(
      v.pipe(
        v.string(),
        v.url(),
        v.description('URL for the General Translation dashboard')
      )
    ),
    stageTranslations: optionalFlag(
      'Optional boolean flag that indicates whether your project is configured to use human review'
    ),
    requiresReview: optionalFlag(
      'When true, translated files require approval before the CLI downloads and uses them. File-type requiresReview settings and component-level $requiresReview props override this default.'
    ),
    publish: v.optional(
      v.pipe(v.boolean(), v.description('Publish translations to the CDN'))
    ),
    omitConfigIds: optionalFlag(
      'Do not write _versionId or _branchId to gt.config.json'
    ),
    src: v.optional(
      v.pipe(
        stringArray,
        v.description(
          'Optional array of relative directory paths that contain translatable content'
        ),
        v.examples([
          [
            'src/**/*.{js,jsx,ts,tsx}',
            'app/**/*.{js,jsx,ts,tsx}',
            'pages/**/*.{js,jsx,ts,tsx}',
            'components/**/*.{js,jsx,ts,tsx}',
          ],
        ])
      )
    ),
    framework: v.optional(
      v.pipe(
        v.picklist(SUPPORTED_FRAMEWORKS),
        v.description('The framework being used in the project')
      )
    ),
    version: v.optional(
      v.pipe(
        v.string(),
        v.description(
          'Custom version ID to use for translations. Should be unique'
        )
      )
    ),
    files: v.optional(FilesOptionsSchema),
    sharedStaticAssets: v.optional(SharedStaticAssetsConfigSchema),
    fonts: v.optional(FontsConfigSchema),
    options: v.optional(AdditionalOptionsSchema),
    branchOptions: v.optional(
      v.pipe(
        v.strictObject({
          enabled: v.optional(
            v.pipe(v.boolean(), v.description('Enable branching'))
          ),
          currentBranch: v.optional(
            v.pipe(v.string(), v.description('Branch to translate'))
          ),
          autoDetectBranches: v.optional(
            v.pipe(
              v.boolean(),
              v.metadata({
                description: 'Detect the current branch with git',
                default: true,
              })
            )
          ),
          remoteName: v.optional(
            v.pipe(
              v.string(),
              v.description('Git remote used to detect branches')
            )
          ),
        }),
        v.description('Branch detection settings')
      )
    ),
    parsingOptions: v.optional(
      v.pipe(
        v.strictObject({
          conditionNames: v.optional(
            v.pipe(
              stringArray,
              v.description(
                'Export conditions to check when resolving monorepo packages'
              )
            )
          ),
        }),
        v.description('Source parsing settings')
      )
    ),
  }),
  v.metadata({
    $id: GT_CONFIG_SCHEMA_URL,
    title: 'General Translation Configuration',
    description:
      'Configuration schema for gt.config.json files used by General Translation CLI',
    examples: [
      {
        defaultLocale: libraryDefaultLocale,
        locales: ['fr', 'es'],
        files: {
          gt: { output: 'public/i18n/[locale].json' },
          mdx: {
            include: ['content/docs/[locale]/**/*.mdx'],
            transform: '*.[locale].mdx',
          },
          json: {
            include: ['resources/[locale]/**/*.json'],
            exclude: ['resources/[locale]/exclude/**/*.json'],
          },
        },
        src: ['./src', './app', './pages', './components'],
        dictionary: './dictionary.json',
        stageTranslations: false,
      },
    ],
  })
);

/** Subschemas used in several places, emitted once under $defs in the JSON Schema. */
export const GTConfigFileSchemaDefinitions = {
  ...fileTypeSchemas,
  IncludePattern: IncludePatternSchema,
  TransformOption: TransformOptionSchema,
  RequiresReviewConfig: RequiresReviewConfigSchema,
};
