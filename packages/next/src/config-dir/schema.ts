import {
  type InferInput,
  type ObjectSchema,
  array,
  boolean,
  description,
  looseObject,
  optional,
  pipe,
  record,
  string,
  union,
} from 'valibot';
import { GTConfigSchema } from 'generaltranslation/config-schema';

const pathPatternsByLocale = record(string(), array(string()));

/** The gt.config.json keys only gt-next reads. */
export const gtNextConfigEntries = {
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
  getLocalePath: optional(
    pipe(string(), description('Path to a custom getLocale function'))
  ),
  getRegionPath: optional(
    pipe(string(), description('Path to a custom getRegion function'))
  ),
};

/** gt.config.json as gt-next reads it: the shared keys and gt-next's own. */
export const GTNextConfigSchema = looseObject({
  ...GTConfigSchema.entries,
  ...gtNextConfigEntries,
});

/** Options only gt-next reads, from gt.config.json or withGTConfig(). */
export type GTNextOptions = InferInput<
  ObjectSchema<typeof gtNextConfigEntries, undefined>
>;
