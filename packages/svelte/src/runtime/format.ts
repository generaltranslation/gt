import { getI18nConfig } from 'gt-i18n/internal';
import type { GTState } from './state.svelte';

/**
 * Locales used to format variables: explicit `locales`, then the active
 * locale, then the default locale. Source content formats in the default
 * locale only.
 */
export function getFormatLocales(
  state: GTState,
  localesProp: string[] = []
): string[] {
  const config = getI18nConfig();
  const defaultLocale = config.getDefaultLocale();
  return config.requiresTranslation(state.locale)
    ? [...localesProp, state.locale, defaultLocale]
    : [defaultLocale];
}

/** The locale-agnostic GT instance used for formatting. */
export function getFormatter() {
  return getI18nConfig().getGTClass();
}
