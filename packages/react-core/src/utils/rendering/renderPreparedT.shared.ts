import type { RenderDefaultChildrenArgs } from './renderDefaultChildren.shared';
import type { RenderTranslatedChildrenArgs } from './renderTranslatedChildren.shared';
import type { JsxChildren } from 'generaltranslation/types';
import {
  cloneElement,
  createElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { TaggedChildren } from '../types';
import { idTaggingEnabled } from '../translation/resolveTagHash';

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

// Whether a rendered node produces NO DOM — so id-tagging must leave it untouched
// (wrapping it in a hash span would create an empty <span>, altering :empty/child
// structure and injecting an invalid span under restricted parents). Covers the
// scalar non-renderers (null / undefined / booleans / ''), arrays whose every
// element renders nothing (`items.map(...)` over an empty list, `[null, false]`,
// nested empties — TaggedChildren accepts arrays), and empty React fragments.
// NB: 0 and NaN DO render text, so they are intentionally NOT treated as empty.
function rendersNothing(node: ReactNode): boolean {
  if (node == null || typeof node === 'boolean' || node === '') return true;
  if (Array.isArray(node)) return !node.some((n) => !rendersNothing(n));
  if (isValidElement(node) && node.type === Fragment) {
    const children = (node.props as { children?: ReactNode }).children;
    return children == null || rendersNothing(children);
  }
  return false;
}

// Opt-in id-tagging (powers RRWeb localized replay / in-context tooling): expose
// the translation hash on the DOM as `data-_gt-hash`. Factored out of the render
// path so it's clear this whole block is dedicated to id-tagging, not core <T>
// behavior. Called only when a `hash` was produced (see resolveTagHash).
function applyIdTag(rendered: ReactNode, hash: string): ReactNode {
  // `hash` is only produced when tagging is on, but re-assert the config here so a
  // stray hash can never inject DOM; and never on React Native (no span/DOM attr
  // analog — IS_REACT_NATIVE is checked first so the config isn't read there).
  if (IS_REACT_NATIVE || !idTaggingEnabled()) return rendered;
  // Single host element (e.g. `<T><td>…</td></T>`) → annotate it directly, no
  // wrapper. Valid wherever the element itself is valid — including inside
  // <tr>/<select>/<ul> — and avoids the span entirely.
  if (isValidElement(rendered) && typeof rendered.type === 'string') {
    return cloneElement(rendered as ReactElement<Record<string, unknown>>, {
      'data-_gt-hash': hash,
    });
  }
  // Output that renders no DOM stays no-DOM: an empty <span data-_gt-hash> would
  // change :empty/child structure and inject an (invalid, under restricted
  // parents) span even for an empty branch.
  if (rendersNothing(rendered)) return rendered;
  // No element to carry the attribute (bare text / fragment / component root) →
  // wrap in a layout-neutral span. This is the only case that injects one.
  return createElement(
    'span',
    { 'data-_gt-hash': hash, style: TAG_STYLE },
    rendered
  );
}

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

    // Opt-in id-tagging is entirely handled by applyIdTag; `hash` presence is the
    // enable signal (produced by resolveTagHash only when tagging is on).
    return hash ? applyIdTag(rendered, hash) : rendered;
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
      // The shared persisted wire also admits empty-rendering boolean/null
      // values. The outer null check and existing renderer fallback own those
      // cases; this narrower internal renderer type describes its recursive
      // element/string grammar without changing React runtime behavior.
      target: targetJsxChildren as RenderTranslatedChildrenArgs['target'],
      locales,
      enableI18n,
    });
  }

  return renderPreparedT;
}

export { createRenderPreparedT };
export type { RenderPreparedTParams };
