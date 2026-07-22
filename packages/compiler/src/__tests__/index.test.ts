import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  TransformResult,
  UnpluginBuildContext,
  UnpluginContext,
} from 'unplugin';
import gtUnplugin, {
  esbuild,
  MISSING_GT_CONFIG_WARNING,
  rollup,
  rspack,
  vite,
  webpack,
} from '../index';
import type { GTUnpluginOptions } from '../index';

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

function writeInvalidGTConfig(cwd: string): string {
  const configPath = path.join(cwd, 'gt.config.json');
  fs.writeFileSync(configPath, '{ invalid json');
  return configPath;
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

  it('accepts a parsed gt.config.json as top-level options', async () => {
    const cwd = createTempDir();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const output = await transformWithPlugin(
        {
          defaultLocale: 'en',
          locales: ['en', 'es'],
          files: {
            gt: {
              output: 'src/_gt/[locale].json',
              parsingFlags: {
                enableAutoJsxInjection: true,
              },
            },
          },
          _versionId: 'test-version',
        },
        cwd
      );

      expect(output).toContain('GtInternalTranslateJsx');
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('merges partial top-level options with the auto-loaded config', async () => {
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
          defaultLocale: 'en',
          files: {
            gt: {
              output: 'src/_gt/[locale].json',
            },
          },
        },
        cwd
      );

      expect(output).toContain('GtInternalTranslateJsx');
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('preserves default behavior when auto-loaded gt.config.json has ordinary project settings', async () => {
    const cwd = createTempDir();
    writeGTConfig(cwd, {
      projectId: 'test-project',
      _versionId: 'test-version',
      defaultLocale: 'en',
      locales: ['en', 'es'],
      files: {
        gt: {
          output: 'src/_gt/[locale].json',
        },
      },
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

  it('preserves default behavior when auto-loaded parsingFlags are explicitly disabled', async () => {
    const cwd = createTempDir();
    writeGTConfig(cwd, {
      locales: ['en', 'es'],
      files: {
        gt: {
          output: 'src/_gt/[locale].json',
          parsingFlags: {
            enableAutoJsxInjection: false,
            autoderive: false,
            devHotReload: false,
          },
        },
      },
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

  it('warns that gt.config.json is invalid when the config file cannot be parsed', async () => {
    const cwd = createTempDir();
    const configPath = writeInvalidGTConfig(cwd);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const output = await transformWithPlugin(undefined, cwd);

      expect(output).toBeNull();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const warning = warnSpy.mock.calls[0]?.[0];
      expect(warning).toContain(
        `[@generaltranslation/compiler] Failed to load gt.config.json at ${configPath}.`
      );
      expect(warning).toContain('valid gt.config.json');
      expect(warning).not.toBe(MISSING_GT_CONFIG_WARNING);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('bundler adapters', () => {
  it('exposes a factory for every supported bundler, including rspack', () => {
    for (const adapter of [webpack, vite, rollup, rspack, esbuild]) {
      expect(typeof adapter).toBe('function');
    }
  });

  it('builds a raw rspack plugin that exposes a transform hook', () => {
    const plugin = gtUnplugin.raw(
      {
        defaultLocale: 'en',
        locales: ['en', 'es'],
        files: {
          gt: {
            output: 'src/_gt/[locale].json',
          },
        },
      },
      { framework: 'rspack' }
    );

    expect(plugin).toBeTypeOf('object');
    expect(typeof plugin.transform).toBe('function');
  });
});
