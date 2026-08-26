import type { ReactNode } from 'react';
import { useTranslate } from '../../hooks/external-store';
import { renderPreparedT } from '../../utils/rendering/renderPipeline';
import type { TProps } from '../../utils/translation/prepareT.shared';
import { usePrepareT } from '../../utils/translation/usePrepareT';
import { useComputeTDev } from './useComputeT.dev';

function useComputeTProd(
  result: ReactNode,
  _shouldTranslate: boolean,
  _targetFound: boolean
): ReactNode {
  return result;
}

const finalizeT =
  process.env.NODE_ENV === 'production' ? useComputeTProd : useComputeTDev;

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

function useComputeT({
  children: sourceChildren,
  _locale,
  _enableI18n,
  _renderPreparedT = renderPreparedT,
  ...params
}: TProps): ReactNode {
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
  const targetJsxChildren = useTranslate({
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

  return finalizeT(result, shouldTranslate, targetJsxChildren != null);
}
