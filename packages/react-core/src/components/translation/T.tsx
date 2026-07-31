import { useTranslate } from '../../hooks/external-store';
import { getI18nConfig } from 'gt-i18n/internal';
import { useRef, type ReactNode } from 'react';
import { renderPreparedT } from '../../utils/rendering/renderPipeline';
import { computeTagHash } from '../../utils/translation/computeTagHash';
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
  // swc-injected: skip the id-tagging span when the static parent can't hold one
  // (see TProps._noTag). Destructured out so it never reaches the hashed options.
  _noTag,
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
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled() &&
    targetJsxChildren == null &&
    prev.current != null &&
    shouldTranslate
  ) {
    return prev.current;
  }

  const result = _renderPreparedT({
    taggedSourceChildren,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
    // Hash only when id-tagging is on (computeTagHash gates it), so apps not using
    // the feature pay nothing; and never when the parent can't hold the tagging
    // span (_noTag, see TProps). PERF FOLLOW-UP: useTranslate's lookup already
    // computes this exact hash — reuse it once useTranslate exposes it, instead of
    // hashing a second time here.
    hash: _noTag ? undefined : computeTagHash(sourceJsxChildren, targetOptions),
  });

  // record previous result
  prev.current = result;

  return result;
}
