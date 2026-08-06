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

  it('annotates a single host element directly (no wrapper span), preserving its props', () => {
    // When <T> renders a single host element, the hash goes ON that element —
    // no span. This keeps <T> copying the source 1:1 and stays valid inside
    // parents that reject a span (<tr>/<select>/<ul>).
    const singleEl = React.createElement(
      'b',
      { id: 'x' },
      'Hi'
    ) as unknown as TaggedChildren;
    const tagged = renderPreparedT({
      ...base,
      taggedSourceChildren: singleEl,
      hash: 'abc123',
    });
    expect(React.isValidElement(tagged)).toBe(true);
    const el = tagged as React.ReactElement<TagProps & { id?: string }>;
    expect(el.type).toBe('b'); // the element itself, NOT a span wrapper
    expect(el.props['data-_gt-hash']).toBe('abc123');
    expect(el.props.id).toBe('x'); // existing props preserved
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

  it('does NOT wrap values that render no DOM (null/undefined/booleans/"") even with a hash', () => {
    // A conditional <T> whose branch renders nothing must keep rendering nothing —
    // an empty <span data-_gt-hash> would change :empty/child structure and inject
    // an invalid span under restricted parents even for an empty branch.
    for (const empty of [null, undefined, true, false, '']) {
      const out = renderPreparedT({
        ...base,
        taggedSourceChildren: empty as unknown as TaggedChildren,
        hash: 'abc123',
      });
      const isSpan =
        React.isValidElement(out) &&
        (out as React.ReactElement).type === 'span';
      expect(isSpan).toBe(false);
      expect(out).toBe(empty); // returned unchanged
    }
  });
});

// Regression guard for the wiring that the isolated renderPreparedT tests above
// CANNOT catch: the <T> layer must COMPUTE a real hash (via resolveTagHash) and
// pass it down. The original bug shipped `hash: undefined` here while typecheck +
// the isolated tests stayed green. We drive RscT with an injected _renderPreparedT
// spy and force `requiresTranslation:false` so the no-translate path is taken (no
// i18n cache needed), then assert what actually reaches the renderer.
const cfg = vi.hoisted(() => ({ tagIds: true, legacy: false }));
vi.mock('gt-i18n/internal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('gt-i18n/internal')>();
  return {
    ...actual, // keep the REAL hashMessage so we verify a genuine hash
    getI18nConfig: () => {
      const c: Record<string, unknown> = {
        getDefaultLocale: () => 'en',
        requiresTranslation: () => false,
        isDevHotReloadEnabled: () => false,
      };
      // cfg.legacy simulates an OLDER shared-config copy (predating id-tagging, so
      // no isIdTaggingEnabled method) winning the first-writer singleton.
      if (!cfg.legacy) c.isIdTaggingEnabled = () => cfg.tagIds;
      return c;
    },
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
});

// resolveTagHash must produce a SINGLE hash shared with the translation lookup:
// it reuses a precomputed $_hash (compiler-injected) and, when it does compute,
// caches the result on options.$_hash so the lookup (which hashes the same
// options) short-circuits instead of hashing again.
describe('resolveTagHash single-hash reuse', () => {
  it('reuses a precomputed $_hash without recomputing', async () => {
    cfg.tagIds = true;
    const { resolveTagHash } = await import('../../translation/resolveTagHash');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = { $format: 'JSX', $_hash: 'precomputed' } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = resolveTagHash('Hello' as any, options);
    expect(out).toBe('precomputed'); // returned as-is, not recomputed
    expect(options.$_hash).toBe('precomputed');
  });

  it('computes once and caches on options so the lookup reuses it', async () => {
    cfg.tagIds = true;
    const { resolveTagHash } = await import('../../translation/resolveTagHash');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = { $format: 'JSX' } as any; // no $_hash yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = resolveTagHash('Hello' as any, options);
    expect(typeof out).toBe('string');
    expect((out as string).length).toBeGreaterThan(0);
    expect(options.$_hash).toBe(out); // cached → lookup will short-circuit to it
  });

  it('returns undefined and leaves options untouched when disabled', async () => {
    cfg.tagIds = false;
    const { resolveTagHash } = await import('../../translation/resolveTagHash');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = { $format: 'JSX' } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = resolveTagHash('Hello' as any, options);
    expect(out).toBeUndefined();
    expect(options.$_hash).toBeUndefined(); // pays nothing
  });

  it('treats an older shared config (no isIdTaggingEnabled method) as disabled — never throws', async () => {
    // I18nConfig is a first-writer-wins singleton shared across bundled copies; an
    // older copy without isIdTaggingEnabled must not crash every <T> render.
    const { resolveTagHash } = await import('../../translation/resolveTagHash');
    cfg.legacy = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options = { $format: 'JSX' } as any;
      let out;
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        out = resolveTagHash('Hello' as any, options);
      }).not.toThrow();
      expect(out).toBeUndefined();
      expect(options.$_hash).toBeUndefined();
    } finally {
      cfg.legacy = false; // reset so later tests see the modern config
    }
  });
});
