import { useMemo } from 'react';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { useDefaultLocale } from '../../hooks/i18n-config';
import { getI18nConfig, resolveDerivableText } from 'gt-i18n/internal';
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
  const shouldTranslate =
    enableI18n && getI18nConfig().requiresTranslation({ locale });
  // The component passes a new params object on every render, and derive() a
  // new placeholder.
  const { id, _hash, format, maxChars, requiresReview } = params;
  const context = resolveDerivableText(params.context);
  const prepared = useMemo(
    () =>
      prepareT({
        sourceChildren,
        params: { context, id, _hash, format, maxChars, requiresReview },
        locale,
      }),
    [
      locale,
      sourceChildren,
      context,
      id,
      _hash,
      format,
      maxChars,
      requiresReview,
    ]
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
