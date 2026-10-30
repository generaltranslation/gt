import { useTranslate } from '../../hooks/external-store';
import { getI18nConfig, resolveLocaleTwin } from 'gt-i18n/internal';
import type { JsxChildren } from 'generaltranslation/types';
import { useRef, type ReactNode } from 'react';
import { renderPreparedT } from '../../utils/rendering/renderPipeline';
import type { TProps } from '../../utils/translation/prepareT.shared';
import { usePrepareT } from '../../utils/translation/usePrepareT';

// ===== Component ===== //

/**
 * External-store version of the `<T>` component.
 */
function T(props: TProps): ReactNode {
  return useComputeT(props);
}

function GtInternalTranslateJsx(props: TProps): ReactNode {
  return useComputeT(props);
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-client';
GtInternalTranslateJsx._gtt = 'translate-client-automatic';

export { GtInternalTranslateJsx, T };

/**
 * Render logic
 */
function useComputeT({
  children: sourceChildren,
  _locale,
  _enableI18n,
  _renderPreparedT = renderPreparedT,
  _twin,
  ...params
}: TProps): ReactNode {
  // Prepare our source children for rendering
  const {
    defaultLocale,
    locale,
    enableI18n,
    targetOptions,
    taggedSourceChildren,
    sourceJsxChildren,
    shouldTranslate,
  } = usePrepareT({
    sourceChildren,
    params,
    _locale,
    _enableI18n,
  });

  // Without translation (i18n disabled) the page has the default locale's
  // locale twins
  const twinLocale = shouldTranslate ? locale : defaultLocale;

  // Lookup translation in cache
  const targetJsxChildren = useTranslate({
    locale: twinLocale,
    message: sourceJsxChildren,
    options: targetOptions,
  });

  // Tx hot reload: render previous translation while loading new one
  // TODO: account for success vs loading vs failed request states
  const prev = useRef<ReactNode | null>(null);
  if (
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled() &&
    targetJsxChildren == null &&
    prev.current != null &&
    shouldTranslate
  ) {
    return prev.current;
  }

  // Locale twins: the twin's JSX (source locale included) renders with the
  // stripped source children; unattributed content renders its source text
  const twin = resolveLocaleTwin<JsxChildren>(_twin, twinLocale, defaultLocale);

  const result = _renderPreparedT({
    taggedSourceChildren,
    targetJsxChildren: twin ? twin.target : targetJsxChildren,
    locale: twin ? twin.locale : locale,
    defaultLocale,
    enableI18n,
    shouldTranslate: twin ? twin.target !== undefined : shouldTranslate,
    hash: targetOptions.$_hash,
  });

  // record previous result
  prev.current = result;

  return result;
}
