import { useTranslate } from '../../hooks/external-store';
import { getI18nConfig } from 'gt-i18n/internal';
import { useRef, type ReactNode } from 'react';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { renderPreparedT } from '../../utils/rendering/renderPreparedT';
import { renderVariable } from '../../utils/rendering/renderVariable';
import {
  prepareT,
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

async function RscT({
  children: sourceChildren,
  locale,
  enableI18n,
  ...params
}: {
  children: ReactNode;
  locale: string;
  enableI18n: boolean;
} & JsxTranslationOptions): Promise<ReactNode> {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate =
    enableI18n && getI18nConfig().requiresTranslation(locale);
  const prepared = prepareT({
    sourceChildren,
    params,
    locale,
  });

  if (!shouldTranslate) {
    return renderPreparedT({
      ...prepared,
      targetJsxChildren: undefined,
      locale,
      defaultLocale,
      enableI18n,
      shouldTranslate,
      renderVariable,
    });
  }

  const lookupTranslation =
    await getReactI18nCache().getLookupTranslation(locale);
  const targetJsxChildren = lookupTranslation(
    prepared.sourceJsxChildren,
    prepared.targetOptions
  );

  return renderPreparedT({
    ...prepared,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
    renderVariable,
  });
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-client';
GtInternalTranslateJsx._gtt = 'translate-client-automatic';
RscT._gtt = 'translate-server';

export { GtInternalTranslateJsx, RscT, T };

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
