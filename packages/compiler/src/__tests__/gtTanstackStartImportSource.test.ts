/**
 * gt-tanstack-start re-exports gt-react's components, hooks, and `t`, so the
 * compiler must treat imports from it exactly like imports from gt-react.
 * These tests run through the real unplugin transform (index.ts) because
 * import tracking gates every pass.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  TransformResult,
  UnpluginBuildContext,
  UnpluginContext,
} from 'unplugin';
import gtUnplugin from '../index';
import type { GTUnpluginOptions } from '../index';

const tempDirs: string[] = [];

function createTestContext(): UnpluginBuildContext & UnpluginContext {
  return {
    addWatchFile() {},
    emitFile() {},
    getWatchFiles() {
      return [];
    },
    parse() {
      throw new Error('parse is not implemented in this test context');
    },
    warn() {},
    error(message: unknown) {
      throw new Error(String(message));
    },
  } as UnpluginBuildContext & UnpluginContext;
}

async function transformWithPlugin(
  code: string,
  options: GTUnpluginOptions = {}
): Promise<string | null> {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-compiler-'));
  tempDirs.push(cwd);
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  const plugin = (() => {
    try {
      return gtUnplugin.raw(options, { framework: 'vite' });
    } finally {
      cwdSpy.mockRestore();
      warnSpy.mockRestore();
    }
  })();

  const transform = plugin.transform;
  if (typeof transform !== 'function') {
    throw new Error('Expected transform hook to be a function');
  }

  const result: TransformResult = await transform.call(
    createTestContext(),
    code,
    path.join(cwd, 'App.tsx')
  );
  if (!result) return null;
  return typeof result === 'string' ? result : result.code;
}

describe('gt-tanstack-start import source', () => {
  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('injects _hash into <T> imported from gt-tanstack-start', async () => {
    const output = await transformWithPlugin(`
      import { jsx } from 'react/jsx-runtime';
      import { T } from 'gt-tanstack-start';
      export const el = jsx(T, { children: "Hello world" });
    `);
    expect(output).not.toBeNull();
    expect(output).toContain('_hash: "');
  });

  it('injects $_hash into useGT() imported from gt-tanstack-start', async () => {
    const output = await transformWithPlugin(`
      import { useGT } from 'gt-tanstack-start';
      const gt = useGT();
      gt("Hello world");
    `);
    expect(output).not.toBeNull();
    expect(output).toContain('"$_hash": "');
    expect(output).toContain('useGT([');
  });

  it('expands t`...` imported from gt-tanstack-start without injecting a gt-react import', async () => {
    const output = await transformWithPlugin(`
      import { t } from 'gt-tanstack-start';
      const message = t\`Hello \${name}\`;
    `);
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
      `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { GtInternalTranslateJsx, GtInternalVar } from 'gt-tanstack-start';
      export function App() {
        return jsxs("div", { children: ["Hello ", name] });
      }
    `,
      { enableAutoJsxInjection: true }
    );
    expect(output).not.toBeNull();
    expect(output).toMatch(/jsxs?\(GtInternalTranslateJsx/);
    expect(output).toContain('_hash: "');
    expect(output).not.toMatch(/from ["']gt-react["']/);
    expect(output?.match(/from ["']gt-tanstack-start["']/g)).toHaveLength(1);
  });

  it('hashes auto JSX components injected from gt-tanstack-start', async () => {
    const output = await transformWithPlugin(
      `
      import { jsx, jsxs } from 'react/jsx-runtime';
      export function App() {
        return jsxs("div", { children: ["Hello ", name] });
      }
    `,
      {
        enableAutoJsxInjection: true,
        autoJsxImportSource: 'gt-tanstack-start',
      }
    );
    expect(output).not.toBeNull();
    expect(output).toMatch(/from ["']gt-tanstack-start["']/);
    expect(output).toMatch(/jsxs?\(GtInternalTranslateJsx/);
    expect(output).toContain('_hash: "');
  });
});
