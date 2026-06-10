import { createRenderDefaultChildren } from './renderDefaultChildren.shared';
import { createRenderTranslatedChildren } from './renderTranslatedChildren.shared';
import type { JsxChildren } from 'generaltranslation/types';
import type { ReactNode } from 'react';
import type { RenderVariable, TaggedChildren } from '../types';

// Shared rendering logic. The variable renderer is injected through a factory
// so the RSC code path never statically imports the hook-based variable
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

function createRenderPreparedT({
  renderVariable,
}: {
  renderVariable: RenderVariable;
}): (args: RenderPreparedTParams) => ReactNode {
  const renderDefaultChildren = createRenderDefaultChildren({ renderVariable });
  const renderTranslatedChildren = createRenderTranslatedChildren({
    renderVariable,
  });

  function renderPreparedT({
    taggedSourceChildren,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
  }: RenderPreparedTParams): ReactNode {
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

  return renderPreparedT;
}

export { createRenderPreparedT };
export type { RenderPreparedTParams };
