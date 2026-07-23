import { getLocaleProperties } from 'generaltranslation';
import type { CustomMapping } from 'generaltranslation/types';
import type { PluginOptions } from 'sanity';
import { internationalizedArray } from 'sanity-plugin-internationalized-array';
import type { PluginConfig as InternationalizedArrayPluginConfig } from 'sanity-plugin-internationalized-array';

/**
 * A localizable field type, passed through to
 * `sanity-plugin-internationalized-array`. Built-in shortcuts:
 * - `'string'` / `'text'` (or any Sanity type name) wrap that type.
 * - `'block'` wraps a Portable Text array (`array` of `block`).
 * - An object form supplies a field definition verbatim; the generated type is
 *   named `internationalizedArray<Name>`.
 */
export type FieldLevelFieldType =
  | string
  | {
      /** Suffix used in the generated type name, e.g. `seo` → `internationalizedArraySeo`. */
      name: string;
      /** Sanity type of the wrapped field (e.g. an object type name). */
      type: string;
      title?: string;
      of?: unknown[];
      fields?: unknown[];
      options?: Record<string, unknown>;
    };

/**
 * Field-level localization options. `gtPlugin` forwards these to
 * `sanity-plugin-internationalized-array` — the reference Sanity plugin, which
 * gt-sanity configures rather than reimplements — keeping `sourceLocale` /
 * `locales` from `gtPlugin()` as the only source of locale identity.
 */
export type GTFieldLevelLocalizationConfig = {
  /** Register `internationalizedArray*` schema types + Studio UI. Default `false`. */
  enabled?: boolean;
  /** Which field types to wrap. Default `['string', 'text']`. */
  fieldTypes?: FieldLevelFieldType[];
  /** Per-locale display labels shown in the Studio input. */
  languageTitles?: Record<string, string>;
  /** Compute a display label for a locale (overrides `languageTitles`). */
  getLanguageTitle?: (locale: string) => string;
  /**
   * Locales pre-populated on empty localized fields.
   * Default: the plugin's source locale.
   */
  defaultLanguages?: string[];
  /** Passed through to `sanity-plugin-internationalized-array`. */
  apiVersion?: InternationalizedArrayPluginConfig['apiVersion'];
  /** Passed through to `sanity-plugin-internationalized-array`. */
  buttonLocations?: InternationalizedArrayPluginConfig['buttonLocations'];
  /** Passed through to `sanity-plugin-internationalized-array`. */
  buttonAddAll?: InternationalizedArrayPluginConfig['buttonAddAll'];
  /** Passed through to `sanity-plugin-internationalized-array`. */
  languageDisplay?: InternationalizedArrayPluginConfig['languageDisplay'];
};

export type ResolvedFieldLevelConfig = Required<
  Pick<GTFieldLevelLocalizationConfig, 'enabled' | 'fieldTypes'>
> &
  GTFieldLevelLocalizationConfig;

export function resolveFieldLevelConfig(
  config: GTFieldLevelLocalizationConfig | undefined
): ResolvedFieldLevelConfig {
  return {
    enabled: false,
    fieldTypes: ['string', 'text'],
    ...config,
  };
}

/** Map a GT field-type shortcut to the native plugin's `fieldTypes` entry. */
function toNativeFieldType(
  fieldType: FieldLevelFieldType
): InternationalizedArrayPluginConfig['fieldTypes'][number] {
  if (fieldType === 'block') {
    return {
      name: 'block',
      type: 'array',
      of: [{ type: 'block' }],
    } as unknown as InternationalizedArrayPluginConfig['fieldTypes'][number];
  }
  return fieldType as InternationalizedArrayPluginConfig['fieldTypes'][number];
}

/**
 * Configure `sanity-plugin-internationalized-array` from gtPlugin locale
 * config. The native plugin owns the `internationalizedArray*` schema types
 * and the Studio UI; gt-sanity only reads and writes the stored
 * `{ _key, _type, language, value }` data during translation.
 */
export function buildInternationalizedArrayPlugin(
  config: ResolvedFieldLevelConfig,
  sourceLocale: string,
  locales: string[],
  customMapping?: CustomMapping
): PluginOptions {
  const languageTitle = (locale: string) =>
    config.getLanguageTitle?.(locale) ??
    config.languageTitles?.[locale] ??
    getLocaleProperties(locale, sourceLocale, customMapping).name ??
    locale;

  const allLocales = Array.from(new Set([sourceLocale, ...locales]));

  return internationalizedArray({
    languages: allLocales.map((id) => ({ id, title: languageTitle(id) })),
    defaultLanguages: config.defaultLanguages ?? [sourceLocale],
    fieldTypes: config.fieldTypes.map(toNativeFieldType),
    ...(config.apiVersion !== undefined && { apiVersion: config.apiVersion }),
    ...(config.buttonLocations !== undefined && {
      buttonLocations: config.buttonLocations,
    }),
    ...(config.buttonAddAll !== undefined && {
      buttonAddAll: config.buttonAddAll,
    }),
    ...(config.languageDisplay !== undefined && {
      languageDisplay: config.languageDisplay,
    }),
  });
}
