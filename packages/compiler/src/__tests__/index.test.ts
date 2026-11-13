import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

// These tests drive the real unplugin transform, because config loading and
// the gating between passes live in index.ts.

const AUTO_JSX_CODE = `
  import { jsx, jsxs } from 'react/jsx-runtime';
  export function App() {
    return jsxs("div", { children: ["Hello ", name] });
  }
`;

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

let tempRoot: string;

beforeAll(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-compiler-'));
});

afterAll(() => {
  fs.rmSync(tempRoot, { force: true, recursive: true });
});

/** Creates a project dir, optionally holding a gt.config.json */
function createProject(gtConfig?: unknown): string {
  const cwd = fs.mkdtempSync(path.join(tempRoot, 'project-'));
  if (gtConfig !== undefined) {
    fs.writeFileSync(
      path.join(cwd, 'gt.config.json'),
      typeof gtConfig === 'string' ? gtConfig : JSON.stringify(gtConfig)
    );
  }
  return cwd;
}

const testContext = {
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

/**
 * Creates the plugin with `cwd` as the working directory and transforms
 * `code` once per file name. Returns each output (null when untransformed)
 * and every console.warn message.
 */
async function runPlugin(
  options: GTUnpluginOptions | undefined,
  code: string,
  { cwd = createProject(), files = ['App.tsx'] } = {}
): Promise<{ outputs: (string | null)[]; warnings: unknown[] }> {
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const { transform } = gtUnplugin.raw(options, { framework: 'vite' });
    if (typeof transform !== 'function') {
      throw new Error('Expected transform hook to be a function');
    }
    const outputs: (string | null)[] = [];
    for (const file of files) {
      const result: TransformResult = await transform.call(
        testContext,
        code,
        path.join(cwd, file)
      );
      outputs.push(
        !result ? null : typeof result === 'string' ? result : result.code
      );
    }
    return {
      outputs,
      warnings: warnSpy.mock.calls.map(([message]) => message),
    };
  } finally {
    cwdSpy.mockRestore();
    warnSpy.mockRestore();
  }
}

const parsingFlags = (flags: Record<string, unknown>) => ({
  files: { gt: { parsingFlags: flags } },
});
const PROJECT_SETTINGS = {
  defaultLocale: 'en',
  locales: ['en', 'es'],
  files: { gt: { output: 'src/_gt/[locale].json' } },
};

describe('gtUnplugin config loading', () => {
  it.each<
    [
      name: string,
      diskConfig: unknown,
      options: GTUnpluginOptions | undefined,
      autoJsxInjected: boolean,
    ]
  >([
    [
      'auto-loads gt.config.json from process.cwd() when gtConfig is omitted',
      parsingFlags({ enableAutoJsxInjection: true }),
      undefined,
      true,
    ],
    [
      'does not auto-load gt.config.json when gtConfig is provided',
      parsingFlags({ enableAutoJsxInjection: true }),
      { gtConfig: parsingFlags({ enableAutoJsxInjection: false }) },
      false,
    ],
    [
      'accepts a parsed gt.config.json as top-level options',
      undefined,
      {
        ...PROJECT_SETTINGS,
        _versionId: 'test-version',
        files: {
          gt: {
            output: 'src/_gt/[locale].json',
            parsingFlags: { enableAutoJsxInjection: true },
          },
        },
      },
      true,
    ],
    [
      'merges partial top-level options with the auto-loaded config',
      parsingFlags({ enableAutoJsxInjection: true }),
      {
        defaultLocale: 'en',
        files: { gt: { output: 'src/_gt/[locale].json' } },
      },
      true,
    ],
    [
      'keeps defaults when the auto-loaded config has only project settings',
      { ...PROJECT_SETTINGS, projectId: 'test-project', _versionId: 'v1' },
      undefined,
      false,
    ],
    [
      'keeps defaults when auto-loaded parsingFlags are explicitly disabled',
      parsingFlags({
        enableAutoJsxInjection: false,
        autoderive: false,
        devHotReload: false,
      }),
      undefined,
      false,
    ],
  ])('%s', async (_name, diskConfig, options, autoJsxInjected) => {
    const { outputs, warnings } = await runPlugin(options, AUTO_JSX_CODE, {
      cwd: createProject(diskConfig),
    });
    if (autoJsxInjected) {
      expect(outputs[0]).toContain('GtInternalTranslateJsx');
    } else {
      expect(outputs[0]).toBeNull();
    }
    expect(warnings).toEqual([]);
  });

  it('warns once per plugin instance when no gt.config.json is found', async () => {
    const { warnings } = await runPlugin(undefined, AUTO_JSX_CODE, {
      files: ['One.tsx', 'Two.tsx'],
    });
    expect(warnings).toEqual([MISSING_GT_CONFIG_WARNING]);
  });

  it('warns that gt.config.json is invalid when it cannot be parsed', async () => {
    const cwd = createProject('{ invalid json');
    const { outputs, warnings } = await runPlugin(undefined, AUTO_JSX_CODE, {
      cwd,
    });
    expect(outputs).toEqual([null]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(
      `[@generaltranslation/compiler] Failed to load gt.config.json at ${path.join(cwd, 'gt.config.json')}.`
    );
    expect(warnings[0]).toContain('valid gt.config.json');
  });
});

/**
 * compileTimeHash must actually gate hash injection, and each flag governs
 * only its own feature: disableBuildChecks disables validation, not hashing,
 * and macro expansion / dev hot reload run independently of both.
 */
describe('pass gating by plugin options', () => {
  const CODE = {
    '<T>': T_COMPONENT_CODE,
    'useGT()': USEGT_CODE,
    't`` macro': TAGGED_TEMPLATE_CODE,
    'auto JSX': AUTO_JSX_CODE,
  };

  it.each<
    [
      code: keyof typeof CODE,
      options: GTUnpluginOptions | undefined,
      expected: { has?: string[]; lacks?: string[] } | null,
    ]
  >([
    // Defaults: hashes injected, useGT() prefetch entries, macros expanded
    ['<T>', undefined, { has: ['_hash: "'] }],
    [
      'useGT()',
      undefined,
      {
        has: ['"$_hash": "', 'useGT(['],
        lacks: ['GtInternalRuntimeTranslateString'],
      },
    ],
    ['t`` macro', undefined, { has: ['$_hash'], lacks: ['t`'] }],
    // compileTimeHash: false -> no injection; untouched files return null
    ['<T>', { compileTimeHash: false }, null],
    ['useGT()', { compileTimeHash: false }, null],
    [
      't`` macro',
      { compileTimeHash: false },
      { has: ['t("Hello world")'], lacks: ['t`', '$_hash'] },
    ],
    ['<T>', { disableBuildChecks: true }, { has: ['_hash: "'] }],
    ['<T>', { compileTimeHash: false, disableBuildChecks: true }, null],
    ['useGT()', { compileTimeHash: false, disableBuildChecks: true }, null],
    [
      't`` macro',
      { compileTimeHash: false, disableBuildChecks: true },
      { has: ['t("Hello world")'], lacks: ['t`', '$_hash'] },
    ],
    [
      'auto JSX',
      {
        compileTimeHash: false,
        disableBuildChecks: true,
        enableAutoJsxInjection: true,
      },
      { has: ['GtInternalTranslateJsx'] },
    ],
    [
      'useGT()',
      { devHotReload: true },
      { has: ['GtInternalRuntimeTranslateString', '"$_hash": "'] },
    ],
  ])('%s with options %j', async (code, options, expected) => {
    const { outputs } = await runPlugin(options, CODE[code]);
    if (expected === null) {
      expect(outputs).toEqual([null]);
      return;
    }
    for (const text of expected.has ?? []) expect(outputs[0]).toContain(text);
    for (const text of expected.lacks ?? []) {
      expect(outputs[0]).not.toContain(text);
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
    const plugin = gtUnplugin.raw(PROJECT_SETTINGS, { framework: 'rspack' });
    expect(typeof plugin.transform).toBe('function');
  });
});
