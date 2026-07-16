/**
 * $_hash injection for gt() (the useGT/getGT callback) must skip derive
 * content, and must never corrupt the hashes of sibling gt() calls.
 *
 * Two defects covered here:
 *
 * 1. Counter misalignment: collection skipped gt() calls whose message could
 *    not be statically resolved (explicit derive() in the message, autoderive
 *    dynamic content) WITHOUT reserving a counter slot, while the injection
 *    pass increments the counter for every gt() call. Every gt() call after a
 *    derive call was then injected with the hash of the PREVIOUS call.
 *
 * 2. Empty-hash injection: gt() calls with $context: derive(...) registered
 *    an empty hash which was injected as $_hash: "". The runtime reads $_hash
 *    with ?? so the empty string was used for the lookup and always missed.
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
 * Mirrors the transform() pipeline in index.ts.
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

const staticHash = (message: string) =>
  hashSource({ source: message, dataFormat: 'ICU' });

// --- Tests ---

describe('gt() callback hash injection with derive', () => {
  it('static gt() calls get $_hash injected', () => {
    const code = `
      import { useGT } from 'gt-react';
      const gt = useGT();
      gt("Hello world");
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain(`"$_hash": "${staticHash('Hello world')}"`);
  });

  it('gt() with derive() in the message gets no $_hash', () => {
    const code = `
      import { useGT, derive } from 'gt-react';
      const gt = useGT();
      gt(\`Hello \${derive(getName())}\`);
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toContain('$_hash');
  });

  it('a derive gt() call does not shift hashes onto sibling calls', () => {
    // Before the fix, the derive call consumed no collection slot while the
    // injection pass still advanced its counter, so the derive call was
    // injected with the hash of "Static message" and "Static message" itself
    // got nothing.
    const code = `
      import { useGT, derive } from 'gt-react';
      const gt = useGT();
      gt(\`Hello \${derive(getName())}\`);
      gt("Static message");
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    const hashes = result.code.match(/"\$_hash": "[^"]*"/g) ?? [];
    expect(hashes).toEqual([`"$_hash": "${staticHash('Static message')}"`]);
    // The injected hash must be attached to the static call, not the derive call
    const deriveCall = result.code
      .split('\n')
      .find((l) => l.includes('derive('));
    expect(deriveCall).not.toContain('$_hash');
  });

  it('gt() with $context: derive(...) gets no $_hash (not an empty one)', () => {
    const code = `
      import { useGT, derive } from 'gt-react';
      const gt = useGT();
      gt("Book", { $context: derive(getMeaning()) });
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).not.toContain('$_hash');
  });

  it('autoderive dynamic content gets no $_hash and does not shift siblings', () => {
    const code = `
      import { useGT } from 'gt-react';
      const gt = useGT();
      gt(\`Hello \${name}\`);
      gt("Static message");
    `;
    const result = transform(code, { autoderive: true });
    expect(result.errors).toHaveLength(0);
    const hashes = result.code.match(/"\$_hash": "[^"]*"/g) ?? [];
    expect(hashes).toEqual([`"$_hash": "${staticHash('Static message')}"`]);
    // The injected hash must be attached to the static call, not the dynamic one
    const dynamicCall = result.code
      .split('\n')
      .find((l) => l.includes('${name}'));
    expect(dynamicCall).toBeDefined();
    expect(dynamicCall).not.toContain('$_hash');
  });

  it('derive entries are excluded from the useGT() prefetch array', () => {
    const code = `
      import { useGT, derive } from 'gt-react';
      const gt = useGT();
      gt("Book", { $context: derive(getMeaning()) });
      gt("Static message");
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    // The useGT() hook argument must only carry the static entry
    expect(result.code).toContain('useGT([');
    expect(result.code).toContain('message: "Static message"');
    expect(result.code).not.toContain('message: "Book"');
    expect(result.code).not.toContain('$_hash: ""');
  });

  it('derive-only usage leaves useGT() without arguments', () => {
    const code = `
      import { useGT, derive } from 'gt-react';
      const gt = useGT();
      gt(\`Hello \${derive(getName())}\`);
    `;
    const result = transform(code);
    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('useGT()');
    expect(result.code).not.toContain('$_hash');
  });
});
