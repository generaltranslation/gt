import { useMemo } from 'react';
import addGTIdentifier from '../../utils/internal/addGTIdentifier';
import { removeInjectedT } from '../../utils/internal/removeInjectedT';
import writeChildrenAsObjects from '../../utils/internal/writeChildrenAsObjects';
import renderDefaultChildren from '../../utils/rendering/renderDefaultChildren';
import renderTranslatedChildren from '../../utils/rendering/renderTranslatedChildren';
import { renderVariable } from '../../utils/rendering/renderVariable';
import { useLocale } from '../../hooks/condition-store';
import {
  useDefaultLocale,
  useTranslate,
} from '../../hooks/external-store-hooks';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { getI18nConfig } from 'gt-i18n/internal';
import type { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import type { JsxChildren } from 'generaltranslation/types';
import type { TaggedChildren } from '../../utils/types';
import type { ReactNode } from 'react';
import { useShouldTranslate } from '../../hooks/utils';

// ===== Component ===== //

/**
 * External-store version of the `<T>` component.
 */
function T(props: TProps): ReactNode {
  const locale = useLocale();
  return useComputeT({ locale, ...props });
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-client';

/**
 * RSC-compatible version of the `<T>` component.
 */
async function ServerT({ locale, ...props }: ServerTProps): Promise<ReactNode> {
  await getReactI18nCache().loadTranslations(locale);
  return InternalT({ locale, ...props });
}

/** @internal _gtt - The GT transformation for the component. */
ServerT._gtt = 'translate-server';

export { InternalT, ServerT, T };

// ===== Render Logic ===== //

function useComputeT({
  locale,
  children: sourceChildren,
  ...params
}: {
  locale: string;
  children: ReactNode;
} & JsxTranslationOptions): ReactNode {
  // Prepare our source children for rendering
  const { defaultLocale, targetOptions, sourceJsxChildren, shouldTranslate } =
    usePrepSourceRender({
      locale,
      sourceChildren,
      params,
    });

  // Lookup translation in cache
  const targetJsxChildren = useTranslate({
    locale,
    message: sourceJsxChildren,
    options: targetOptions,
  });

  return InternalT({
    locale,
    defaultLocale,
    shouldTranslate,
    targetJsxChildren,
    children: sourceChildren,
    ...params,
  });
}

function InternalT({
  locale,
  defaultLocale,
  shouldTranslate,
  targetJsxChildren,
  children: sourceChildren,
  ...params
}: InternalTProps): ReactNode {
  const resolvedDefaultLocale =
    defaultLocale ?? getI18nConfig().getDefaultLocale();
  const resolvedShouldTranslate =
    shouldTranslate ??
    (getReactI18nCache().isTranslationEnabled() &&
      getI18nConfig().requiresTranslation(locale));
  const { targetOptions, taggedSourceChildren, sourceJsxChildren } =
    prepSourceRender({
      locale,
      sourceChildren,
      params,
    });

  // Create a function to render source children
  const renderSourceChildren = () => {
    return renderDefaultChildren({
      children: taggedSourceChildren,
      defaultLocale: resolvedDefaultLocale,
      renderVariable,
    });
  };

  // Render source children
  if (!resolvedShouldTranslate) {
    return renderSourceChildren();
  }

  const target =
    targetJsxChildren ??
    getReactI18nCache().lookupTranslation(
      locale,
      sourceJsxChildren,
      targetOptions
    );

  if (target == null) {
    return renderSourceChildren();
  }

  // Render translated children if found in cache
  return renderTranslatedChildren({
    source: taggedSourceChildren,
    target,
    locales: [locale, resolvedDefaultLocale],
    renderVariable,
  });
}

// ===== Source Preparation ===== //

function usePrepSourceRender({
  locale,
  sourceChildren,
  params,
}: {
  locale: string;
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
}): {
  defaultLocale: string;
  sourceJsxChildren: JsxChildren;
  targetOptions: JsxTranslationOptionsWithSugar & {
    $format: 'JSX';
    $locale: string;
    $maxChars?: number;
  };
  shouldTranslate: boolean;
} {
  const defaultLocale = useDefaultLocale();
  const shouldTranslate = useShouldTranslate();
  const { sourceJsxChildren, targetOptions } = useMemo(
    () =>
      prepSourceRender({
        locale,
        sourceChildren,
        params,
      }),
    [locale, sourceChildren, params]
  );

  return {
    defaultLocale,
    sourceJsxChildren,
    targetOptions,
    shouldTranslate,
  };
}

function prepSourceRender({
  locale,
  sourceChildren,
  params,
}: {
  locale: string;
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
}): {
  taggedSourceChildren: TaggedChildren;
  sourceJsxChildren: JsxChildren;
  targetOptions: JsxTranslationOptionsWithSugar & {
    $format: 'JSX';
    $locale: string;
    $maxChars?: number;
  };
} {
  const taggedSourceChildren = addGTIdentifier(removeInjectedT(sourceChildren));
  const sourceJsxChildren = writeChildrenAsObjects(taggedSourceChildren);
  const targetOptions = {
    ...normalizeParameters(params),
    $locale: locale,
  };

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
    maxChars?: number;
  } & JsxTranslationOptions
): JsxTranslationOptionsWithSugar & {
  $format: 'JSX';
  $maxChars?: number;
} {
  return {
    ...parameters,
    $format: 'JSX',
    $context: parameters.$context ?? parameters.context,
    $id: parameters.$id ?? parameters.id,
    $_hash: parameters.$_hash ?? parameters._hash,
    $maxChars: parameters.$maxChars ?? parameters.maxChars,
  };
}

// ===== Types ===== //

type StripDollarPrefix<T> = {
  [K in keyof T as K extends `$${infer Rest}` ? Rest : K]: T[K];
};

type JsxTranslationOptions = StripDollarPrefix<JsxTranslationOptionsWithSugar> &
  JsxTranslationOptionsWithSugar & {
    maxChars?: number;
    $maxChars?: number;
  };

export type TProps = {
  children: ReactNode;
} & JsxTranslationOptions;

type InternalTProps = TProps & {
  locale: string;
  defaultLocale?: string;
  shouldTranslate?: boolean;
  targetJsxChildren?: JsxChildren;
};

export type ServerTProps = TProps & {
  locale: string;
};
