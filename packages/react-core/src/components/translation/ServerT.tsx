import type { ReactNode } from 'react';
import { getI18nConfig } from 'gt-i18n/internal';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { prepareTSource, renderTResult, type TProps } from './shared';
import { renderServerVariable } from './renderServerVariable';

type ServerTProps = TProps & {
  locale: string;
};

async function T({
  children: sourceChildren,
  locale,
  ...params
}: ServerTProps): Promise<ReactNode> {
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const prepared = prepareTSource({
    defaultLocale,
    locale,
    params,
    shouldTranslate: getI18nConfig().requiresTranslation(locale),
    sourceChildren,
  });
  const lookupTranslation =
    await getReactI18nCache().getLookupTranslation(locale);
  const targetJsxChildren = lookupTranslation(
    prepared.sourceJsxChildren,
    prepared.targetOptions
  );

  return renderTResult({
    prepared,
    renderVariable: renderServerVariable,
    targetJsxChildren,
  });
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';

export { T };
export type { ServerTProps };
