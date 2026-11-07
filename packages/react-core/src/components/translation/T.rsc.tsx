import { getI18nConfig } from 'gt-i18n/internal';
import type { ReactNode } from 'react';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { renderPreparedT } from '../../utils/rendering/renderPipeline.rsc';
import {
  prepareT,
  type ResolvedTProps,
} from '../../utils/translation/prepareT.shared';
import { JsxChildren } from '@generaltranslation/format/types';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

async function RscT({
  children: sourceChildren,
  _locale,
  _enableI18n,
  // TODO: don't expose to consumer, this should be thru an internal path
  _renderPreparedT = renderPreparedT,
  _translations,
  ...params
}: ResolvedTProps): Promise<ReactNode> {
  const locale = _locale;
  const enableI18n = _enableI18n;
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate =
    enableI18n && getI18nConfig().requiresTranslation(locale);
  const prepared = prepareT({
    sourceChildren,
    params,
    locale,
  });

  if (!shouldTranslate) {
    return _renderPreparedT({
      ...prepared,
      targetJsxChildren: undefined,
      locale,
      defaultLocale,
      enableI18n,
      shouldTranslate,
      hash: prepared.targetOptions.$_hash,
    });
  }

  // Translations embedded at the call site win over loaded translations
  const targetJsxChildren =
    _translations?.(locale) ??
    (await lookupTargetJsxChildren(
      locale,
      prepared.sourceJsxChildren,
      prepared.targetOptions
    ));

  return _renderPreparedT({
    ...prepared,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
    hash: prepared.targetOptions.$_hash,
  });
}

async function lookupTargetJsxChildren(
  locale: string,
  sourceJsxChildren: JsxChildren,
  targetOptions: ReturnType<typeof prepareT>['targetOptions']
): Promise<JsxChildren | undefined> {
  const i18nCache = getReactI18nCache();
  if (
    process.env.NODE_ENV !== 'production' &&
    getI18nConfig().isDevHotReloadEnabled()
  ) {
    return i18nCache.lookupTranslationWithFallback(
      locale,
      sourceJsxChildren,
      targetOptions
    );
  }
  const lookupTranslation = await i18nCache.getLookupTranslation(locale);
  return lookupTranslation(sourceJsxChildren, targetOptions);
}

/** @internal _gtt - The GT transformation for the component. */
RscT._gtt = 'translate-server';

// ===== Exports ===== //

export { RscT };
