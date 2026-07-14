/**
 * The compileTimeHash plugin option must actually gate hash injection.
 *
 * Previously the flag only participated in the early exit together with
 * disableBuildChecks, while the injection pass ran unconditionally whenever
 * collection found content — so compileTimeHash: false changed nothing.
 * These tests run through the real unplugin transform (index.ts) because
 * that is where the gating lives.
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

const tempDirs: string[] = [];

function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-compiler-'));
  tempDirs.push(tempDir);
  return tempDir;
}

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
  options: GTUnpluginOptions | undefined,
  code: string
): Promise<string | null> {
  const cwd = createTempDir();
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
  if (!result) {
    return null;
  }
  return typeof result === 'string' ? result : result.code;
}

describe('compileTimeHash plugin option', () => {
  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

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
});
