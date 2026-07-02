import { useMemo } from 'react';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { useDefaultLocale } from '../../hooks/i18n-config';
import { getI18nConfig } from 'gt-i18n/internal';
import {
  prepareT,
  prepareTTargetOptions,
  type JsxTranslationOptions,
  type PreparedT,
} from './prepareT.shared';
import type { ReactNode } from 'react';
import type { JsxChildren } from 'generaltranslation/types';
import { useTranslationsSnapshot } from '../../i18n-store/useI18nStore';
import { lookupTranslation } from '../../i18n-store/utils/translations';

const HASHED_SOURCE_PLACEHOLDER = '' as JsxChildren;

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
  const translationsSnapshot = useTranslationsSnapshot();
  const locale = _locale ?? contextLocale;
  const enableI18n = _enableI18n ?? contextEnableI18n;
  const shouldTranslate =
    enableI18n && getI18nConfig().requiresTranslation(locale);
  const targetOptions = useMemo(
    () => prepareTTargetOptions({ params, locale }),
    [locale, params]
  );
  const sourceJsxChildren = useMemo(() => {
    if (!shouldTranslate || targetOptions.$_hash == null) {
      return undefined;
    }
    const cachedTranslation = lookupTranslation(translationsSnapshot, {
      locale,
      message: HASHED_SOURCE_PLACEHOLDER,
      options: targetOptions,
    });
    return cachedTranslation !== undefined
      ? HASHED_SOURCE_PLACEHOLDER
      : undefined;
  }, [locale, shouldTranslate, targetOptions, translationsSnapshot]);
  const prepared = useMemo(
    () =>
      prepareT({
        sourceChildren,
        params,
        locale,
        sourceJsxChildren,
      }),
    [locale, params, sourceChildren, sourceJsxChildren]
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
