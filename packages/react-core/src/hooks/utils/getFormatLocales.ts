import { getI18nConfig } from 'gt-i18n/internal';

// Pure helper shared by hook-based and RSC code paths. This module must stay
// free of hook/context imports so it can be reached from the components-rsc
// entrypoint.

export function getFormatLocales({
  locale,
  enableI18n,
}: {
  locale: string;
  enableI18n: boolean;
}): string[] {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate =
    enableI18n && getI18nConfig().requiresTranslation({ locale });
  return shouldTranslate ? [locale, defaultLocale] : [defaultLocale];
}
