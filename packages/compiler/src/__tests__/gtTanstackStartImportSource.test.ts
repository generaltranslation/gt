/**
 * gt-tanstack-start re-exports gt-react's components, hooks, and `t`, so the
 * compiler must treat imports from it exactly like imports from gt-react.
 * These tests run through the real unplugin transform (index.ts) because
 * import tracking gates every pass.
 */
import { describe, expect, it } from 'vitest';
import { transformWithPlugin } from './transformWithPlugin';

describe('gt-tanstack-start import source', () => {
  it('injects _hash into <T> imported from gt-tanstack-start', async () => {
    const output = await transformWithPlugin(
      undefined,
      `
      import { jsx } from 'react/jsx-runtime';
      import { T } from 'gt-tanstack-start';
      export const el = jsx(T, { children: "Hello world" });
    `
    );
    expect(output).not.toBeNull();
    expect(output).toContain('_hash: "');
  });

  it('injects $_hash into useGT() imported from gt-tanstack-start', async () => {
    const output = await transformWithPlugin(
      undefined,
      `
      import { useGT } from 'gt-tanstack-start';
      const gt = useGT();
      gt("Hello world");
    `
    );
    expect(output).not.toBeNull();
    expect(output).toContain('"$_hash": "');
    expect(output).toContain('useGT([');
  });

  it('expands t`...` imported from gt-tanstack-start without injecting a gt-react import', async () => {
    const output = await transformWithPlugin(
      undefined,
      `
      import { t } from 'gt-tanstack-start';
      const message = t\`Hello \${name}\`;
    `
    );
    expect(output).not.toBeNull();
    expect(output).not.toContain('t`');
    expect(output).toContain('$_hash');
    expect(output).not.toContain("from 'gt-react'");
    expect(output).not.toContain('from "gt-react"');
  });

  // No autoJsxImportSource override here: the override alone also accepts
  // the import, so only the default import sources are under test.
  it('does not re-import auto JSX components already imported from gt-tanstack-start', async () => {
    const output = await transformWithPlugin(
      { enableAutoJsxInjection: true },
      `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { GtInternalTranslateJsx, GtInternalVar } from 'gt-tanstack-start';
      export function App() {
        return jsxs("div", { children: ["Hello ", name] });
      }
    `
    );
    expect(output).not.toBeNull();
    expect(output).toMatch(/jsxs?\(GtInternalTranslateJsx/);
    expect(output).toContain('_hash: "');
    expect(output).not.toMatch(/from ["']gt-react["']/);
    expect(output?.match(/from ["']gt-tanstack-start["']/g)).toHaveLength(1);
  });

  it('hashes auto JSX components injected from gt-tanstack-start', async () => {
    const output = await transformWithPlugin(
      {
        enableAutoJsxInjection: true,
        autoJsxImportSource: 'gt-tanstack-start',
      },
      `
      import { jsx, jsxs } from 'react/jsx-runtime';
      export function App() {
        return jsxs("div", { children: ["Hello ", name] });
      }
    `
    );
    expect(output).not.toBeNull();
    expect(output).toMatch(/from ["']gt-tanstack-start["']/);
    expect(output).toMatch(/jsxs?\(GtInternalTranslateJsx/);
    expect(output).toContain('_hash: "');
  });
});
