import { useDefaultLocale, useLocale } from '../hooks/locale-management';

function useFormatLocales(localesProp: string[] = []): string[] {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  return [...localesProp, locale, defaultLocale];
}

export { useFormatLocales };
