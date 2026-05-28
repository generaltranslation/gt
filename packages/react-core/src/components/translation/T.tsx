import { useCallback, useMemo } from 'react';
import addGTIdentifier from '../../utils/internal/addGTIdentifier';
import { removeInjectedT } from '../../utils/internal/removeInjectedT';
import writeChildrenAsObjects from '../../utils/internal/writeChildrenAsObjects';
import renderDefaultChildren from '../../utils/rendering/renderDefaultChildren';
import renderTranslatedChildren from '../../utils/rendering/renderTranslatedChildren';
import { useLocale } from '../../hooks/condition-store';
import { useTranslate } from '../../hooks/external-store';
import { getI18nConfig } from 'gt-i18n/internal';
import type { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import type { JsxChildren } from 'generaltranslation/types';
import type { TaggedChildren } from '../../utils/types';
import type { ReactNode } from 'react';
import { getShouldTranslate } from '../../hooks/utils';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';

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
  return <T {...props} />;
}

async function RscT({
  children: sourceChildren,
  locale,
  ...params
}: {
  children: ReactNode;
  locale: string;
} & JsxTranslationOptions): Promise<ReactNode> {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate = getI18nConfig().requiresTranslation(locale);
  const { taggedSourceChildren, sourceJsxChildren, targetOptions } =
    prepSourceRender({
      sourceChildren,
      params,
      locale,
    });

  const renderSourceChildren = () =>
    renderSource({
      taggedSourceChildren,
      defaultLocale,
    });

  if (!shouldTranslate) {
    return renderSourceChildren();
  }

  const lookupTranslation =
    await getReactI18nCache().getLookupTranslation(locale);
  const targetJsxChildren = lookupTranslation(sourceJsxChildren, targetOptions);

  if (targetJsxChildren == null) {
    return renderSourceChildren();
  }

  return renderTarget({
    taggedSourceChildren,
    targetJsxChildren,
    locales: [locale, defaultLocale],
  });
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-client';
GtInternalTranslateJsx._gtt = 'translate-client-automatic';
RscT._gtt = 'translate-server';

export { GtInternalTranslateJsx, RscT, T };

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
    shouldTranslate,
  } = usePrepSourceRender({
    sourceChildren,
    params,
  });

  // Create a function to render source children
  const renderSourceChildren = useCallback(() => {
    return renderSource({
      taggedSourceChildren,
      defaultLocale,
    });
  }, [defaultLocale, taggedSourceChildren]);

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
  return renderTarget({
    taggedSourceChildren,
    targetJsxChildren,
    locales: [locale, defaultLocale],
  });
}

function renderSource({
  taggedSourceChildren,
  defaultLocale,
}: {
  taggedSourceChildren: TaggedChildren;
  defaultLocale: string;
}): ReactNode {
  return renderDefaultChildren({
    children: taggedSourceChildren,
    defaultLocale,
  });
}

function renderTarget({
  taggedSourceChildren,
  targetJsxChildren,
  locales,
}: {
  taggedSourceChildren: TaggedChildren;
  targetJsxChildren: JsxChildren;
  locales: string[];
}): ReactNode {
  return renderTranslatedChildren({
    source: taggedSourceChildren,
    target: targetJsxChildren,
    locales,
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
  shouldTranslate: boolean;
} {
  const locale = useLocale();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate = getShouldTranslate();
  const taggedSourceChildren = useMemo(
    () => prepareTaggedSourceChildren(sourceChildren),
    [sourceChildren]
  );
  const sourceJsxChildren = useMemo(
    () => prepareSourceJsxChildren(taggedSourceChildren),
    [taggedSourceChildren]
  );
  const options = useMemo(() => normalizeParameters(params), [params]);
  const targetOptions = useMemo(
    () => prepareTargetOptions({ options, locale }),
    [locale, options]
  );

  return {
    defaultLocale,
    locale,
    taggedSourceChildren,
    sourceJsxChildren,
    targetOptions,
    shouldTranslate,
  };
}

function prepareTaggedSourceChildren(
  sourceChildren: ReactNode
): TaggedChildren {
  return addGTIdentifier(removeInjectedT(sourceChildren));
}

function prepareSourceJsxChildren(
  taggedSourceChildren: TaggedChildren
): JsxChildren {
  return writeChildrenAsObjects(taggedSourceChildren);
}

function prepareTargetOptions({
  options,
  locale,
}: {
  options: JsxTranslationOptionsWithSugar & { $format: 'JSX' };
  locale: string;
}): JsxTranslationOptionsWithSugar & {
  $format: 'JSX';
  $locale: string;
} {
  return { ...options, $locale: locale };
}

function prepSourceRender({
  sourceChildren,
  params,
  locale,
}: {
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
  locale: string;
}): {
  taggedSourceChildren: TaggedChildren;
  sourceJsxChildren: JsxChildren;
  targetOptions: JsxTranslationOptionsWithSugar & {
    $format: 'JSX';
    $locale: string;
  };
} {
  const taggedSourceChildren = prepareTaggedSourceChildren(sourceChildren);
  const sourceJsxChildren = prepareSourceJsxChildren(taggedSourceChildren);
  const options = normalizeParameters(params);
  const targetOptions = prepareTargetOptions({ options, locale });

  return {
    taggedSourceChildren,
    sourceJsxChildren,
    targetOptions,
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
