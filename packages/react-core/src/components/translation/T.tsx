import { useTranslate } from '../../hooks/external-store';
import { getI18nConfig } from 'gt-i18n/internal';
import { useRef, type ReactNode } from 'react';
import { renderPreparedT } from '../../utils/rendering/renderPipeline.rsc';
import type { TProps } from '../../utils/translation/prepareT.shared';
import { usePrepareT } from '../../utils/translation/usePrepareT';
import type { GTMarker } from '../../utils/marker';

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
T._gtt = { kind: 'translate' } satisfies GTMarker;
GtInternalTranslateJsx._gtt = {
  kind: 'translate',
  automatic: true,
} satisfies GTMarker;

export { GtInternalTranslateJsx, T };

/**
 * Render logic
 */
function useComputeT({
  children: sourceChildren,
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
  });

  // Lookup translation in cache
  const targetJsxChildren = useTranslate({
    locale,
    content: sourceJsxChildren,
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

  const result = renderPreparedT({
    taggedSourceChildren,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
    hash: targetOptions.$_hash,
  });

  // record previous result
  prev.current = result;

  return result;
}
