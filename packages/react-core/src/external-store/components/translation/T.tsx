import { useCallback, useMemo } from 'react';
import { requiresTranslation } from 'generaltranslation';
import addGTIdentifier from '../../../internal/addGTIdentifier';
import { removeInjectedT } from '../../../internal/removeInjectedT';
import writeChildrenAsObjects from '../../../internal/writeChildrenAsObjects';
import renderDefaultChildren from '../../../rendering/renderDefaultChildren';
import renderTranslatedChildren from '../../../rendering/renderTranslatedChildren';
import { renderVariable } from '../variables/renderVariable';
import { useLocale } from '../../hooks/condition-hooks';
import {
  useCustomMapping,
  useEnableI18n,
  useDefaultLocale,
  useLocales,
  useTranslate,
} from '../../hooks/i18n-manager-hooks';
import type { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import type { JsxChildren } from 'generaltranslation/types';
import type { TaggedChildren } from '../../../types-dir/types';
import type { ReactNode } from 'react';

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

function GtInternalTranslateJsx(
  props: {
    children: ReactNode;
  } & JsxTranslationOptions
): ReactNode {
  return T(props);
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalTranslateJsx._gtt = 'translate-client-automatic';

export { GtInternalTranslateJsx, T };

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
    targetOptions,
    taggedSourceChildren,
    sourceJsxChildren,
    translationRequired,
  } = usePrepSourceRender({
    sourceChildren,
    params,
  });

  // Create a function to render source children
  const renderSourceChildren = useCallback(() => {
    return renderDefaultChildren({
      children: taggedSourceChildren,
      defaultLocale,
      renderVariable,
    });
  }, [defaultLocale, taggedSourceChildren]);

  // Lookup translation in cache
  const targetJsxChildren = useTranslate({
    locale,
    message: sourceJsxChildren,
    options: targetOptions,
  });

  // Render source children
  if (!translationRequired || !targetJsxChildren) {
    return renderSourceChildren();
  }

  // Render translated children if found in cache
  return renderTranslatedChildren({
    source: taggedSourceChildren,
    target: targetJsxChildren,
    locales: [locale, defaultLocale],
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
  taggedSourceChildren: TaggedChildren;
  sourceJsxChildren: JsxChildren;
  targetOptions: JsxTranslationOptionsWithSugar & {
    $format: 'JSX';
    $locale: string;
  };
  translationRequired: boolean;
} {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const locales = useLocales();
  const customMapping = useCustomMapping();
  const enableI18n = useEnableI18n();
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
  const translationRequired =
    enableI18n &&
    requiresTranslation(defaultLocale, locale, [...locales], customMapping);

  return {
    defaultLocale,
    locale,
    taggedSourceChildren,
    sourceJsxChildren,
    targetOptions,
    translationRequired,
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
