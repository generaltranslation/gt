import type { RenderDefaultChildrenArgs } from './renderDefaultChildren.shared';
import type { RenderTranslatedChildrenArgs } from './renderTranslatedChildren.shared';
import type { JsxChildren } from 'generaltranslation/types';
import { createElement, type ReactNode } from 'react';
import type { TaggedChildren } from '../types';

// Opt-in id-tagging: when a `hash` is provided, the <T> output is wrapped in a
// layout-neutral span carrying the translation hash (`data-_gt-hash`) so tooling
// can map a rendered node back to its published translation. `display: contents`
// makes the span generate no box, so children lay out exactly as before.
//
// DOM-only: skipped on React Native (there is no `span` host component, and the
// hash is a DOM-tooling concept with no native analog). The rest of this module
// stays platform-agnostic; this is a runtime guard, not a native import.
const TAG_STYLE = { display: 'contents' } as const;
// Canonical React Native detection (RN sets navigator.product = 'ReactNative').
// False in the browser AND in Node SSR/RSC, so the span is still emitted server-
// side (where the harvest reads it).
const IS_REACT_NATIVE =
  (globalThis as { navigator?: { product?: string } }).navigator?.product ===
  'ReactNative';

// Shared rendering logic. The child renderers are injected so the RSC code path
// never statically imports the hook-based variable components, and so the
// pipeline can build them once and share them. This module must stay free of
// hook/context imports so it can be reached from the components-rsc entrypoint.

type RenderPreparedTParams = {
  taggedSourceChildren: TaggedChildren;
  targetJsxChildren: JsxChildren | null | undefined;
  locale: string;
  defaultLocale: string;
  enableI18n: boolean;
  shouldTranslate: boolean;
  // The translation hash for this <T> (see computeTagHash) — the same key the
  // published-translation cache/CDN is keyed by. Set only when id-tagging is
  // enabled; when undefined the output is rendered untouched. Presence of `hash`
  // is the single signal to tag (there is no separate boolean).
  hash?: string;
};

function createRenderPreparedT({
  renderDefaultChildren,
  renderTranslatedChildren,
}: {
  renderDefaultChildren: (args: RenderDefaultChildrenArgs) => ReactNode;
  renderTranslatedChildren: (args: RenderTranslatedChildrenArgs) => ReactNode;
}): (args: RenderPreparedTParams) => ReactNode {
  function renderPreparedT({
    taggedSourceChildren,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
    hash,
  }: RenderPreparedTParams): ReactNode {
    const rendered =
      !shouldTranslate || targetJsxChildren == null
        ? renderSource({
            taggedSourceChildren,
            defaultLocale,
            enableI18n,
          })
        : renderTarget({
            taggedSourceChildren,
            targetJsxChildren,
            locales: [locale, defaultLocale],
            enableI18n,
          });

    // Opt-in: expose the translation hash on the DOM (web only) so tooling can
    // map a rendered node back to its published translation (see TAG_STYLE note).
    if (hash && !IS_REACT_NATIVE) {
      return createElement(
        'span',
        { 'data-_gt-hash': hash, style: TAG_STYLE },
        rendered
      );
    }

    return rendered;
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
