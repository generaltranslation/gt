import renderDefaultChildren from './renderDefaultChildren.shared';
import renderTranslatedChildren from './renderTranslatedChildren.shared';
import type { JsxChildren } from 'generaltranslation/types';
import type { ReactNode } from 'react';
import type { RenderVariable, TaggedChildren } from '../types';

// Shared rendering logic. The variable renderer is passed in by the caller so
// the RSC code path never statically imports the hook-based variable
// components. This module must stay free of hook/context imports so it can be
// reached from the context-rsc entrypoint.

type RenderPreparedTParams = {
  taggedSourceChildren: TaggedChildren;
  targetJsxChildren: JsxChildren | null | undefined;
  locale: string;
  defaultLocale: string;
  enableI18n: boolean;
  shouldTranslate: boolean;
};

function renderPreparedT({
  taggedSourceChildren,
  targetJsxChildren,
  locale,
  defaultLocale,
  enableI18n,
  shouldTranslate,
  renderVariable,
}: RenderPreparedTParams & {
  renderVariable: RenderVariable;
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
export type { RenderPreparedTParams };
