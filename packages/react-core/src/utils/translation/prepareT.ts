import { useMemo } from 'react';
import addGTIdentifier from '../internal/addGTIdentifier';
import { removeInjectedT } from '../internal/removeInjectedT';
import writeChildrenAsObjects from '../internal/writeChildrenAsObjects';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { getShouldTranslate } from '../../hooks/utils';
import { getI18nConfig } from 'gt-i18n/internal';
import type { JsxTranslationOptions as JsxTranslationOptionsWithSugar } from 'gt-i18n/types';
import type { JsxChildren } from 'generaltranslation/types';
import type { ReactNode } from 'react';
import type { TaggedChildren } from '../types';

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

function usePrepareT({
  sourceChildren,
  params,
}: {
  sourceChildren: ReactNode;
  params: JsxTranslationOptions;
}): PreparedT & {
  defaultLocale: string;
  locale: string;
  enableI18n: boolean;
  shouldTranslate: boolean;
} {
  const locale = useLocale();
  const enableI18n = useEnableI18n();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate = getShouldTranslate();
  const prepared = useMemo(
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
    shouldTranslate,
    ...prepared,
  };
}

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
  };
}

export { prepareT, usePrepareT };
export type { JsxTranslationOptions, PreparedT };
