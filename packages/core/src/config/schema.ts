import {
  type BaseIssue,
  array,
  boolean,
  description,
  examples,
  getDotPath,
  looseObject,
  metadata,
  minLength,
  nullable,
  number,
  optional,
  picklist,
  pipe,
  record,
  regex,
  strictObject,
  strictTuple,
  string,
  union,
} from 'valibot';
import {
  defaultLocaleMatcher,
  localeMatchers,
} from '@generaltranslation/format/internal';
import { libraryDefaultLocale } from '../settings/settings';
import { supportedModelProviders } from '../translate/modelProvider';
import {
  type DiagnosticMessageInput,
  formatDiagnosticErrorDetails,
} from '../logging/diagnostics';

// Defaults are documentation only: a parse-time default would make every
// consumer see the key as set and break precedence between config sources.

const stringArray = array(string());

const enabledParts = union([
  boolean(),
  strictObject({
    jsx: optional(boolean()),
    strings: optional(boolean()),
  }),
]);

/** `files.gt.parsingFlags`: options shared by the CLI, compiler, and runtimes. */
export const GTParsingFlagsSchema = pipe(
  looseObject({
    autoderive: optional(
      pipe(
        enabledParts,
        description(
          'Treat interpolated and concatenated values as derive() calls. true or false applies to JSX and strings; the object form enables each separately.'
        )
      )
    ),
    includeSourceCodeContext: optional(
      pipe(
        boolean(),
        description(
          'Include surrounding source code lines as context for translations'
        )
      )
    ),
    enableAutoJsxInjection: optional(
      pipe(boolean(), description('Automatically wrap translatable JSX'))
    ),
    devHotReload: optional(
      pipe(
        enabledParts,
        description(
          'Translate new content at runtime during development. true or false applies to JSX and strings; the object form enables each separately.'
        )
      )
    ),
    viteConfigPath: optional(
      pipe(
        string(),
        regex(/\S/),
        description('Vite config path relative to the project root')
      )
    ),
    vueCompilerOptions: optional(
      pipe(
        strictObject({
          whitespace: optional(picklist(['condense', 'preserve'])),
          delimiters: optional(
            strictTuple([
              pipe(string(), minLength(1)),
              pipe(string(), minLength(1)),
            ])
          ),
        }),
        description('Hash-affecting Vue template compiler options')
      )
    ),
  }),
  description('Options controlling inline source extraction')
);

/** `files.gt`: generated GT translation files. */
export const GTOutputFileConfigSchema = pipe(
  strictObject({
    output: optional(
      pipe(
        string(),
        description(
          'Output path pattern with [locale] placeholder for saving translations locally'
        ),
        examples(['public/i18n/[locale].json', 'translations/[locale].json'])
      )
    ),
    publish: optional(
      pipe(boolean(), description('Publish GT translation files to the CDN'))
    ),
    parsingFlags: optional(GTParsingFlagsSchema),
  }),
  description('General Translation files configuration')
);

/** `files`: runtimes read only `files.gt`; the CLI owns the other file types. */
export const GTFilesConfigSchema = pipe(
  looseObject({ gt: optional(GTOutputFileConfigSchema) }),
  description(
    'Configuration for different file types that you want to translate'
  )
);

const pathPatternsByLocale = record(string(), stringArray);

/**
 * Every gt.config.json key read outside the gt CLI. Unknown keys pass so each
 * reader accepts the whole file; the CLI's schema extends these entries.
 */
export const GTConfigSchema = looseObject({
  defaultLocale: optional(
    pipe(
      string(),
      metadata({
        description:
          'The default locale for your project. This is the locale that your source content is written in and serves as the fallback locale.',
        default: libraryDefaultLocale,
        examples: [libraryDefaultLocale, 'en-US', 'fr', 'es'],
      })
    )
  ),
  locales: optional(
    pipe(
      stringArray,
      description(
        'An array of locales for your project. These are the locales that you want to translate your project into.'
      ),
      examples([
        ['fr', 'es', 'de'],
        ['en-US', 'fr-FR', 'es-ES'],
      ])
    )
  ),
  customMapping: optional(
    pipe(
      record(string(), union([string(), record(string(), string())])),
      description(
        'Custom locale properties by locale code. A string overrides the display name; an object overrides properties, and its code makes the locale an alias, such as { "cn": { "code": "zh" } }'
      )
    )
  ),
  localeMatcher: optional(
    pipe(
      picklist(localeMatchers),
      metadata({
        description:
          'How requested locales are matched to your locales. "best fit" runs RFC 4647 Lookup within each requested language, then accepts a locale of the same language and script. "lookup" is strict RFC 4647 Lookup.',
        default: defaultLocaleMatcher,
      })
    )
  ),
  enableI18n: optional(
    pipe(
      boolean(),
      description('Set to false to render only the default locale')
    )
  ),
  localeRouting: optional(
    pipe(
      boolean(),
      description(
        'Enable framework-provided locale path routing when supported'
      )
    )
  ),
  prefixDefaultLocale: optional(
    pipe(
      boolean(),
      description(
        'Prefix the default locale to the pathname, i.e. /about -> /en/about'
      )
    )
  ),
  enableSmartRouting: optional(
    pipe(
      boolean(),
      description(
        "Keep automatic locale negotiation. Disable to treat returning visitors' unprefixed URLs as default-locale routes."
      )
    )
  ),
  ignoreSourceMaps: optional(
    pipe(boolean(), description('Skip Next.js source map requests'))
  ),
  pathConfig: optional(
    pipe(
      record(string(), union([string(), record(string(), string())])),
      description('Localized path aliases')
    )
  ),
  routeOverrides: optional(
    pipe(
      pathPatternsByLocale,
      description(
        'Locale-relative paths to rewrite from /{locale}/{path} to /{locale}/{locale}/{path}'
      )
    )
  ),
  localeRoutes: optional(
    pipe(
      pathPatternsByLocale,
      description(
        'Shared paths available per locale; other paths fall back to the default locale'
      )
    )
  ),
  pathRegex: optional(
    pipe(
      string(),
      description(
        'Regular expression source that limits i18n middleware routing by pathname, written for paths without the locale prefix. <Link>, useLocalizeHref() and getLocalizeHref() leave non-matching paths unprefixed.'
      )
    )
  ),
  ignoreBrowserLocales: optional(
    pipe(boolean(), description("Ignore the browser's preferred locales"))
  ),
  disableInvalidLocaleWarning: optional(
    pipe(
      boolean(),
      description('Disable warnings about invalid request locales')
    )
  ),

  projectId: optional(
    pipe(
      string(),
      description('The project ID for your General Translation project')
    )
  ),
  apiKey: optional(
    pipe(
      string(),
      description(
        'Use the GT_API_KEY environment variable instead of storing an API key in this file'
      )
    )
  ),
  _versionId: optional(
    pipe(
      string(),
      description('Internal version identifier for the configuration')
    )
  ),
  _branchId: optional(
    pipe(
      string(),
      description('Internal branch identifier for the configuration')
    )
  ),

  runtimeUrl: optional(
    pipe(
      nullable(string()),
      description(
        'Runtime URL for the General Translation service. Set to null or an empty string to disable runtime translation.'
      )
    )
  ),
  cacheUrl: optional(
    pipe(
      nullable(string()),
      description('URL for cached translations. Set to null to disable.')
    )
  ),
  cacheExpiryTime: optional(
    pipe(
      number(),
      description('How long translations are cached, in milliseconds')
    )
  ),
  modelProvider: optional(
    pipe(
      picklist(supportedModelProviders),
      description('AI model provider to use for translations')
    )
  ),
  maxConcurrentRequests: optional(
    pipe(
      number(),
      description('Maximum number of concurrent translation requests')
    )
  ),
  maxBatchSize: optional(
    pipe(
      number(),
      description('Maximum translation requests in the same batch')
    )
  ),
  batchInterval: optional(
    pipe(
      number(),
      description(
        'Interval between batched translation requests, in milliseconds'
      )
    )
  ),
  renderSettings: optional(
    pipe(
      strictObject({
        method: picklist(['skeleton', 'replace', 'default']),
        timeout: optional(number()),
      }),
      description('How content renders while a translation loads')
    )
  ),
  _disableDevHotReload: optional(
    pipe(
      boolean(),
      description('Disable development hot reload of translations')
    )
  ),
  _tagIds: optional(
    pipe(
      boolean(),
      description(
        "Opt-in id-tagging, off by default. When true, each <T>'s translation hash is exposed on the DOM as a data-_gt-hash attribute so tooling (localized replay, in-context QA) can map a rendered node back to its published translation. No effect on gt() string translations; DOM-only (skipped on React Native). This injects markup: a <T> that renders bare text or a fragment has no element to hold the attribute, so its output is wrapped in a layout-neutral display:contents <span>. It is never enabled implicitly."
      )
    )
  ),

  dictionary: optional(
    pipe(
      string(),
      description(
        'Optional string that specifies the relative path to the dictionary file'
      ),
      examples(['./dictionary.json', './src/dictionary.ts'])
    )
  ),
  loadTranslationsPath: optional(
    pipe(string(), description('Path to a custom loadTranslations file'))
  ),
  loadDictionaryPath: optional(
    pipe(string(), description('Path to a custom loadDictionary file'))
  ),
  getLocalePath: optional(
    pipe(string(), description('Path to a custom getLocale function'))
  ),
  getRegionPath: optional(
    pipe(string(), description('Path to a custom getRegion function'))
  ),
  description: optional(
    pipe(string(), description('Description of the project or configuration'))
  ),
  files: optional(GTFilesConfigSchema),
});

// Issue values for these keys are secrets and never appear in messages.
const secretConfigKeys = new Set(['apiKey', 'devApiKey']);

type ConfigDiagnosticFields = Pick<
  DiagnosticMessageInput,
  'whatHappened' | 'fix' | 'details'
>;

/** Diagnostic fields describing config validation issues. */
export function describeConfigIssues(
  issues: readonly BaseIssue<unknown>[],
  configName: string
): ConfigDiagnosticFields {
  return {
    whatHappened: `${configName} is invalid`,
    fix: 'Correct the listed keys',
    details: issues.flatMap((issue) => describeIssue(issue, getDotPath(issue))),
  };
}

function describeIssue(
  issue: BaseIssue<unknown>,
  path: string | null
): string[] {
  // A union reports its options' issues; those inside an option name the key.
  const nestedIssues = issue.issues?.filter((nested) => nested.path);
  if (nestedIssues?.length) {
    return nestedIssues.flatMap((nested) =>
      describeIssue(
        nested,
        [path, getDotPath(nested)].filter(Boolean).join('.')
      )
    );
  }
  const revealsSecret =
    issue.message.includes(issue.received) &&
    path?.split('.').some((key) => secretConfigKeys.has(key));
  return [
    `${path ?? '(root)'}: ${revealsSecret ? `expected ${issue.expected}` : issue.message}`,
  ];
}

/** Diagnostic fields for a config file that is not valid JSON. */
export function describeConfigParseError(
  error: unknown,
  configName: string
): ConfigDiagnosticFields {
  return {
    whatHappened: `${configName} could not be read as JSON`,
    fix: 'Fix the file so it contains a valid JSON object',
    // V8 quotes part of the input after the reason, which can hold secrets.
    details:
      error instanceof SyntaxError
        ? error.message.replace(/,?\s*(\.\.\.)?"[\s\S]*$/, '')
        : formatDiagnosticErrorDetails(error),
  };
}
