import { describe, expect, it } from 'vitest';
import { getRuntimeImports } from './importGraph';

describe('getRuntimeImports', () => {
  it('reads every runtime import form', () => {
    expect(
      getRuntimeImports(`
        import a from './a';
        import './side-effect';
        export { b } from './b';
        export * from './c';
        import d = require('./d');
        const e = require /* note */ ('./e');
        const f = await import('./f');
      `)
    ).toEqual(['./a', './side-effect', './b', './c', './d', './e', './f']);
  });

  it('skips type-only imports and re-exports', () => {
    expect(
      getRuntimeImports(`
        import type { A } from './a';
        import { type B } from './b';
        export type { C } from './c';
      `)
    ).toEqual([]);
  });

  it('ignores imports in comments and strings', () => {
    expect(
      getRuntimeImports(`
        // require('./compat/x')
        /* import y from './compat/y' */
        const code = \`
import z from './compat/z'\`;
      `)
    ).toEqual([]);
  });
});
