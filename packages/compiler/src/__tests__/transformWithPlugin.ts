import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { onTestFinished, vi } from 'vitest';
import type {
  TransformResult,
  UnpluginBuildContext,
  UnpluginContext,
} from 'unplugin';
import gtUnplugin from '../index';
import type { GTUnpluginOptions } from '../index';

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

/**
 * Runs code through the real unplugin transform, from a temporary project
 * directory removed when the test finishes.
 */
export async function transformWithPlugin(
  options: GTUnpluginOptions | undefined,
  code: string
): Promise<string | null> {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-compiler-'));
  onTestFinished(() => fs.rmSync(cwd, { force: true, recursive: true }));
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
