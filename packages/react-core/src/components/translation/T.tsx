import { useMemo } from 'react';
import addGTIdentifier from '../../utils/internal/addGTIdentifier';
import { removeInjectedT } from '../../utils/internal/removeInjectedT';
import writeChildrenAsObjects from '../../utils/internal/writeChildrenAsObjects';
import renderDefaultChildren from '../../utils/rendering/renderDefaultChildren';
import renderTranslatedChildren from '../../utils/rendering/renderTranslatedChildren';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
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
      enableI18n: true,
      shouldTranslate,
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
    enableI18n: true,
    shouldTranslate,
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
    enableI18n,
    targetOptions,
    taggedSourceChildren,
    sourceJsxChildren,
    shouldTranslate,
  } = usePrepSourceRender({
    sourceChildren,
    params,
  });

  // Lookup translation in cache
  const targetJsxChildren = useTranslate({
    locale,
    message: sourceJsxChildren,
    options: targetOptions,
  });

  return renderPreparedT({
    taggedSourceChildren,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
  });
}

function renderPreparedT({
  taggedSourceChildren,
  targetJsxChildren,
  locale,
  defaultLocale,
  enableI18n,
  shouldTranslate,
}: {
  taggedSourceChildren: TaggedChildren;
  targetJsxChildren: JsxChildren | null | undefined;
  locale: string;
  defaultLocale: string;
  enableI18n: boolean;
  shouldTranslate: boolean;
}): ReactNode {
  if (!shouldTranslate || targetJsxChildren == null) {
    return renderSource({
      taggedSourceChildren,
      defaultLocale,
      enableI18n,
    });
  }

  return renderTarget({
    taggedSourceChildren,
    targetJsxChildren,
    locales: [locale, defaultLocale],
    enableI18n,
  });
}

function renderSource({
  taggedSourceChildren,
  defaultLocale,
  enableI18n,
}: {
  taggedSourceChildren: TaggedChildren;
  defaultLocale: string;
  enableI18n: boolean;
}): ReactNode {
  return renderDefaultChildren({
    children: taggedSourceChildren,
    defaultLocale,
    enableI18n,
  });
}

function renderTarget({
  taggedSourceChildren,
  targetJsxChildren,
  locales,
  enableI18n,
}: {
  taggedSourceChildren: TaggedChildren;
  targetJsxChildren: JsxChildren;
  locales: string[];
  enableI18n: boolean;
}): ReactNode {
  return renderTranslatedChildren({
    source: taggedSourceChildren,
    target: targetJsxChildren,
    locales,
    enableI18n,
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
  const { taggedSourceChildren, sourceJsxChildren, targetOptions } = useMemo(
    () =>
      prepareT({
        sourceChildren,
        params,
        locale,
      }),
    [locale, params, sourceChildren]
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

function prepareT({
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
