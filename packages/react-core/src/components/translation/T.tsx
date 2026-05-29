import { useCallback, useMemo } from 'react';
import addGTIdentifier from '../../utils/internal/addGTIdentifier';
import { removeInjectedT } from '../../utils/internal/removeInjectedT';
import writeChildrenAsObjects from '../../utils/internal/writeChildrenAsObjects';
import renderDefaultChildren from '../../utils/rendering/renderDefaultChildren';
import renderTranslatedChildren from '../../utils/rendering/renderTranslatedChildren';
import { renderVariable } from '../../utils/rendering/renderVariable';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { useTranslate } from '../../hooks/external-store';
import { getI18nConfig } from 'gt-i18n/internal';
import type { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import type { JsxChildren } from 'generaltranslation/types';
import type { TaggedChildren } from '../../utils/types';
import type { ReactNode } from 'react';
import { getShouldTranslate } from '../../hooks/utils';

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

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-client';

export { T };

// ===== Render Logic ===== //

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
  } = usePrepSourceRender({
    sourceChildren,
    params,
  });

  // Create a function to render source children
  const renderSourceChildren = useCallback(() => {
    return renderDefaultChildren({
      children: taggedSourceChildren,
      defaultLocale,
      enableI18n,
      renderVariable,
    });
  }, [defaultLocale, enableI18n, taggedSourceChildren]);

  // Lookup translation in cache
  const targetJsxChildren = useTranslate({
    locale,
    message: sourceJsxChildren,
    options: targetOptions,
  });

  // Render source children
  if (!shouldTranslate || targetJsxChildren == null) {
    return renderSourceChildren();
  }

  // Render translated children if found in cache
  return renderTranslatedChildren({
    source: taggedSourceChildren,
    target: targetJsxChildren,
    locales: [locale, defaultLocale],
    enableI18n,
    renderVariable,
  });
}

// ===== Source Preparation ===== //

function usePrepSourceRender({
  sourceChildren,
  params,
}: {
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
}): {
  defaultLocale: string;
  locale: string;
  enableI18n: boolean;
  taggedSourceChildren: TaggedChildren;
  sourceJsxChildren: JsxChildren;
  targetOptions: JsxTranslationOptionsWithSugar & {
    $format: 'JSX';
    $locale: string;
  };
  shouldTranslate: boolean;
} {
  const locale = useLocale();
  const enableI18n = useEnableI18n();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate = getShouldTranslate();
  const taggedSourceChildren = useMemo(
    () => addGTIdentifier(removeInjectedT(sourceChildren)),
    [sourceChildren]
  );
  const sourceJsxChildren = useMemo(
    () => writeChildrenAsObjects(taggedSourceChildren),
    [taggedSourceChildren]
  );
  const options = useMemo(() => normalizeParameters(params), [params]);
  const targetOptions = useMemo(
    () => ({ ...options, $locale: locale }),
    [locale, options]
  );

  return {
    defaultLocale,
    enableI18n,
    locale,
    taggedSourceChildren,
    sourceJsxChildren,
    targetOptions,
    shouldTranslate,
  };
}

// ===== Options ===== //

function normalizeParameters(
  parameters: {
    context?: string;
    id?: string;
    _hash?: string;
  } & JsxTranslationOptions
): JsxTranslationOptionsWithSugar & { $format: 'JSX' } {
  return {
    ...parameters,
    $format: 'JSX',
    $context: parameters.$context ?? parameters.context,
    $id: parameters.$id ?? parameters.id,
    $_hash: parameters.$_hash ?? parameters._hash,
  };
}

// ===== Types ===== //

type StripDollarPrefix<T> = {
  [K in keyof T as K extends `$${infer Rest}` ? Rest : K]: T[K];
};

type JsxTranslationOptions = StripDollarPrefix<JsxTranslationOptionsWithSugar> &
  JsxTranslationOptionsWithSugar;
