import { useTranslate } from '../../hooks/external-store';
import { getI18nConfig } from 'gt-i18n/internal';
import { useRef, type ReactNode } from 'react';
import { renderPreparedT } from '../../utils/rendering/renderPreparedT';
import { renderVariable } from '../../utils/rendering/renderVariable';
import {
  usePrepareT,
  type JsxTranslationOptions,
} from '../../utils/translation/prepareT';

// ===== Component ===== //

/**
 * External-store version of the `<T>` component.
 */
function T(
  props: {
    children: ReactNode;
  } & JsxTranslationOptions
): ReactNode {
  return useComputeT(props);
}

function GtInternalTranslateJsx(
  props: {
    children: ReactNode;
  } & JsxTranslationOptions
): ReactNode {
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
  ...params
}: {
  children: ReactNode;
} & JsxTranslationOptions): ReactNode {
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
  });

  // Lookup translation in cache
  const targetJsxChildren = useTranslate({
    locale,
    message: sourceJsxChildren,
    options: targetOptions,
  });

  // Tx hot reload: render previous translation while loading new one
  // TODO: account for success vs loading vs failed request states
  const prev = useRef<ReactNode | null>(null);
  if (
    getI18nConfig().isDevHotReloadEnabled() &&
    targetJsxChildren == null &&
    prev.current != null &&
    shouldTranslate
  ) {
    return prev.current;
  }

  const result = renderPreparedT({
    taggedSourceChildren,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
    renderVariable,
  });

  // record previous result
  prev.current = result;

  return result;
}
