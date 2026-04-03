/**
 * End-to-end tests: JSX insertion → collection → error check.
 *
 * These verify that auto-inserted _T/_Var structures survive the full
 * compiler pipeline without triggering "dynamic content in T" errors
 * that would throw InvalidLibraryUsageError (build break) or return null
 * (soft lock when disableBuildChecks=true).
 *
 * The error path:
 *   insertion pass → collection pass → validateTranslationComponentArgs
 *                                        → constructJsxChildren
 *                                          → validateIdentifier (if bare identifier found)
 *                                            → "dynamic content" error → BUILD BREAK
 */
import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { jsxInsertionPass } from '../jsxInsertionPass';
import { collectionPass } from '../collectionPass';
import { injectionPass } from '../injectionPass';
import { initializeState } from '../../state/utils/initializeState';

// --- Helper ---

/**
 * Runs the full pipeline: insertion → collection → error check → injection → codegen.
 * Mirrors index.ts transform() exactly.
 * Returns null if the pipeline would soft lock (disableBuildChecks=true).
 * Throws if build breaks (disableBuildChecks=false, default).
 */
function fullPipeline(code: string): {
  code: string | null;
  errors: string[];
  hasCollectionContent: boolean;
  manifest: Record<string, unknown>;
} {
  const state = initializeState({ enableAutoJsxInjection: true }, 'test.tsx');
  state.debugManifest = new Map<string, unknown>();

  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });

  // Pass 1: JSX insertion
  traverse(ast, jsxInsertionPass(state));

  // Pass 2: Collection
  traverse(ast, collectionPass(state));

  const errors = state.errorTracker.getErrors();
  const hasCollectionContent = state.stringCollector.hasContent();

  const manifest = Object.fromEntries(state.debugManifest!);

  // Don't throw — capture errors for assertions
  if (errors.length > 0) {
    return { code: null, errors, hasCollectionContent, manifest };
  }

  // Pass 3: Injection
  if (hasCollectionContent) {
    traverse(ast, injectionPass(state));
  }

  // Generate
  if (!hasCollectionContent && state.statistics.jsxInsertionsCount === 0) {
    return { code: null, errors, hasCollectionContent, manifest };
  }

  const output = generate(ast, { retainLines: true, compact: false });
  return { code: output.code, errors, hasCollectionContent, manifest };
}

// --- Tests ---

describe('JSX insertion → collection E2E (no soft locks)', () => {
  it('simple text + dynamic expression — no errors through full pipeline', () => {
    // BEFORE JSX:  <div>Hello {name}</div>
    // AFTER INSERTION:  <div><_T>Hello <_Var>{name}</_Var></_T></div>
    // COLLECTION: _T with children ["Hello ", _Var(name)] — valid, no bare identifiers
    //
    // Note: both jsx and jsxs must be imported (as in real Vite/React builds).
    // The insertion pass wraps dynamic content with jsx(GtInternalVar, ...) using
    // singleCallee, which requires jsx to be importable. If only jsxs is imported,
    // the fallback 'jsx' string won't be in the scope tracker → collection error.
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", name] });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
    expect(result.hasCollectionContent).toBe(true);
  });

  it('multiple dynamic expressions — all Var-wrapped, no errors', () => {
    // BEFORE JSX:  <div>Hello {firstName}, welcome to {city}!</div>
    // AFTER INSERTION:  <div><_T>Hello <_Var>{firstName}</_Var>, welcome to <_Var>{city}</_Var>!</_T></div>
    // COLLECTION: _T with array of strings + _Var calls — all valid
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", firstName, ", welcome to ", city, "!"] });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
    expect(result.hasCollectionContent).toBe(true);
  });

  it('Branch with dynamic fallback children — no errors (children Var-wrapped)', () => {
    // BEFORE JSX:  <div><Branch branch={x}>Fallback {name}</Branch></div>
    // AFTER INSERTION:  <div><_T><Branch branch={x}>Fallback <_Var>{name}</_Var></Branch></_T></div>
    // If the insertion pass failed to Var-wrap {name} in Branch children,
    // collection would see a bare identifier and throw "dynamic content" error.
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Branch } from 'gt-react';
      jsx("div", { children: jsxs(Branch, {
        branch: x,
        children: ["Fallback ", name]
      }) });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
  });

  it('Plural with dynamic fallback children — no errors', () => {
    // BEFORE JSX:  <div><Plural n={count}>You have {count} items</Plural></div>
    // AFTER INSERTION:  <div><_T><Plural n={count}>You have <_Var>{count}</_Var> items</Plural></_T></div>
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Plural } from 'gt-react';
      jsx("div", { children: jsxs(Plural, {
        n: count,
        children: ["You have ", count, " items"]
      }) });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
  });

  it('ternary with JSX branches alongside text — no errors', () => {
    // BEFORE JSX:  <div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>
    // AFTER INSERTION:  _T at div, _Var wraps ternary, each span gets _T
    // Multiple _T calls processed by collection — each must be valid
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: [
        "Status: ",
        isActive ? jsx("span", { children: "Active" }) : jsx("span", { children: "Inactive" })
      ] });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
  });

  it('Derive alongside dynamic expression — no errors', () => {
    // BEFORE JSX:  <div>Hello <Derive>{getX()}</Derive> and {z}</div>
    // AFTER INSERTION:  <div><_T>Hello <Derive>{getX()}</Derive> and <_Var>{z}</_Var></_T></div>
    // If {z} escaped without _Var wrapping: "dynamic content" error → build break
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Derive } from 'gt-react';
      jsxs("div", { children: [
        "Hello ", jsx(Derive, { children: getX() }),
        " and ", z
      ] });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
  });

  it('non-children prop with text + dynamic — no errors', () => {
    // BEFORE JSX:  <Card header={<h1>Title {count}</h1>}>Body</Card>
    // AFTER INSERTION:  header gets independent _T with _Var around count
    // Both _T calls (header + children) go through collection
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      jsx(Card, {
        header: jsxs("h1", { children: ["Title ", count] }),
        children: "Body"
      });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
  });

  // ===== Missing jsx import (only jsxs available) =====

  it('jsxs-only file with dynamic content — _Var needs jsx but only jsxs is imported', () => {
    // In Vite production, files with only multi-child elements import jsxs but NOT jsx.
    // The insertion pass creates jsx(GtInternalVar, ...) using singleCallee ?? 'jsx',
    // but 'jsx' isn't imported. The collection pass then fails with "dynamic content" error.
    //
    // BEFORE JSX:  <div>Hello {name}</div>  (compiled with jsxs only)
    // EXPECTED:    insertion pass should handle missing jsx import gracefully
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", name] });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
    expect(result.hasCollectionContent).toBe(true);
  });

  it('jsxs-only file with multiple dynamic expressions — all need jsx callee', () => {
    // Same issue but with multiple _Var wrappers — each one uses the missing jsx callee
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("p", { children: ["Hello ", firstName, ", welcome to ", city, "!"] });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
    expect(result.hasCollectionContent).toBe(true);
  });

  it('jsxs-only file with Branch fallback dynamic content', () => {
    // Branch children with dynamic content — _Var wrapper needs jsx callee
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      import { Branch } from 'gt-react';
      jsxs("div", { children: [
        "Label: ",
        jsxs(Branch, { branch: x, children: ["Fallback ", name] })
      ] });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
  });

  // ===== Derive representation in jsxChildren =====

  it('Derive is represented as an element in jsxChildren, not a variable', () => {
    // Derive should appear as { "t": "Derive", "i": N, "c": ... } in jsxChildren,
    // NOT as { "i": N, "k": "...", "v": "s" } (a variable slot).
    // The compiler currently incorrectly treats Derive as a variable.
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Derive } from 'gt-react';
      jsxs("div", { children: ["Hello ", jsx(Derive, { children: getX() })] });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();

    // Find the manifest entry containing "Hello "
    const entries = Object.values(result.manifest);
    const mainEntry = entries.find(
      (e) => Array.isArray(e) && JSON.stringify(e).includes('Hello')
    ) as unknown[];
    expect(mainEntry).toBeDefined();

    // The Derive element should have "t" (type), not "v" (variable type)
    const deriveEl = mainEntry!.find(
      (child) => typeof child === 'object' && child !== null && 'i' in child
    ) as Record<string, unknown>;
    expect(deriveEl).toBeDefined();
    const deriveJson = JSON.stringify(deriveEl);
    expect(deriveJson).not.toContain('"v"');
    expect(deriveEl).toHaveProperty('t');
  });

  it('Plural branch prop indices branch independently from children indices', () => {
    // Branch/Plural prop values (like `one`) and children are separate branches.
    // Their indices should start from the same base — NOT share a sequential counter.
    //
    // SOURCE: <Plural n={n} one={<><strong>one</strong></>}><>other</></Plural>
    //
    // EXPECTED jsxChildren:
    //   {
    //     "t": "Plural", "i": 1,
    //     "d": { "b": { "one": { "t": "C2", "i": 2, "c": { "t": "strong", "i": 3, "c": "one" } } }, "t": "p" },
    //     "c": { "t": "C2", "i": 2, "c": "other" }
    //   }
    //
    // Note: both `one` prop and `children` start at i:2 — indices branch independently.
    // BUG: compiler uses a shared sequential counter, producing i:3 for `one` prop instead of i:2.
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Fragment } from 'react';
      import { Plural } from 'gt-react';
      jsx(Plural, {
        n: n,
        one: jsx(Fragment, { children: jsx("strong", { children: "one" }) }),
        children: jsx(Fragment, { children: "other" })
      });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);

    const entries = Object.values(result.manifest);
    const pluralEntry = entries.find(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        't' in e &&
        (e as any).t === 'Plural'
    ) as Record<string, unknown>;
    expect(pluralEntry).toBeDefined();

    const expected = {
      t: 'Plural',
      i: 1,
      d: {
        b: {
          one: { t: 'C2', i: 2, c: { t: 'strong', i: 3, c: 'one' } },
        },
        t: 'p',
      },
      c: { t: 'C2', i: 2, c: 'other' },
    };
    expect(pluralEntry).toEqual(expected);
  });

  it('Branch branch prop indices branch independently from children indices', () => {
    // Same principle as Plural: each branch prop and children count independently.
    // Children must be JSX (not a plain string) to trigger the counter increment.
    //
    // SOURCE: <Branch branch="x" a={<span>Option A</span>}><>Default</></Branch>
    //
    // EXPECTED jsxChildren:
    //   {
    //     "t": "Branch", "i": 1,
    //     "d": { "b": { "a": { "t": "span", "i": 2, "c": "Option A" } }, "t": "b" },
    //     "c": { "t": "C2", "i": 2, "c": "Default" }
    //   }
    //
    // Both `a` prop and `children` start counting at i:2 independently.
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Fragment } from 'react';
      import { Branch } from 'gt-react';
      jsx(Branch, {
        branch: "x",
        a: jsx("span", { children: "Option A" }),
        children: jsx(Fragment, { children: "Default" })
      });
    `;
    const result = fullPipeline(code);
    expect(result.errors).toHaveLength(0);

    const entries = Object.values(result.manifest);
    const branchEntry = entries.find(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        't' in e &&
        (e as Record<string, unknown>).t === 'Branch'
    ) as Record<string, unknown>;
    expect(branchEntry).toBeDefined();

    const expected = {
      t: 'Branch',
      i: 1,
      d: {
        b: {
          a: { t: 'span', i: 2, c: 'Option A' },
        },
        t: 'b',
      },
      c: { t: 'C2', i: 2, c: 'Default' },
    };
    expect(branchEntry).toEqual(expected);
  });
});
