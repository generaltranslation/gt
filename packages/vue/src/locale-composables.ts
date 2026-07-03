import { computed } from 'vue';
import type { ComputedRef, WritableComputedRef } from 'vue';
import { getI18nConfig } from 'gt-i18n/internal';
import type { LocaleProperties } from '@generaltranslation/format/types';
import { getConditionStore } from './condition-store';

/**
 * The user's current locale as a writable reactive ref.
 *
 * Assigning it switches the app's language in place — translations for the
 * new locale are loaded, then everything re-renders. No page reload.
 *
 * ```vue
 * <script setup>
 * const locale = useLocale();
 * const locales = useLocales();
 * </script>
 *
 * <template>
 *   <select v-model="locale">
 *     <option v-for="l in locales" :key="l" :value="l">{{ l }}</option>
 *   </select>
 * </template>
 * ```
 */
export function useLocale(): WritableComputedRef<string> {
  return computed({
    get: () => getConditionStore().getLocale(),
    set: (locale: string) => getConditionStore().setLocale(locale),
  });
}

/**
 * The list of locales the app supports.
 */
export function useLocales(): readonly string[] {
  return getI18nConfig().getLocales();
}

/**
 * The app's default (source) locale.
 */
export function useDefaultLocale(): string {
  return getI18nConfig().getDefaultLocale();
}

/**
 * Locale properties (names, direction, emoji, ...) for a locale.
 */
export function useLocaleProperties(locale: string): LocaleProperties {
  return getI18nConfig().getGTClass().getLocaleProperties(locale);
}

/**
 * Reactive text direction for a locale (defaults to the current locale).
 */
export function useLocaleDirection(
  locale?: string
): ComputedRef<'ltr' | 'rtl'> {
  return computed(() =>
    getI18nConfig()
      .getGTClass()
      .getLocaleDirection(locale ?? getConditionStore().getLocale())
  );
}
