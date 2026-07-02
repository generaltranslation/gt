import { addGTIdentifier } from '../internal/addGTIdentifier';
import { removeInjectedT } from '../internal/removeInjectedT';
import { writeChildrenAsObjects } from '../internal/writeChildrenAsObjects';
import type { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import type { JsxChildren } from 'generaltranslation/types';
import type { ReactNode } from 'react';
import type { RenderPreparedTParams } from '../rendering/renderPreparedT.shared';
import type { TaggedChildren } from '../types';

// Pure preparation logic shared by the hook wrapper (usePrepareT) and the RSC
// code path. This module must stay free of hook/context imports so it can be
// reached from the components-rsc entrypoint.

type StripDollarPrefix<T> = {
  [K in keyof T as K extends `$${infer Rest}` ? Rest : K]: T[K];
};

type JsxTranslationOptions = StripDollarPrefix<JsxTranslationOptionsWithSugar> &
  JsxTranslationOptionsWithSugar;

type PreparedT = {
  taggedSourceChildren: TaggedChildren;
  sourceJsxChildren: JsxChildren;
  targetOptions: JsxTranslationOptionsWithSugar & {
    $format: 'JSX';
    $locale: string;
  };
};

type RenderPreparedT = (params: RenderPreparedTParams) => ReactNode;

type TProps = {
  children: ReactNode;
  _locale?: string;
  _enableI18n?: boolean;
  _renderPreparedT?: RenderPreparedT;
} & JsxTranslationOptions;

type ResolvedTProps = TProps & {
  _locale: string;
  _enableI18n: boolean;
};

function prepareT({
  sourceChildren,
  params,
  locale,
  sourceJsxChildren,
}: {
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
  locale: string;
  sourceJsxChildren?: JsxChildren;
}): PreparedT {
  const taggedSourceChildren = prepareTaggedSourceChildren(sourceChildren);
  const preparedSourceJsxChildren =
    sourceJsxChildren ?? prepareSourceJsxChildren(taggedSourceChildren);
  const targetOptions = prepareTTargetOptions({ params, locale });

  return {
    taggedSourceChildren,
    sourceJsxChildren: preparedSourceJsxChildren,
    targetOptions,
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

function prepareTTargetOptions({
  params,
  locale,
}: {
  params: JsxTranslationOptions;
  locale: string;
}): JsxTranslationOptionsWithSugar & {
  $format: 'JSX';
  $locale: string;
} {
  return prepareTargetOptions({
    options: normalizeParameters(params),
    locale,
  });
}

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

export { prepareT, prepareTTargetOptions };
export type {
  JsxTranslationOptions,
  PreparedT,
  RenderPreparedT,
  ResolvedTProps,
  TProps,
};
