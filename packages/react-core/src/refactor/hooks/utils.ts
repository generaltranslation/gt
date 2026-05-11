import { useDefaultLocale } from "./external-store-hooks";
import { useLocale } from "./context-hooks";

function useFormatLocales(localesProp: string[] = []): string[] {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  return [...localesProp, locale, defaultLocale];
}

export { useFormatLocales };
