import {
  getReactI18nCache,
  prepareT,
  renderPreparedT,
  type JsxTranslationOptions,
} from '@generaltranslation/react-core/context';
import { getI18nConfig } from 'gt-i18n/internal';
import type { ReactNode } from 'react';
import { renderVariable } from '../../utils/rendering/renderVariable';

// ===== Component ===== //

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

export { RscT };
