import { type ReactNode } from 'react';
import { renderPreparedT } from '../../utils/rendering/renderPipeline';
import type { TProps } from '../../utils/translation/prepareT.shared';
import { usePrepareT } from '../../utils/translation/usePrepareT';
import { useLookup } from '../../hooks/lookup';

// ===== Component ===== //

/**
 * Functional version of the `<T>` component.
 */
export function T_Prod(props: TProps): ReactNode {
  return useComputeT(props);
}

export function GtInternalTranslateJsx_Prod(props: TProps): ReactNode {
  return useComputeT(props);
}

/**
 * Render logic
 */
function useComputeT({
  children: sourceChildren,
  _locale,
  _enableI18n,
  _renderPreparedT = renderPreparedT,
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

  // Lookup translation
  const targetJsxChildren = useLookup({
    locale,
    message: sourceJsxChildren,
    options: targetOptions,
  });

  const result = _renderPreparedT({
    taggedSourceChildren,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
    hash: targetOptions.$_hash,
  });

  return result;
}
