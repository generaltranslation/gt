import { useMemo } from 'react';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { useShouldTranslate } from '../../hooks/utils';
import { useDefaultLocale } from '../../hooks/i18n-config';
import {
  prepareT,
  type JsxTranslationOptions,
  type PreparedT,
} from './prepareT.shared';
import type { ReactNode } from 'react';

function usePrepareT({
  sourceChildren,
  params,
}: {
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
}): PreparedT & {
  defaultLocale: string;
  locale: string;
  enableI18n: boolean;
  shouldTranslate: boolean;
} {
  const locale = useLocale();
  const enableI18n = useEnableI18n();
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
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
