import type { LocaleProperties } from 'generaltranslation/types';
import { gt } from '../adapter/core';

export type LocaleDisplay = {
  /** The locale code as configured, e.g. `en-US`. */
  code: string;
  /** Plain language name, e.g. `English` (never `American English`). */
  name: string;
  /** Flag emoji for the locale's region, e.g. 🇺🇸. */
  emoji: string;
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function localeDisplayFromProperties(
  code: string,
  properties: LocaleProperties
): LocaleDisplay {
  return {
    code,
    name: capitalize(properties.languageName || properties.name || code),
    emoji: properties.emoji || '',
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
    gt.getLocaleProperties(localeId)
  );
}

/** Single-string form built from precomputed properties. */
export function formatLocalePropertiesLabel(
  code: string,
  properties: LocaleProperties
): string {
  const { emoji, name } = localeDisplayFromProperties(code, properties);
  return [emoji, `${name} (${code})`].filter(Boolean).join(' ');
}

/** Single-string form, e.g. `🇺🇸 English (en-US)`. */
export function formatLocaleLabel(localeId: string): string {
  return formatLocalePropertiesLabel(
    localeId,
    gt.getLocaleProperties(localeId)
  );
}
