import type { JsxChildren } from 'generaltranslation/types';
import type { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import type { ReactNode } from 'react';
import addGTIdentifier from '../../utils/internal/addGTIdentifier';
import { removeInjectedT } from '../../utils/internal/removeInjectedT';
import writeChildrenAsObjects from '../../utils/internal/writeChildrenAsObjects';
import renderDefaultChildren from '../../utils/rendering/renderDefaultChildren';
import renderTranslatedChildren from '../../utils/rendering/renderTranslatedChildren';
import { renderVariable } from '../../utils/rendering/renderVariable';
import type { RenderVariable, TaggedChildren } from '../../utils/types';

type StripDollarPrefix<T> = {
  [K in keyof T as K extends `$${infer Rest}` ? Rest : K]: T[K];
};

type JsxTranslationOptions = StripDollarPrefix<JsxTranslationOptionsWithSugar> &
  JsxTranslationOptionsWithSugar & {
    $maxChars?: number;
    maxChars?: number;
  };

type TProps = {
  children: ReactNode;
} & JsxTranslationOptions;

type TargetOptions = JsxTranslationOptionsWithSugar & {
  $format: 'JSX';
  $locale: string;
};

type PreparedTSource = {
  defaultLocale: string;
  locale: string;
  taggedSourceChildren: TaggedChildren;
  sourceJsxChildren: JsxChildren;
  targetOptions: TargetOptions;
  shouldTranslate: boolean;
};

function prepareTSource({
  defaultLocale,
  locale,
  params,
  shouldTranslate,
  sourceChildren,
}: {
  defaultLocale: string;
  locale: string;
  params: JsxTranslationOptions;
  shouldTranslate: boolean;
  sourceChildren: ReactNode;
}): PreparedTSource {
  const taggedSourceChildren = addGTIdentifier(removeInjectedT(sourceChildren));
  const sourceJsxChildren = writeChildrenAsObjects(taggedSourceChildren);
  const options = normalizeParameters(params);
  const targetOptions = { ...options, $locale: locale };

  return {
    defaultLocale,
    locale,
    taggedSourceChildren,
    sourceJsxChildren,
    targetOptions,
    shouldTranslate,
  };
}

function renderTResult({
  prepared,
  renderVariable: renderVariableFn = renderVariable,
  targetJsxChildren,
}: {
  prepared: PreparedTSource;
  renderVariable?: RenderVariable;
  targetJsxChildren: JsxChildren | undefined;
}): ReactNode {
  const { defaultLocale, locale, shouldTranslate, taggedSourceChildren } =
    prepared;

  if (!shouldTranslate || targetJsxChildren == null) {
    return renderDefaultChildren({
      children: taggedSourceChildren,
      defaultLocale,
      renderVariable: renderVariableFn,
    });
  }

  return renderTranslatedChildren({
    source: taggedSourceChildren,
    target: targetJsxChildren,
    locales: [locale, defaultLocale],
    renderVariable: renderVariableFn,
  });
}

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
  const maxChars = parameters.$maxChars ?? parameters.maxChars;
  return {
    ...parameters,
    $format: 'JSX',
    $context: parameters.$context ?? parameters.context,
    $id: parameters.$id ?? parameters.id,
    $_hash: parameters.$_hash ?? parameters._hash,
    ...(maxChars != null && { $maxChars: Math.abs(maxChars) }),
  };
}

export { prepareTSource, renderTResult };
export type { JsxTranslationOptions, PreparedTSource, TProps };
