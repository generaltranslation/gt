import { ReactNode, Suspense, use, useCallback, useMemo } from 'react';
import { resolveJsx, resolveJsxWithRuntimeFallback } from 'gt-i18n/internal';
import {
  writeChildrenAsObjects,
  addGTIdentifier,
  removeInjectedT,
} from '@generaltranslation/react-core/internal';
import { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import {
  renderDefaultChildren,
  renderTranslatedChildren,
} from '@generaltranslation/react-core/internal';
import { renderVariable } from '../variables/utils/renderVariable';
import { requiresTranslation } from 'generaltranslation';
import { getDefaultLocale, getLocale } from '../locale-operations';
import { JsxChildren } from 'generaltranslation/types';
import { TaggedChildren } from '@generaltranslation/react-core/types';
import { getBrowserI18nManager } from '../../browser-i18n-manager/singleton-operations';

/**
 * Equivalent to the `<T>` component, but used for auto insertion
 */
function GtInternalTranslateJsx(
  props: {
    children: ReactNode;
  } & JsxTranslationOptions
): ReactNode {
  return computeT(props);
}

/**
 * User facing component for translation.
 */
function T(
  props: {
    children: ReactNode;
  } & JsxTranslationOptions
): ReactNode {
  return computeT(props);
}

/** @internal _gtt - The GT transformation and injection identifier for the component. */
T._gtt = 'translate-client';
GtInternalTranslateJsx._gtt = 'translate-client-automatic';

export { GtInternalTranslateJsx, T };

// ----- Helper Functions ----- //

/**
 * Implementation for the T component logic
 */
function computeT({
  children: sourceChildren,
  ...params
}: {
  children: ReactNode;
} & JsxTranslationOptions): ReactNode {
  // --- (0) Prepare our source children for rendering --- //
  const {
    taggedSourceChildren,
    sourceJsxChildren,
    renderSourceChildren,
    options,
  } = usePrepSourceRender({
    sourceChildren,
    params,
  });

  // --- (1) Check if translation is even required --- //
  const targetLocale = getLocale();
  const defaultLocale = getDefaultLocale();
  if (!requiresTranslation(defaultLocale, targetLocale)) {
    return renderSourceChildren();
  }

  // --- (2) Try sync cache lookup (shared by both dev and prod paths) --- //
  const targetJsxChildren = resolveJsx(sourceJsxChildren, options);
  if (targetJsxChildren) {
    return renderTranslatedChildren({
      source: taggedSourceChildren,
      target: targetJsxChildren,
      locales: [targetLocale],
      renderVariable,
    });
  }

  // --- (3) Cache miss: dev hot reload suspends, prod falls back to source --- //
  if (getBrowserI18nManager().isDevHotReloadJsx()) {
    return (
      <Suspense fallback={renderSourceChildren()}>
        <DevTranslationResolver
          sourceJsxChildren={sourceJsxChildren}
          taggedSourceChildren={taggedSourceChildren}
          options={options}
          targetLocale={targetLocale}
        />
      </Suspense>
    );
  }

  return renderSourceChildren();
}

/**
 * Returns the tagged source children and the default render function for the source children
 */
function usePrepSourceRender({
  sourceChildren,
  params,
}: {
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
}): {
  taggedSourceChildren: TaggedChildren;
  sourceJsxChildren: JsxChildren;
  renderSourceChildren: () => ReactNode;
  options: JsxTranslationOptionsWithSugar;
} {
  // Remove any injected _T components after a derive invocation
  // Add GT identifying tags for easy analysis
  const taggedSourceChildren = useMemo(
    () => addGTIdentifier(removeInjectedT(sourceChildren)),
    [sourceChildren]
  );
  const sourceJsxChildren = useMemo(
    () => writeChildrenAsObjects(taggedSourceChildren),
    [taggedSourceChildren]
  );
  const renderSourceChildren = useCallback(() => {
    return renderDefaultChildren({
      children: taggedSourceChildren,
      defaultLocale: getLocale(),
      renderVariable,
    });
  }, [taggedSourceChildren]);
  const options = useMemo(() => normalizeParameters(params), [params]);
  return {
    taggedSourceChildren,
    sourceJsxChildren,
    renderSourceChildren,
    options,
  };
}

/**
 * Normalizes the parameters into a lookup options object.
 */
function normalizeParameters(parameters: {
  context?: string;
  id?: string;
  _hash?: string;
}): JsxTranslationOptionsWithSugar {
  return {
    $format: 'JSX',
    $context: parameters.context,
    $id: parameters.id,
    $_hash: parameters._hash,
    ...parameters,
  };
}

// ----- Dev Hot Reload ----- //

/**
 * Dev-only translation resolver that uses React Suspense.
 * Sync cache check already happened in computeT() — this only handles cache misses.
 * use() suspends until the async translation resolves.
 * Promise dedup is handled by Cache.missCache() via fallbackPromises.
 */
function DevTranslationResolver({
  sourceJsxChildren,
  taggedSourceChildren,
  options,
  targetLocale,
}: {
  sourceJsxChildren: JsxChildren;
  taggedSourceChildren: TaggedChildren;
  options: JsxTranslationOptionsWithSugar;
  targetLocale: string;
}): ReactNode {
  const translation = use(
    resolveJsxWithRuntimeFallback(sourceJsxChildren, options)
  );

  return renderTranslatedChildren({
    source: taggedSourceChildren,
    target: translation,
    locales: [targetLocale],
    renderVariable,
  });
}

// ----- Types ----- //

/**
 * Strips the sugar character $ from option keys (e.g. `$context` → `context`).
 */
type StripDollarPrefix<T> = {
  [K in keyof T as K extends `$${infer Rest}` ? Rest : K]: T[K];
};

/**
 * Internal type for the JsxTranslationOptions.
 * @internal
 */
type JsxTranslationOptions = StripDollarPrefix<JsxTranslationOptionsWithSugar> &
  JsxTranslationOptionsWithSugar;
