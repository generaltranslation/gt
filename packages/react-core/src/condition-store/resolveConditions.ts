import { libraryDefaultLocale } from 'generaltranslation/internal';
import { getReadonlyConditionStoreWithFallback } from './singleton-operations';

type RequestConditions = {
  _locale?: string;
  _enableI18n?: boolean;
};

/**
 * Resolve `_locale`/`_enableI18n` from the readonly condition store when they
 * are not supplied explicitly. Used by the RSC components, which cannot read
 * React context.
 */
export function resolveConditions({
  _locale,
  _enableI18n,
}: RequestConditions): {
  _locale: string;
  _enableI18n: boolean;
} {
  const conditionStore =
    _locale == null || _enableI18n == null
      ? getReadonlyConditionStoreWithFallback()
      : undefined;
  return {
    _locale: _locale ?? conditionStore?.getLocale() ?? libraryDefaultLocale,
    _enableI18n: _enableI18n ?? conditionStore?.getEnableI18n() ?? true,
  };
}
