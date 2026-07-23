import type { CustomMapping, LocaleProperties } from 'generaltranslation/types';
import { gt } from '../adapter/core';

type CustomMappingEntry = CustomMapping[string];

export type LocaleDisplay = {
  /** The locale code as configured, e.g. `en-US`. */
  code: string;
  /** Plain language name, e.g. `English` (never `American English`). */
  name: string;
  /** Flag emoji for the locale's region, e.g. 🇺🇸. */
  emoji: string;
  /**
   * True when a string custom mapping fully defines the label: `name` is the
   * user's exact text and nothing (flag, code) should be added around it.
   */
  verbatim: boolean;
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function localeDisplayFromProperties(
  code: string,
  properties: LocaleProperties,
  mapping?: CustomMappingEntry
): LocaleDisplay {
  // A string custom mapping replaces the entire label, flag included.
  // (The object form overrides individual properties instead, so it still
  // composes with the flag/code formatting.)
  if (typeof mapping === 'string') {
    return { code, name: mapping, emoji: '', verbatim: true };
  }
  return {
    code,
    name: capitalize(properties.languageName || properties.name || code),
    emoji: properties.emoji || '',
    verbatim: false,
  };
}

/**
 * Display parts for a locale, respecting the plugin's custom locale mapping.
 * Uses the bare language name plus the locale code so regional variants read
 * as e.g. `🇺🇸 English (en-US)` instead of `American English`.
 */
export function getLocaleDisplay(localeId: string): LocaleDisplay {
  return localeDisplayFromProperties(
    localeId,
    gt.getLocaleProperties(localeId),
    gt.customMapping?.[localeId]
  );
}

/** Single-string form built from precomputed properties. */
export function formatLocalePropertiesLabel(
  code: string,
  properties: LocaleProperties,
  mapping?: CustomMappingEntry
): string {
  const { emoji, name, verbatim } = localeDisplayFromProperties(
    code,
    properties,
    mapping
  );
  if (verbatim) return name;
  return [emoji, `${name} (${code})`].filter(Boolean).join(' ');
}

/** Single-string form, e.g. `🇺🇸 English (en-US)`. */
export function formatLocaleLabel(localeId: string): string {
  return formatLocalePropertiesLabel(
    localeId,
    gt.getLocaleProperties(localeId),
    gt.customMapping?.[localeId]
  );
}
