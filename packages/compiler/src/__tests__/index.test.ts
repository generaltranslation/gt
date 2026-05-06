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

const MISSING_GT_CONFIG_WARNING =
  '[@generaltranslation/compiler] No gtConfig found. Auto JSX injection and parsingFlags features require a gt.config.json. See https://generaltranslation.com/en/docs/react/concepts/compiler.';

const JSX_RUNTIME_CODE = `
  import { jsx, jsxs } from 'react/jsx-runtime';
  export function App() {
    return jsxs("div", { children: ["Hello ", name] });
  }
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

function writeGTConfig(cwd: string, config: unknown): void {
  fs.writeFileSync(
    path.join(cwd, 'gt.config.json'),
    JSON.stringify(config, null, 2)
  );
}

async function transformWithPlugin(
  options: GTUnpluginOptions | undefined,
  cwd: string
): Promise<string | null> {
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  const plugin = (() => {
    try {
      return gtUnplugin.raw(options, { framework: 'vite' });
    } finally {
      cwdSpy.mockRestore();
    }
  })();

  const transform = plugin.transform;
  if (typeof transform !== 'function') {
    throw new Error('Expected transform hook to be a function');
  }

  const context = createTestContext();

  const result: TransformResult = await transform.call(
    context,
    JSX_RUNTIME_CODE,
    path.join(cwd, 'App.tsx')
  );
  if (!result) {
    return null;
  }
  return typeof result === 'string' ? result : result.code;
}

describe('gtUnplugin config loading', () => {
  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('auto-loads gt.config.json from process.cwd() when gtConfig is omitted', async () => {
    const cwd = createTempDir();
    writeGTConfig(cwd, {
      files: {
        gt: {
          parsingFlags: {
            enableAutoJsxInjection: true,
          },
        },
      },
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const output = await transformWithPlugin(undefined, cwd);

      expect(output).toContain('GtInternalTranslateJsx');
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not auto-load gt.config.json when gtConfig is provided', async () => {
    const cwd = createTempDir();
    writeGTConfig(cwd, {
      files: {
        gt: {
          parsingFlags: {
            enableAutoJsxInjection: true,
          },
        },
      },
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const output = await transformWithPlugin(
        {
          gtConfig: {
            files: {
              gt: {
                parsingFlags: {
                  enableAutoJsxInjection: false,
                },
              },
            },
          },
        },
        cwd
      );

      expect(output).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('preserves default behavior when auto-loaded gt.config.json has no parsingFlags', async () => {
    const cwd = createTempDir();
    writeGTConfig(cwd, {
      projectId: 'test-project',
      defaultLocale: 'en',
      locales: ['en', 'es'],
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const output = await transformWithPlugin(undefined, cwd);

      expect(output).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('warns once per plugin instance when gtConfig cannot be loaded', async () => {
    const cwd = createTempDir();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
      const plugin = (() => {
        try {
          return gtUnplugin.raw(undefined, { framework: 'vite' });
        } finally {
          cwdSpy.mockRestore();
        }
      })();
      const transform = plugin.transform;
      if (typeof transform !== 'function') {
        throw new Error('Expected transform hook to be a function');
      }
      const context = createTestContext();

      await transform.call(
        context,
        JSX_RUNTIME_CODE,
        path.join(cwd, 'One.tsx')
      );
      await transform.call(
        context,
        JSX_RUNTIME_CODE,
        path.join(cwd, 'Two.tsx')
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(MISSING_GT_CONFIG_WARNING);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
