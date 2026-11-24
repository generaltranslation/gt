import { ReadonlyConditionStore } from 'gt-i18n/internal';
import { setReadonlyConditionStore } from '../condition-store/singleton-operations';
import { ReactI18nCache } from '../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../i18n-cache/singleton-operations';
import { I18nStore } from '../i18n-store/I18nStore';
import { setI18nStore } from '../i18n-store/singleton-operations';
import { initializeI18nConfig } from './i18nConfig';
import type { ReactInitializeGTParams } from './initializeGTSRA';

/**
 * Sets GT up with no translations and no provider, so every component, hook
 * and function renders its source in the default locale. For the `/testing`
 * entries of the framework packages, as their `initializeGT()`: it keeps the
 * app's default locale, so that source text is formatted by its rules, and
 * ignores the rest of the config.
 */
export function initializeGTForTesting({
  defaultLocale,
}: Pick<ReactInitializeGTParams, 'defaultLocale'> = {}): void {
  // Hooks read the store below when there is no provider, as in a client-rendered app.
  initializeI18nConfig({ defaultLocale }, 'SPA');
  setReactI18nCache(new ReactI18nCache({}));
  setReadonlyConditionStore(
    new ReadonlyConditionStore({ locale: defaultLocale })
  );
  setI18nStore(new I18nStore());
}
