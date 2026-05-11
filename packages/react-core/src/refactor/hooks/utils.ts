import { useDefaultLocale } from './i18n-manager-hooks';
import { useLocale } from './condition-hooks';

function useFormatLocales(localesProp: string[] = []): string[] {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  return [...localesProp, locale, defaultLocale];
}

export { useFormatLocales };
