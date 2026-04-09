/**
 * End-to-end tests: autoderive behavior for user-written <T> with dynamic content.
 *
 * When `autoderive` is enabled, <T> components containing dynamic expressions
 * (bare identifiers like `name`) should NOT produce errors — they should be
 * treated as implicit derive() calls and produce an empty hash.
 *
 * When `autoderive` is disabled (default), the same dynamic content should
 * trigger a "dynamic content in T" error as before.
 */
import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import { jsxInsertionPass } from '../jsxInsertionPass';
import { collectionPass } from '../collectionPass';
import { injectionPass } from '../injectionPass';
import { initializeState } from '../../state/utils/initializeState';

// --- Helpers ---

/**
 * Runs the full pipeline with autoderive enabled.
 * insertion -> collection -> error check -> injection -> codegen.
 */
function fullPipelineAutoderive(code: string): {
  code: string | null;
  errors: string[];
  hasCollectionContent: boolean;
  manifest: Record<string, unknown>;
} {
  const state = initializeState({ autoderive: true }, 'test.tsx');
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

/**
 * Runs the full pipeline with default options (autoderive disabled).
 * insertion -> collection -> error check -> injection -> codegen.
 */
function fullPipelineDefault(code: string): {
  code: string | null;
  errors: string[];
  hasCollectionContent: boolean;
  manifest: Record<string, unknown>;
} {
  const state = initializeState({}, 'test.tsx');
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

describe('Autoderive JSX E2E — <T> with dynamic content', () => {
  it('dynamic content in <T> — no errors with autoderive', () => {
    // SOURCE: <T>Hello {name}</T>
    // COMPILED JSX: jsxs(T, { children: ["Hello ", name] })
    // With autoderive enabled, the bare identifier `name` should be treated
    // as an implicit derive() call — no "dynamic content" error.
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      jsxs(T, { children: ["Hello ", name] });
    `;
    const result = fullPipelineAutoderive(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
    expect(result.hasCollectionContent).toBe(true);
    // Hash must be empty string — dynamic content cannot be statically hashed
    expect(result.manifest).toHaveProperty('');
  });

  it('dynamic content nested in child element — no errors with autoderive', () => {
    // SOURCE: <T>Hello <b>{name}</b></T>
    // COMPILED JSX: jsx(T, { children: jsxs("b", { children: ["Hello ", name] }) })
    // The bare identifier `name` is nested inside a <b> element.
    // With autoderive, it should still be allowed — not just direct children of <T>.
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      jsx(T, { children: jsxs("b", { children: ["Hello ", name] }) });
    `;
    const result = fullPipelineAutoderive(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toBeNull();
    expect(result.hasCollectionContent).toBe(true);
    // Hash must be empty string — nested dynamic content also skips hashing
    expect(result.manifest).toHaveProperty('');
  });

  it('static content in <T> — normal behavior with autoderive', () => {
    // SOURCE: <T>Hello world</T>
    // COMPILED JSX: jsx(T, { children: "Hello world" })
    // Static content should work normally regardless of autoderive setting.
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      jsx(T, { children: "Hello world" });
    `;
    const result = fullPipelineAutoderive(code);
    expect(result.errors).toHaveLength(0);
    expect(result.hasCollectionContent).toBe(true);
    // Hash must be non-empty — static content hashes normally even with autoderive
    const hashes = Object.keys(result.manifest);
    expect(hashes.length).toBeGreaterThan(0);
    expect(hashes.every((h) => h.length > 0)).toBe(true);
  });

  it('dynamic content WITHOUT autoderive — errors (control)', () => {
    // SOURCE: <T>Hello {name}</T>
    // COMPILED JSX: jsxs(T, { children: ["Hello ", name] })
    // Without autoderive, the bare identifier `name` should trigger a
    // "dynamic content in T" error — this is the existing behavior.
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      jsxs(T, { children: ["Hello ", name] });
    `;
    const result = fullPipelineDefault(code);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
