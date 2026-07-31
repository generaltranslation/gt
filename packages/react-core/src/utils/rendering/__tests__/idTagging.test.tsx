import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderPreparedT } from '../renderPipeline';
import type { TaggedChildren } from '../../types';

// Opt-in id-tagging: renderPreparedT wraps the <T> output in a layout-neutral
// span carrying the translation hash (data-_gt-hash) iff a `hash` is present.
// Presence of `hash` is the single signal — there is no separate boolean.

const base = {
  taggedSourceChildren: 'Hello' as TaggedChildren,
  targetJsxChildren: undefined,
  locale: 'en',
  defaultLocale: 'en',
  enableI18n: true,
  shouldTranslate: false,
};

type TagProps = {
  'data-_gt-hash'?: string;
  style?: { display?: string };
  children?: unknown;
};

describe('renderPreparedT id-tagging', () => {
  it('wraps in a display:contents span carrying data-_gt-hash, leaving the inner render untouched', () => {
    const untagged = renderPreparedT({ ...base });
    const tagged = renderPreparedT({ ...base, hash: 'abc123' });
    expect(React.isValidElement(tagged)).toBe(true);
    const el = tagged as React.ReactElement<TagProps>;
    expect(el.type).toBe('span');
    expect(el.props['data-_gt-hash']).toBe('abc123');
    expect(el.props.style).toEqual({ display: 'contents' });
    // the wrapper ONLY adds the span — the child is exactly the untagged output
    expect(el.props.children).toEqual(untagged);
  });

  it('does not wrap, and is identical to the untagged baseline, when no hash', () => {
    const baseline = renderPreparedT({ ...base });
    const undef = renderPreparedT({ ...base, hash: undefined });
    const isSpan =
      React.isValidElement(baseline) &&
      (baseline as React.ReactElement).type === 'span';
    expect(isSpan).toBe(false);
    expect(undef).toEqual(baseline);
  });
});

// Regression guard for the wiring that the isolated renderPreparedT tests above
// CANNOT catch: the <T> layer must COMPUTE a real hash (via computeTagHash) and
// pass it down. The original bug shipped `hash: undefined` here while typecheck +
// the isolated tests stayed green. We drive RscT with an injected _renderPreparedT
// spy and force `requiresTranslation:false` so the no-translate path is taken (no
// i18n cache needed), then assert what actually reaches the renderer.
const cfg = vi.hoisted(() => ({ tagIds: true }));
vi.mock('gt-i18n/internal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('gt-i18n/internal')>();
  return {
    ...actual, // keep the REAL hashMessage so we verify a genuine hash
    getI18nConfig: () => ({
      getDefaultLocale: () => 'en',
      requiresTranslation: () => false,
      isDevHotReloadEnabled: () => false,
      isIdTaggingEnabled: () => cfg.tagIds,
    }),
  };
});

describe('<T> (RSC) id-tagging wiring', () => {
  it('computes a real hash and passes it to the renderer when enabled', async () => {
    cfg.tagIds = true;
    const { RscT } = await import('../../../components/translation/T.rsc');
    const spy = vi.fn((_p: Record<string, unknown>) => null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (RscT as any)({
      children: 'Hello',
      _locale: 'en',
      _enableI18n: true,
      _renderPreparedT: spy,
    });
    expect(spy).toHaveBeenCalledOnce();
    const arg = spy.mock.calls[0][0];
    // the original bug: this was `undefined`
    expect(typeof arg.hash).toBe('string');
    expect((arg.hash as string).length).toBeGreaterThan(0);
  });

  it('passes no hash (pays nothing) when id-tagging is disabled', async () => {
    cfg.tagIds = false;
    const { RscT } = await import('../../../components/translation/T.rsc');
    const spy = vi.fn((_p: Record<string, unknown>) => null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (RscT as any)({
      children: 'Hello',
      _locale: 'en',
      _enableI18n: true,
      _renderPreparedT: spy,
    });
    const arg = spy.mock.calls[0][0];
    expect(arg.hash).toBeUndefined();
  });

  it('passes no hash when _noTag is set (span-hostile parent), even with id-tagging on', async () => {
    // The swc plugin injects _noTag on a <T> whose static parent can't legally
    // contain the tagging <span> (table/tr/select/...). Even with tagging enabled,
    // that <T> must render untagged to avoid invalid nesting / hydration mismatch.
    cfg.tagIds = true;
    const { RscT } = await import('../../../components/translation/T.rsc');
    const spy = vi.fn((_p: Record<string, unknown>) => null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (RscT as any)({
      children: 'Hello',
      _locale: 'en',
      _enableI18n: true,
      _renderPreparedT: spy,
      _noTag: true,
    });
    const arg = spy.mock.calls[0][0];
    expect(arg.hash).toBeUndefined();
  });
});
