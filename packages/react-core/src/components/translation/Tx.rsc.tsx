import { getI18nConfig } from 'gt-i18n/internal';
import type { ReactNode } from 'react';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { renderPreparedT } from '../../utils/rendering/renderPipeline.rsc';
import { computeTagHash } from '../../utils/translation/computeTagHash';
import {
  prepareT,
  type ResolvedTProps,
} from '../../utils/translation/prepareT.shared';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

async function RscTx({
  children: sourceChildren,
  _locale,
  _enableI18n,
  // TODO: don't expose to consumer, this should be thru an internal path
  _renderPreparedT = renderPreparedT,
  // See TProps._noTag. The swc plugin only injects this on <T>, not <Tx>, so it
  // is normally undefined here; destructured out regardless so it can never reach
  // the hashed options, and honored for uniformity if ever set.
  _noTag,
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
      // <Tx> serves published translations keyed by the same hashMessage as <T>,
      // so tag it too (else id-tagging tooling silently misses all <Tx> content).
      hash: _noTag
        ? undefined
        : computeTagHash(prepared.sourceJsxChildren, prepared.targetOptions),
    });
  }

  const i18nCache = getReactI18nCache();
  const targetJsxChildren = await i18nCache.lookupTranslationWithFallback(
    locale,
    prepared.sourceJsxChildren,
    prepared.targetOptions
  );

  return _renderPreparedT({
    ...prepared,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
    hash: _noTag
      ? undefined
      : computeTagHash(prepared.sourceJsxChildren, prepared.targetOptions),
  });
}

/** @internal _gtt - The GT transformation for the component. */
RscTx._gtt = 'translate-runtime';

// ===== Exports ===== //

export { RscTx };
