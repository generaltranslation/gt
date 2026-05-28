import { useMemo } from 'react';
import { getI18nConfig } from 'gt-i18n/internal';
import type { ReactNode } from 'react';
import { useLocale } from '../../hooks/condition-store';
import { useTranslate } from '../../hooks/external-store';
import { getShouldTranslate } from '../../hooks/utils';
import {
  prepareTSource,
  renderTResult,
  type JsxTranslationOptions,
} from './shared';

// ===== Component ===== //

/**
 * External-store version of the `<T>` component.
 */
function T(
  props: {
    children: ReactNode;
  } & JsxTranslationOptions
): ReactNode {
  const { children: sourceChildren, ...params } = props;
  const locale = useLocale();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate = getShouldTranslate();
  const prepared = useMemo(
    () =>
      prepareTSource({
        defaultLocale,
        locale,
        params,
        shouldTranslate,
        sourceChildren,
      }),
    [defaultLocale, locale, params, shouldTranslate, sourceChildren]
  );
  const targetJsxChildren = useTranslate({
    locale,
    message: prepared.sourceJsxChildren,
    options: prepared.targetOptions,
  });

  return renderTResult({
    prepared,
    targetJsxChildren,
  });
}

function GtInternalTranslateJsx(
  props: {
    children: ReactNode;
  } & JsxTranslationOptions
): ReactNode {
  return T(props);
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-client';
GtInternalTranslateJsx._gtt = 'translate-client-automatic';

export { GtInternalTranslateJsx, T };
