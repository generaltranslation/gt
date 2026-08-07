import { addGTIdentifier } from '../internal/addGTIdentifier';
import { removeInjectedT } from '../internal/removeInjectedT';
import { writeChildrenAsObjects } from '../internal/writeChildrenAsObjects';
import type { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import type { JsxChildren } from 'generaltranslation/types';
import type { ReactNode } from 'react';
import type { RenderPreparedTParams } from '../rendering/renderPreparedT.shared';
import type { TaggedChildren } from '../types';
import { resolveTagHash } from './resolveTagHash';

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
  // The <T> id-tagging hash — resolved once here (see resolveTagHash) and also
  // cached onto targetOptions.$_hash so the downstream lookup reuses it. undefined
  // when id-tagging is off, so apps not using the feature pay nothing.
  hash: string | undefined;
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
}: {
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
  locale: string;
}): PreparedT {
  const taggedSourceChildren = prepareTaggedSourceChildren(sourceChildren);
  const sourceJsxChildren = prepareSourceJsxChildren(taggedSourceChildren);
  const options = normalizeParameters(params);
  const targetOptions = prepareTargetOptions({ options, locale });

  // Resolve the id-tagging hash once, here — shared by the RSC and hook code
  // paths — and cache it on targetOptions.$_hash BEFORE the lookup so the lookup
  // reuses it (no double hashing). undefined when id-tagging is off.
  const hash = resolveTagHash(sourceJsxChildren, targetOptions);

  return {
    taggedSourceChildren,
    sourceJsxChildren,
    targetOptions,
    hash,
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
    $maxChars: parameters.$maxChars ?? parameters.maxChars,
    $requiresReview: parameters.$requiresReview ?? parameters.requiresReview,
  };
}

export { prepareT };
export type {
  JsxTranslationOptions,
  PreparedT,
  RenderPreparedT,
  ResolvedTProps,
  TProps,
};
