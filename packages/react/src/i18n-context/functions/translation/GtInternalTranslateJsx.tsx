import { ReactNode, useCallback, useMemo } from 'react';
import { resolveJsxTranslation } from 'gt-i18n/internal';
import {
  writeChildrenAsObjects,
  addGTIdentifier,
} from '@generaltranslation/react-core/internal';
import { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import {
  renderDefaultChildren,
  renderTranslatedChildren,
  renderVariable,
} from '@generaltranslation/react-core/internal';
import { requiresTranslation } from 'generaltranslation';
import { getDefaultLocale, getLocale } from '../locale-operations';
import { JsxChildren } from 'generaltranslation/src/types';
import { TaggedChildren } from '@generaltranslation/react-core/types';

/**
 * Strips the sugar character $ from option keys (e.g. `$context` → `context`).
 */
type StripDollarPrefix<T> = {
  [K in keyof T as K extends `$${infer Rest}` ? Rest : K]: T[K];
};

export type JsxTranslationOptions =
  StripDollarPrefix<JsxTranslationOptionsWithSugar> &
    JsxTranslationOptionsWithSugar;

/**
 * Equivalent to the `<T>` component, but used for auto insertion
 */
export function GtInternalTranslateJsx({
  sourceChildren,
  ...options
}: {
  sourceChildren: ReactNode;
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

// ----- Helper Functions ----- //

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
  const taggedSourceChildren = useMemo(
    () => addGTIdentifier(sourceChildren),
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
