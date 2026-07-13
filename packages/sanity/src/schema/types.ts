/**
 * A localizable field type. Built-in shortcuts (`string`, `text`, `block`) map
 * to generated `value` field definitions; an object form supplies a custom
 * `value` field definition verbatim.
 */
export type FieldLevelFieldType =
  | 'string'
  | 'text'
  | 'block'
  | {
      /** Suffix used in the generated type name, e.g. `seo` → `internationalizedArraySeo`. */
      name: string;
      /** Sanity type of the generated `value` field (e.g. an object type name). */
      type: string;
      title?: string;
      of?: unknown[];
      fields?: unknown[];
      options?: Record<string, unknown>;
    };

/**
 * Field-level localization options, mirroring the useful parts of
 * `sanity-plugin-internationalized-array` while keeping `sourceLocale` /
 * `locales` from `gtPlugin()` as the only source of locale identity.
 */
export type GTFieldLevelLocalizationConfig = {
  /** Generate `internationalizedArray*` schema types + input components. Default `false`. */
  enabled?: boolean;
  /** Which field types to generate. Default `['string', 'text']`. */
  fieldTypes?: FieldLevelFieldType[];
  /** Per-locale display labels shown in the Studio input. */
  languageTitles?: Record<string, string>;
  /** Compute a display label for a locale (overrides `languageTitles`). */
  getLanguageTitle?: (locale: string) => string;
  /** Prefix for generated type names. Default `'internationalizedArray'`. */
  typePrefix?: string;
  /**
   * When `typePrefix` is customized, also generate `internationalizedArray*`
   * aliases for interop with existing data. Default `true`.
   */
  includeCompatibilityTypes?: boolean;

  // Deferred past v1 (need a richer custom input first):
  // buttonLocations, buttonAddAll, languageDisplay, select.
  //
  // Item field names are fixed (not configurable) in v1: locale in `language`,
  // data in `value`, random `_key` — matching the reference plugin.
};
