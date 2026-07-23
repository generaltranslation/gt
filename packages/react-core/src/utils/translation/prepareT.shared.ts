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

/**
 * $-prefixed sugar props on <T>, deprecated in favor of the unprefixed
 * forms. Declared explicitly (rather than reusing the shared options type)
 * so the deprecation applies only to <T> component props — the $-prefixed
 * options of the string functions (t(), gt(), msg()) are unaffected.
 */
type TSugarProps = {
  /** @deprecated Use `context` instead. Support for `$context` will be removed in the next major version. */
  $context?: string;
  /** @deprecated Use `id` instead. Support for `$id` will be removed in the next major version. */
  $id?: string;
  /** @deprecated Use `maxChars` instead. Support for `$maxChars` will be removed in the next major version. */
  $maxChars?: number;
  /** @deprecated Use `requiresReview` instead. Support for `$requiresReview` will be removed in the next major version. */
  $requiresReview?: boolean;
  /** @internal Compiler-injected hash; not part of the public API. */
  $_hash?: string;
  /** @internal Always 'JSX' for <T>. */
  $format?: 'JSX';
};

// Compile-time guard: TSugarProps must stay structurally identical to the
// shared sugar options type it re-declares.
type AssertExact<A, B> = A extends B ? (B extends A ? true : never) : never;
type _TSugarPropsInSync = Expect<
  AssertExact<TSugarProps, JsxTranslationOptionsWithSugar>
>;
type Expect<T extends true> = T;

type JsxTranslationOptions = StripDollarPrefix<JsxTranslationOptionsWithSugar> &
  TSugarProps;

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
}: {
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
  locale: string;
}): PreparedT {
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
