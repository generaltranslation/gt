/**
 * Hash injection must be skipped for <T> components whose children contain a
 * <Derive> element.
 *
 * A <T> with <Derive> children maps to multiple translation variants (one
 * hash per resolved variant, registered by the CLI). Injecting a single
 * compile-time _hash pins the runtime lookup to a hash that matches none of
 * the variants, so the rendered translation gets stuck on one variant.
 *
 * The same applies to <T $context={derive(...)}>: collection intentionally
 * produces an empty hash (CLI resolution), and injecting _hash: "" breaks the
 * runtime lookup because $_hash is read with ?? (empty string wins).
 */
import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { collectionPass } from '../collectionPass';
import { injectionPass } from '../injectionPass';
import { initializeState } from '../../state/utils/initializeState';
import hashSource from '../../utils/calculateHash';

// --- Helper ---

/**
 * Runs collection → error check → injection → codegen.
 * Mirrors the transform() pipeline in index.ts for already-compiled JSX.
 */
function transform(
  code: string,
  options: Record<string, unknown> = {}
): { code: string; errors: string[] } {
  const state = initializeState(options, 'test.tsx');

  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });

  traverse(ast, collectionPass(state));

  const errors = state.errorTracker.getErrors();
  if (errors.length > 0) {
    return { code, errors };
  }

  if (state.stringCollector.hasContent()) {
    traverse(ast, injectionPass(state));
  }

  const output = generate(ast, { retainLines: true, compact: false });
  return { code: output.code, errors };
}

// --- Tests ---

describe('T component hash injection with Derive children', () => {
  it('plain <T> still gets _hash injected', () => {
    // SOURCE: <T>Hello world</T>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      jsx(T, { children: "Hello world" });
    `;
    const expectedHash = hashSource({
      source: 'Hello world',
      dataFormat: 'JSX',
    });
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain(`_hash: "${expectedHash}"`);
  });

  it('<T> with a direct <Derive> child skips hash injection', () => {
    // SOURCE: <T><Derive>{cond ? "a" : "b"}</Derive></T>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Derive, T } from 'gt-react';
      jsx(T, { children: jsx(Derive, { children: cond ? "a" : "b" }) });
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toContain('_hash');
  });

  it('<T> with a nested <Derive> descendant skips hash injection', () => {
    // SOURCE: <T><p>The <Derive>{...}</Derive> is ready.</p></T>
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Derive, T } from 'gt-react';
      jsx(T, { children: jsxs("p", { children: [
        "The ",
        jsx(Derive, { children: traveler === "solo" ? "solo traveler" : "family" }),
        " is ready."
      ] }) });
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toContain('_hash');
  });

  it('<T $context={derive(...)}> does not get an empty _hash injected', () => {
    // SOURCE: <T $context={derive(getMeaning())}>Book</T>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { T, derive } from 'gt-react';
      jsx(T, { children: "Book", $context: derive(getMeaning()) });
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toContain('_hash');
  });

  it('autoderive dynamic content does not get an empty _hash injected', () => {
    // SOURCE: <T>Hello {name}</T> with autoderive enabled
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      jsxs(T, { children: ["Hello ", name] });
    `;
    const result = transform(code, { autoderive: true });
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toContain('_hash');
  });

  it('a Derive <T> does not shift hashes of sibling <T> components', () => {
    // The counter slots of the collection and injection passes must stay
    // aligned: the plain <T> after the Derive <T> gets its own hash.
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Derive, T } from 'gt-react';
      jsx(T, { children: jsx(Derive, { children: cond ? "a" : "b" }) });
      jsx(T, { children: "Plain sibling" });
    `;
    const expectedHash = hashSource({
      source: 'Plain sibling',
      dataFormat: 'JSX',
    });
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    const hashes = result.code.match(/_hash: "[^"]*"/g) ?? [];
    expect(hashes).toEqual([`_hash: "${expectedHash}"`]);
  });
});

describe('T component hash injection with Derive inside branches', () => {
  it('<T> with <Derive> inside a Branch branch attribute skips hash injection', () => {
    // SOURCE: <T><Branch branch={x} a={<Derive>{getX()}</Derive>} b="fallback" /></T>
    // The Derive sits in a branch attribute (constructed via constructGTProp),
    // not in the children — detection must bubble up from branch construction.
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Branch, Derive, T } from 'gt-react';
      jsx(T, { children: jsx(Branch, {
        branch: cond,
        a: jsx(Derive, { children: getX() }),
        b: "fallback"
      }) });
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toContain('_hash');
  });

  it('<T> with <Derive> inside a Plural branch attribute skips hash injection', () => {
    // SOURCE: <T><Plural n={count} one={<Derive>{getX()}</Derive>} other="many" /></T>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Derive, Plural, T } from 'gt-react';
      jsx(T, { children: jsx(Plural, {
        n: count,
        one: jsx(Derive, { children: getX() }),
        other: "many"
      }) });
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toContain('_hash');
  });

  it('<T> with a Branch but no Derive still gets _hash injected', () => {
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Branch, T } from 'gt-react';
      jsx(T, { children: jsx(Branch, {
        branch: cond,
        a: "first",
        b: "fallback"
      }) });
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('_hash: "');
  });
});
