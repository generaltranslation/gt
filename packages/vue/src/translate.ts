import { t as baseT } from 'gt-i18n';
import {
  createLookupOptions,
  createMFunction,
  getI18nCache,
  getI18nConfig,
  getShouldTranslate,
  interpolateMessage,
} from 'gt-i18n/internal';
import type {
  GTFunctionType,
  GTTranslationOptions,
  MFunctionType,
} from 'gt-i18n/types';
import { getConditionStore } from './condition-store';
import {
  queueRuntimeTranslation,
  trackTranslations,
} from './internal/reactivity';

/**
 * The core string translation function behind `t()` and `useGT()`.
 *
 * Reads the reactive locale and the global translations tick, so calls made
 * during a component render re-render on locale changes and when dev hot
 * reload translations land.
 */
const gt: GTFunctionType = ((
  message: string,
  options: GTTranslationOptions = {}
) => {
  trackTranslations();

  const conditionStore = getConditionStore();
  const config = getI18nConfig();
  const locale = conditionStore.getLocale();
  const defaultLocale = config.getDefaultLocale();
  const shouldTranslate = getShouldTranslate({
    locale,
    enableI18n: conditionStore.getEnableI18n(),
  });

  if (!shouldTranslate) {
    return interpolateMessage({
      options,
      source: message,
      sourceLocale: defaultLocale,
    });
  }

  const lookupOptions = createLookupOptions(
    options.$locale ?? locale,
    options,
    'ICU'
  );
  const translation = getI18nCache().lookupTranslation<string>(
    lookupOptions.$locale,
    message,
    lookupOptions
  );

  // Dev hot reload: translate on the fly when the lookup misses
  if (translation == null && config.isDevHotReloadEnabled()) {
    queueRuntimeTranslation({
      locale: lookupOptions.$locale,
      message,
      options: lookupOptions,
    });
  }

  return interpolateMessage({
    source: message,
    target: translation,
    options: lookupOptions,
    sourceLocale: defaultLocale,
  });
}) as GTFunctionType;

/**
 * Synchronous string translation function.
 *
 * ```ts
 * t('Hello, world!');
 * t('Hello, {name}!', { name: 'Alice' });
 * t`Hello, ${name}!`;
 * ```
 *
 * Fully reactive when called during a component render: re-renders on locale
 * changes and dev hot reload. Module-scope calls resolve once against the
 * locale at import time and cannot retroactively update.
 */
export const t: typeof baseT = ((
  messageOrStrings: string | TemplateStringsArray,
  ...values: unknown[]
) => {
  if (typeof messageOrStrings === 'string') {
    return gt(messageOrStrings, values.at(0) as GTTranslationOptions);
  }
  // Tagged template form: delegate to gt-i18n (no dev hot reload)
  return baseT(messageOrStrings, ...values);
}) as typeof baseT;

/**
 * Returns the `gt()` string translation function.
 *
 * ```ts
 * const gt = useGT();
 * gt('Hello, {name}!', { name: 'Alice' });
 * ```
 */
export function useGT(): GTFunctionType {
  return gt;
}

const m: MFunctionType = createMFunction(gt);

/**
 * Returns the `m()` function, which resolves strings encoded with `msg()`.
 *
 * ```ts
 * const greeting = msg('Hello, world!');
 * const m = useMessages();
 * m(greeting);
 * ```
 */
export function useMessages(): MFunctionType {
  return m;
}
