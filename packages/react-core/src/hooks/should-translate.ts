import { getI18nConfig } from 'gt-i18n/internal';
import { getReadonlyConditionStoreWithFallback } from '../condition-store/singleton-operations';

/**
 * Returns true if (1) i18n enabled and (2) translation is required.
 */
export function getShouldTranslate(): boolean {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  const i18nConfig = getI18nConfig();

  const enableI18n = conditionStore.getEnableI18n();
  const locale = conditionStore.getLocale();
  return enableI18n && i18nConfig.requiresTranslation(locale);
}
