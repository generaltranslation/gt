import { getEnableI18n } from './getEnableI18n';
import { getLocale } from './getLocale';
import { memoizeForRequest } from '../utils/requestMemo';

export function getRequestConditions() {
  return memoizeForRequest('conditions', async () => {
    const [locale, enableI18n] = await Promise.all([
      getLocale(),
      getEnableI18n(),
    ]);
    return {
      _locale: locale,
      _enableI18n: enableI18n,
    };
  });
}
