import renderDefaultChildren from './renderDefaultChildren';
import renderTranslatedChildren from './renderTranslatedChildren';
import { renderVariable as defaultRenderVariable } from './renderVariable';
import type { JsxChildren } from 'generaltranslation/types';
import type { ReactNode } from 'react';
import type { RenderVariable, TaggedChildren } from '../types';

function renderPreparedT({
  taggedSourceChildren,
  targetJsxChildren,
  locale,
  defaultLocale,
  enableI18n,
  shouldTranslate,
  renderVariable = defaultRenderVariable,
}: {
  taggedSourceChildren: TaggedChildren;
  targetJsxChildren: JsxChildren | null | undefined;
  locale: string;
  defaultLocale: string;
  enableI18n: boolean;
  shouldTranslate: boolean;
  renderVariable?: RenderVariable;
}): ReactNode {
  if (!shouldTranslate || targetJsxChildren == null) {
    return renderSource({
      taggedSourceChildren,
      defaultLocale,
      enableI18n,
      renderVariable,
    });
  }

  return renderTarget({
    taggedSourceChildren,
    targetJsxChildren,
    locales: [locale, defaultLocale],
    enableI18n,
    renderVariable,
  });
}

function renderSource({
  taggedSourceChildren,
  defaultLocale,
  enableI18n,
  renderVariable,
}: {
  taggedSourceChildren: TaggedChildren;
  defaultLocale: string;
  enableI18n: boolean;
  renderVariable: RenderVariable;
}): ReactNode {
  return renderDefaultChildren({
    children: taggedSourceChildren,
    defaultLocale,
    enableI18n,
    renderVariable,
  });
}

function renderTarget({
  taggedSourceChildren,
  targetJsxChildren,
  locales,
  enableI18n,
  renderVariable,
}: {
  taggedSourceChildren: TaggedChildren;
  targetJsxChildren: JsxChildren;
  locales: string[];
  enableI18n: boolean;
  renderVariable: RenderVariable;
}): ReactNode {
  return renderTranslatedChildren({
    source: taggedSourceChildren,
    target: targetJsxChildren,
    locales,
    enableI18n,
    renderVariable,
  });
}

export { renderPreparedT };
