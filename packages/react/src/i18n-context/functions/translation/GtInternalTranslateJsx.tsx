import { Suspense, use, useMemo } from 'react';
import type { ReactNode } from 'react';
import { resolveJsx, resolveJsxWithRuntimeFallback } from 'gt-i18n/internal';
import {
  writeChildrenAsObjects,
  addGTIdentifier,
  removeInjectedT,
  renderDefaultChildren,
  renderTranslatedChildren,
} from '@generaltranslation/react-core/internal';
import type { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import { renderVariable } from '../variables/utils/renderVariable';
import { requiresTranslation } from '@generaltranslation/format';
import { getDefaultLocale, getLocale } from '../locale-operations';
import type { JsxChildren } from '@generaltranslation/format/types';
import type { TaggedChildren } from '@generaltranslation/react-core/types';
import { getBrowserI18nManager } from '../../browser-i18n-manager/singleton-operations';

type TranslateJsxProps = {
  children: ReactNode;
} & JsxTranslationOptions;

/**
 * Equivalent to the `<T>` component, but used for auto insertion
 */
function GtInternalTranslateJsx(props: TranslateJsxProps): ReactNode {
  return useComputeT(props);
}

/**
 * User facing component for translation.
 */
function T(props: TranslateJsxProps): ReactNode {
  return useComputeT(props);
}

/** @internal _gtt - The GT transformation and injection identifier for the component. */
T._gtt = 'translate-client';
GtInternalTranslateJsx._gtt = 'translate-client-automatic';

export { GtInternalTranslateJsx, T };

// ----- Helper Functions ----- //

/**
 * Implementation for the T component logic
 */
function useComputeT({
  children: sourceChildren,
  ...params
}: TranslateJsxProps): ReactNode {
  // --- (0) Prepare our source children for rendering --- //
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
  const renderSourceChildren = () =>
    renderDefaultChildren({
      children: taggedSourceChildren,
      defaultLocale: getLocale(),
      renderVariable,
    });
  const options = {
    $format: 'JSX' as const,
    $context: params.context,
    $id: params.id,
    $_hash: params._hash,
    ...params,
  };

  // --- (1) Check if translation is even required --- //
  const targetLocale = getLocale();
  const defaultLocale = getDefaultLocale();
  if (!requiresTranslation(defaultLocale, targetLocale)) {
    return renderSourceChildren();
  }
  const targetOptions = { ...options, $locale: targetLocale };

  // --- (2) Try sync cache lookup (shared by both dev and prod paths) --- //
  const targetJsxChildren = resolveJsx(
    targetLocale,
    sourceJsxChildren,
    targetOptions
  );
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
          options={targetOptions}
          targetLocale={targetLocale}
        />
      </Suspense>
    );
  }

  return renderSourceChildren();
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
  options: JsxTranslationOptionsWithSugar & { $locale: string };
  targetLocale: string;
}): ReactNode {
  const translation = use(
    resolveJsxWithRuntimeFallback(targetLocale, sourceJsxChildren, options)
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
