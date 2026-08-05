import type { RenderDefaultChildrenArgs } from './renderDefaultChildren.shared';
import type { RenderTranslatedChildrenArgs } from './renderTranslatedChildren.shared';
import type { JsxChildren } from 'generaltranslation/types';
import {
  cloneElement,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { TaggedChildren } from '../types';

// Opt-in id-tagging: when a `hash` is provided, the translation hash is exposed
// on the DOM as `data-_gt-hash` so tooling can map a rendered node back to its
// published translation.
//
// Span injection is kept to the minimum necessary: when the <T> renders a single
// host element we put the attribute directly on THAT element (no wrapper), so <T>
// keeps copying the source 1:1. Only when there is no element to carry it — bare
// text, a fragment, or a component root — do we inject a layout-neutral span
// (`display: contents`, so it generates no box and children lay out as before).
//
// DOM-only: skipped on React Native (there is no `span`/DOM attribute analog).
// The rest of this module stays platform-agnostic; this is a runtime guard, not a
// native import.
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
  // The translation hash for this <T> (see resolveTagHash) — the same key the
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
    // map a rendered node back to its published translation (see the header note).
    if (hash && !IS_REACT_NATIVE) {
      // Single host element (e.g. `<T><td>…</td></T>`) → annotate it directly,
      // no wrapper. This is valid wherever the element itself is valid — including
      // inside <tr>/<select>/<ul> — and avoids the span entirely.
      if (isValidElement(rendered) && typeof rendered.type === 'string') {
        return cloneElement(rendered as ReactElement<Record<string, unknown>>, {
          'data-_gt-hash': hash,
        });
      }
      // No element to carry the attribute (bare text / fragment / component root)
      // → wrap in a layout-neutral span. This is the only case that injects one.
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
