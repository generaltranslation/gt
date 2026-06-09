import { getRequestConditionValues } from './asyncConditionStore';

export async function getRequestConditions() {
  const { locale, enableI18n } = await getRequestConditionValues();
  return {
    _locale: locale,
    _enableI18n: enableI18n,
  };
}
