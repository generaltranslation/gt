import type { ComponentType } from 'react';
import type {
  ArrayOfObjectsInputProps,
  FieldProps,
  ObjectItemProps,
} from 'sanity';

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
 * Studio component overrides for generated `internationalizedArray*` types.
 *
 * Each slot defaults to GT's inline UI (per-locale labeled inputs with
 * remove buttons and add-locale buttons). Pass a component to replace a
 * slot, or `false` to detach GT's component and fall back to Sanity's
 * default rendering. Translation is unaffected either way — it operates on
 * the stored `{_key, language, value}` data, not on the components.
 */
export type FieldLevelUIComponents = {
  /** Input for the generated array types. Default: GT's inline input. */
  input?: ComponentType<ArrayOfObjectsInputProps> | false;
  /** Item for the generated `*Value` objects. Default: GT's inline item. */
  item?: ComponentType<ObjectItemProps> | false;
  /**
   * Field wrapper for the generated array types. Defaults to a wrapper that
   * resets the field level (removes nested-object indentation) — but only
   * while GT's default input is in use; with a custom or disabled `input`,
   * this defaults to Sanity's standard field rendering.
   */
  field?: ComponentType<FieldProps> | false;
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
  /**
   * Override or detach the Studio components attached to generated types.
   * Use this to keep your own UI (or Sanity's default) while GT generates
   * the schema types and handles translation.
   */
  components?: FieldLevelUIComponents;

  // Deferred past v1 (need a richer custom input first):
  // buttonLocations, buttonAddAll, languageDisplay, select.
  //
  // Item field names are fixed (not configurable) in v1: locale in `language`,
  // data in `value`, random `_key` — matching the reference plugin.
};
