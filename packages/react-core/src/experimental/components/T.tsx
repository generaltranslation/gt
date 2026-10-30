import { resolveLocaleTwinLookup } from 'gt-i18n/internal/experimental';
import type { ReactNode } from 'react';
import {
  GtInternalTranslateJsx as RegularGtInternalTranslateJsx,
  T as RegularT,
} from '../../components/translation/T';
import { renderPreparedT } from '../../utils/rendering/renderPipeline';
import type { RenderPreparedTParams } from '../../utils/rendering/renderPreparedT.shared';
import type {
  RenderPreparedT,
  TProps,
} from '../../utils/translation/prepareT.shared';
import { renderLocaleTwinPreparedT } from '../rendering/renderPipeline';

/**
 * `<T>` with locale twins: stripped source children render through the
 * registered twin's JSX (source locale included), content no twin carries
 * renders its source text, and everything else renders like the regular
 * `<T>`, which this wraps.
 */
function T(props: TProps): ReactNode {
  return <RegularT {...props} _renderPreparedT={createRender(props)} />;
}

/** The auto-injected `<T>` (`enableAutoJsxInjection`) with locale twins. */
function GtInternalTranslateJsx(props: TProps): ReactNode {
  return (
    <RegularGtInternalTranslateJsx
      {...props}
      _renderPreparedT={createRender(props)}
    />
  );
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = RegularT._gtt;
GtInternalTranslateJsx._gtt = RegularGtInternalTranslateJsx._gtt;

export { GtInternalTranslateJsx, T };

/**
 * Renders the prepared `<T>` from its locale twin when one carries it.
 * Without translation (i18n disabled) the page has the default locale's
 * twins. Only the compiler's own hash counts as attributed: the prepared
 * hash may have been computed at runtime.
 */
function createRender({
  _hash,
  $_hash,
  _renderPreparedT = renderPreparedT,
}: TProps): RenderPreparedT {
  const compileTimeHash = _hash ?? $_hash;
  return (params: RenderPreparedTParams) => {
    const twinLocale = params.shouldTranslate
      ? params.locale
      : params.defaultLocale;
    const twin = resolveLocaleTwinLookup(
      twinLocale,
      { $_hash: params.hash },
      compileTimeHash
    );
    if (twin.entry !== undefined) {
      return renderLocaleTwinPreparedT({
        ...params,
        targetJsxChildren:
          twin.entry as RenderPreparedTParams['targetJsxChildren'],
        // A source fallback renders in the source locale, like a miss
        locale: twin.sourceFallback ? params.defaultLocale : twinLocale,
        shouldTranslate: true,
      });
    }
    return _renderPreparedT(
      twin.rendersSource ? { ...params, shouldTranslate: false } : params
    );
  };
}
