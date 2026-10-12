// Payload's locales as languages to translate into, shared by the plugin's
// endpoints and the admin panel.
import {
  getLocaleEmoji,
  getLocaleName,
  isValidLocale,
} from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { CustomMapping } from 'generaltranslation/types';
import { labelText } from './labels';

// Where the plugin puts its settings in the admin panel's config.
export const ADMIN_CUSTOM_KEY = 'gtPayload';

export type AdminSettings = { customMapping?: CustomMapping };

type PayloadLocale = string | { code: string; label?: unknown };

export type Localization = {
  locales: PayloadLocale[];
  defaultLocale: string;
};

export type LocaleOption = {
  code: string;
  // The label set in Payload, or the language's English name.
  name: string;
  emoji: string;
  // False when GT does not recognise the code and customMapping does not map it.
  supported: boolean;
};

// The label set in Payload. Payload labels a locale given as a bare code with
// the code itself, which is no label.
function labelOf(locale: PayloadLocale): string | undefined {
  if (typeof locale === 'string') return undefined;
  const text = labelText(locale.label);
  return text === locale.code ? undefined : text;
}

// Every locale except the default one, in config order.
export function targetLocaleOptions(
  localization: Localization | false | undefined,
  customMapping?: CustomMapping
): LocaleOption[] {
  if (!localization) return [];
  return localization.locales.flatMap((locale) => {
    const code = typeof locale === 'string' ? locale : locale.code;
    if (code === localization.defaultLocale) return [];
    const supported = isValidLocale(code, customMapping);
    return [
      {
        code,
        name:
          labelOf(locale) ??
          (supported
            ? getLocaleName(code, libraryDefaultLocale, customMapping)
            : code),
        emoji: supported ? getLocaleEmoji(code, customMapping) : '',
        supported,
      },
    ];
  });
}
