import renderDefaultChildren from './renderDefaultChildren';
import renderTranslatedChildren from './renderTranslatedChildren';
import type { JsxChildren } from 'generaltranslation/types';
import type { ReactNode } from 'react';
import type { TaggedChildren } from '../types';

function renderPreparedT({
  taggedSourceChildren,
  targetJsxChildren,
  locale,
  defaultLocale,
  enableI18n,
  shouldTranslate,
}: {
  taggedSourceChildren: TaggedChildren;
  targetJsxChildren: JsxChildren | null | undefined;
  locale: string;
  defaultLocale: string;
  enableI18n: boolean;
  shouldTranslate: boolean;
}): ReactNode {
  if (!shouldTranslate || targetJsxChildren == null) {
    return renderSource({
      taggedSourceChildren,
      defaultLocale,
      enableI18n,
    });
  }

  return renderTarget({
    taggedSourceChildren,
    targetJsxChildren,
    locales: [locale, defaultLocale],
    enableI18n,
  });
}

function renderSource({
  taggedSourceChildren,
  defaultLocale,
  enableI18n,
}: {
  taggedSourceChildren: TaggedChildren;
  defaultLocale: string;
  enableI18n: boolean;
}): ReactNode {
  return renderDefaultChildren({
    children: taggedSourceChildren,
    defaultLocale,
    enableI18n,
  });
}

function renderTarget({
  taggedSourceChildren,
  targetJsxChildren,
  locales,
  enableI18n,
}: {
  taggedSourceChildren: TaggedChildren;
  targetJsxChildren: JsxChildren;
  locales: string[];
  enableI18n: boolean;
}): ReactNode {
  return renderTranslatedChildren({
    source: taggedSourceChildren,
    target: targetJsxChildren,
    locales,
    enableI18n,
  });
}

export { renderPreparedT };
