/**
 * The compileTimeHash plugin option must actually gate hash injection.
 *
 * Previously the flag only participated in the early exit together with
 * disableBuildChecks, while the injection pass ran unconditionally whenever
 * collection found content — so compileTimeHash: false changed nothing.
 * These tests run through the real unplugin transform (index.ts) because
 * that is where the gating lives.
 */
import { describe, expect, it } from 'vitest';
import { transformWithPlugin } from './transformWithPlugin';

const T_COMPONENT_CODE = `
  import { jsx } from 'react/jsx-runtime';
  import { T } from 'gt-react';
  export const el = jsx(T, { children: "Hello world" });
`;

const USEGT_CODE = `
  import { useGT } from 'gt-react';
  const gt = useGT();
  gt("Hello world");
`;

const TAGGED_TEMPLATE_CODE = `
  import { useGT } from 'gt-react';
  const gt = useGT();
  const message = t\`Hello world\`;
`;

describe('compileTimeHash plugin option', () => {
  it('injects _hash into <T> by default', async () => {
    const output = await transformWithPlugin(undefined, T_COMPONENT_CODE);
    expect(output).not.toBeNull();
    expect(output).toContain('_hash: "');
  });

  it('injects $_hash into gt() and prefetch entries into useGT() by default', async () => {
    const output = await transformWithPlugin(undefined, USEGT_CODE);
    expect(output).not.toBeNull();
    expect(output).toContain('"$_hash": "');
    expect(output).toContain('useGT([');
  });

  it('compileTimeHash: false leaves <T> untransformed', async () => {
    const output = await transformWithPlugin(
      { compileTimeHash: false },
      T_COMPONENT_CODE
    );
    // No injection and no other pass modified the AST → transform returns null
    expect(output).toBeNull();
  });

  it('compileTimeHash: false leaves gt()/useGT() untransformed', async () => {
    const output = await transformWithPlugin(
      { compileTimeHash: false },
      USEGT_CODE
    );
    expect(output).toBeNull();
  });

  it('compileTimeHash: false keeps macro expansion but skips $_hash', async () => {
    const output = await transformWithPlugin(
      { compileTimeHash: false },
      TAGGED_TEMPLATE_CODE
    );
    // The t`...` macro still expands to a t() call (separate feature) …
    expect(output).not.toBeNull();
    expect(output).not.toContain('t`');
    // … but no hash is injected anywhere
    expect(output).not.toContain('$_hash');
  });

  it('macro expansion gets $_hash by default', async () => {
    const output = await transformWithPlugin(undefined, TAGGED_TEMPLATE_CODE);
    expect(output).not.toBeNull();
    expect(output).not.toContain('t`');
    expect(output).toContain('$_hash');
  });

  it('disableBuildChecks alone no longer disables hash injection', async () => {
    // With the old default (compileTimeHash: false), disableBuildChecks: true
    // hit the disableBuildChecks && !compileTimeHash early exit and turned the
    // whole plugin into a no-op. Each flag now governs its own feature:
    // disableBuildChecks only disables validation.
    const output = await transformWithPlugin(
      { disableBuildChecks: true },
      T_COMPONENT_CODE
    );
    expect(output).not.toBeNull();
    expect(output).toContain('_hash: "');
  });

  it('disableBuildChecks + compileTimeHash: false is a complete no-op', async () => {
    for (const code of [T_COMPONENT_CODE, USEGT_CODE, TAGGED_TEMPLATE_CODE]) {
      const output = await transformWithPlugin(
        { compileTimeHash: false, disableBuildChecks: true },
        code
      );
      expect(output).toBeNull();
    }
  });
});
