import { getI18nConfig } from 'gt-i18n/internal';
import type { ReactNode } from 'react';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { renderPreparedT } from '../../utils/rendering/renderPipeline.rsc';
import {
  prepareT,
  type ResolvedTProps,
} from '../../utils/translation/prepareT.shared';
import { JsxChildren } from '@generaltranslation/format/types';
import { logRuntimeTranslationRenderError } from '../../utils/errors/logRuntimeTranslationError';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

async function RscT({
  children: sourceChildren,
  _locale,
  _enableI18n,
  // TODO: don't expose to consumer, this should be thru an internal path
  _renderPreparedT = renderPreparedT,
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

  let targetJsxChildren: JsxChildren | undefined;
  const i18nCache = getReactI18nCache();
  // In development the cache rethrows lookup failures (for example a 401 from
  // an invalid dev API key); degrade to source content instead of letting the
  // rejection crash the server render.
  try {
    if (
      process.env.NODE_ENV !== 'production' &&
      getI18nConfig().isDevHotReloadEnabled()
    ) {
      targetJsxChildren = await i18nCache.lookupTranslationWithFallback(
        locale,
        prepared.sourceJsxChildren,
        prepared.targetOptions
      );
    } else {
      const lookupTranslation = await i18nCache.getLookupTranslation(locale);
      targetJsxChildren = lookupTranslation(
        prepared.sourceJsxChildren,
        prepared.targetOptions
      );
    }
  } catch (error) {
    logRuntimeTranslationRenderError(error);
  }

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

/** @internal _gtt - The GT transformation for the component. */
RscT._gtt = 'translate-server';

// ===== Exports ===== //

export { RscT };
