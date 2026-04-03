import { ReactNode, useCallback, useMemo } from 'react';
import { resolveJsxTranslation } from 'gt-i18n/internal';
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
  ...options
}: {
  children: ReactNode;
} & JsxTranslationOptions): ReactNode {
  // --- (0) Prepare our source children for rendering --- //
  const { taggedSourceChildren, sourceJsxChildren, renderSourceChildren } =
    usePrepSourceRender({
      sourceChildren,
    });

  // --- (1) Check if translation is even required --- //
  const targetLocale = getLocale();
  const defaultLocale = getDefaultLocale();
  const translationRequired = requiresTranslation(defaultLocale, targetLocale);
  if (!translationRequired) {
    return renderSourceChildren();
  }

  // --- (2) Convert source children to jsx children --- //
  // Resolve the translation
  const resolvedTranslation = resolveJsxTranslation(sourceJsxChildren, options);
  // Signal failure if no translation was found
  if (!resolvedTranslation) {
    return renderSourceChildren();
  }

  // --- (3) Convert the resolved jsx children back to a react node --- //
  const translatedChildren = renderTranslatedChildren({
    source: taggedSourceChildren,
    target: resolvedTranslation,
    locales: [targetLocale],
    renderVariable,
  });
  return translatedChildren;
}

/**
 * Returns the tagged source children and the default render function for the source children
 */
function usePrepSourceRender({
  sourceChildren,
}: {
  sourceChildren: ReactNode;
}): {
  taggedSourceChildren: TaggedChildren;
  sourceJsxChildren: JsxChildren;
  renderSourceChildren: () => ReactNode;
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
  return { taggedSourceChildren, sourceJsxChildren, renderSourceChildren };
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
