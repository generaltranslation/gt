import { getI18nConfig } from 'gt-i18n/internal';
import type { ReactNode } from 'react';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { renderPreparedT } from '../../utils/rendering/renderPreparedT';
import { renderVariable } from '../../utils/rendering/renderVariable.rsc';
import { prepareT } from '../../utils/translation/prepareTPure';
import type { JsxTranslationOptions } from '../../utils/translation/prepareTPure';

// ===== Component ===== //

/**
 * RSC version of the `<T>` component. Resolves translations from the i18n cache
 * and renders without React context, so it is safe to evaluate in the
 * Next.js server (RSC) module graph.
 */
async function RscT({
  children: sourceChildren,
  locale,
  enableI18n,
  ...params
}: {
  children: ReactNode;
  locale: string;
  enableI18n: boolean;
} & JsxTranslationOptions): Promise<ReactNode> {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate =
    enableI18n && getI18nConfig().requiresTranslation(locale);
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
      enableI18n,
      shouldTranslate,
      renderVariable,
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
    enableI18n,
    shouldTranslate,
    renderVariable,
  });
}

/** @internal _gtt - The GT transformation for the component. */
RscT._gtt = 'translate-server';

// ===== Exports ===== //

export { RscT };
