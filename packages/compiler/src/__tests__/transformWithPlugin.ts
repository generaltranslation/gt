import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { onTestFinished, vi } from 'vitest';
import type {
  TransformResult,
  UnpluginBuildContext,
  UnpluginContext,
  UnpluginContextMeta,
} from 'unplugin';
import gtUnplugin from '../index';
import type { GTUnpluginOptions } from '../index';

function createTestContext(
  addWatchFile: (file: string) => void = () => {}
): UnpluginBuildContext & UnpluginContext {
  return {
    addWatchFile,
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
 * directory removed when the test finishes. `at` sets the bundler the plugin
 * runs in and the module's path inside that directory.
 */
export async function transformWithPlugin(
  options: GTUnpluginOptions | undefined,
  code: string,
  addWatchFile?: (file: string) => void,
  at: { framework?: UnpluginContextMeta['framework']; file?: string } = {}
): Promise<string | null> {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-compiler-'));
  onTestFinished(() => fs.rmSync(cwd, { force: true, recursive: true }));
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  const plugin = (() => {
    try {
      return gtUnplugin.raw(options, {
        framework: at.framework ?? 'vite',
      } as UnpluginContextMeta);
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
    createTestContext(addWatchFile),
    code,
    path.join(cwd, at.file ?? 'App.tsx')
  );
  if (!result) return null;
  return typeof result === 'string' ? result : result.code;
}
