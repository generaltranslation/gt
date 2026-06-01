import { getEnableI18n } from './getEnableI18n';
import { getLocale } from './getLocale';

export async function getRequestConditions() {
  const [locale, enableI18n] = await Promise.all([
    getLocale(),
    getEnableI18n(),
  ]);
  return {
    _locale: locale,
    _enableI18n: enableI18n,
  };
}
