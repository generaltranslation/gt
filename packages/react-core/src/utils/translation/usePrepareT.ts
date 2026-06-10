import { useMemo } from 'react';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { useDefaultLocale } from '../../hooks/i18n-config';
import { getI18nConfig } from 'gt-i18n/internal';
import {
  prepareT,
  type JsxTranslationOptions,
  type PreparedT,
} from './prepareT.shared';
import type { ReactNode } from 'react';

function usePrepareT({
  sourceChildren,
  params,
  _locale,
  _enableI18n,
}: {
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
  _locale?: string;
  _enableI18n?: boolean;
}): PreparedT & {
  defaultLocale: string;
  locale: string;
  enableI18n: boolean;
  shouldTranslate: boolean;
} {
  const contextLocale = useLocale();
  const contextEnableI18n = useEnableI18n();
  const defaultLocale = useDefaultLocale();
  const locale = _locale ?? contextLocale;
  const enableI18n = _enableI18n ?? contextEnableI18n;
  const shouldTranslate =
    enableI18n && getI18nConfig().requiresTranslation(locale);
  const prepared = useMemo(
    () =>
      prepareT({
        sourceChildren,
        params,
        locale,
      }),
    [locale, params, sourceChildren]
  );

  return {
    defaultLocale,
    enableI18n,
    locale,
    shouldTranslate,
    ...prepared,
  };
}

export { usePrepareT };
