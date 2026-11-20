import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import generate from '@babel/generator';
import * as parser from '@babel/parser';
import { build } from 'esbuild';
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
import { locate, trace } from './sourcePositions';

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
  const t = useGT();
  t\`Hello world\`;
`;

const UNBOUND_TAG_CODE = `
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
        devHotReload: { jsx: false },
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
      `@generaltranslation/compiler Warning: ${path.join(cwd, 'gt.config.json')} could not be read as JSON`
    );
  });

  it('warns with the invalid keys when gt.config.json does not match the schema', async () => {
    const cwd = createProject(parsingFlags({ enableAutoJsxInjection: 'yes' }));
    const { warnings } = await runPlugin(undefined, AUTO_JSX_CODE, { cwd });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(
      `@generaltranslation/compiler Warning: ${path.join(cwd, 'gt.config.json')} is invalid`
    );
    expect(warnings[0]).toContain(
      'files.gt.parsingFlags.enableAutoJsxInjection: Invalid type'
    );
  });
});

/**
 * compileTimeHash must actually gate hash injection, and each flag governs
 * only its own feature: disableBuildChecks disables validation, not hashing,
 * and dev hot reload runs independently of both.
 */
describe('pass gating by plugin options', () => {
  const CODE = {
    '<T>': T_COMPONENT_CODE,
    'useGT()': USEGT_CODE,
    'unbound t``': UNBOUND_TAG_CODE,
  };

  it.each<
    [
      code: keyof typeof CODE,
      options: GTUnpluginOptions | undefined,
      expected: { has?: string[]; lacks?: string[] } | null,
    ]
  >([
    // Defaults: hashes injected, and the tag stays a tagged template
    ['<T>', undefined, { has: ['_hash: "'] }],
    ['useGT()', undefined, { has: ['t({ $_hash: "', '`Hello world`'] }],
    // A t without an import is not a GT tag: no rewrite, no injected import
    ['unbound t``', undefined, null],
    // compileTimeHash: false -> no injection; untouched files return null
    ['<T>', { compileTimeHash: false }, null],
    ['useGT()', { compileTimeHash: false }, null],
    ['<T>', { disableBuildChecks: true }, { has: ['_hash: "'] }],
    ['<T>', { compileTimeHash: false, disableBuildChecks: true }, null],
    ['useGT()', { compileTimeHash: false, disableBuildChecks: true }, null],
    [
      '<T>',
      { devHotReload: { jsx: false } },
      { has: ['_hash: "'], lacks: ['GtInternalRuntimeTranslate'] },
    ],
    [
      '<T>',
      { devHotReload: { jsx: true } },
      { has: ['GtInternalRuntimeTranslateJsx', '_hash: "'] },
    ],
    [
      'useGT()',
      { devHotReload: { jsx: true } },
      { has: ['t({ $_hash: "'], lacks: ['GtInternalRuntimeTranslate'] },
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

describe('source map of the transform', () => {
  // A <T>, a t template and a plain call on one line: the compiler writes a
  // hash into each of the first two, which moves the third
  const CODE = [
    "import { jsx } from 'react/jsx-runtime';",
    "import { T, useGT } from 'gt-react';",
    'export function App() {',
    '  const t = useGT();',
    '  return [jsx(T, { children: "Hello" }), t`Save`, report(1)];',
    '}',
  ].join('\n');

  type Framework = 'vite' | 'rollup' | 'esbuild' | 'webpack' | 'rspack';

  /**
   * Transforms `code` as the bundler would call the plugin: `native` is what
   * unplugin's getNativeBuildContext() returns there, `viteConfig` the config
   * Vite resolved, and `environment` what Vite 6 and later give the
   * transform as `this.environment`.
   */
  async function transformFor(
    framework: Framework,
    {
      code = CODE,
      native,
      viteConfig,
      environment,
    }: {
      code?: string;
      native?: object;
      viteConfig?: object;
      environment?: object;
    } = {}
  ) {
    const cwd = createProject();
    const file = path.join(cwd, 'App.tsx');
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const plugin = gtUnplugin.raw({ precomputeMessages: false }, {
        framework,
      } as Parameters<typeof gtUnplugin.raw>[1]);
      if (typeof plugin.transform !== 'function') {
        throw new Error('Expected transform hook to be a function');
      }
      const { configResolved } = plugin.vite ?? {};
      if (viteConfig && typeof configResolved === 'function') {
        await configResolved.call({} as never, viteConfig as never);
      }
      const result: TransformResult = await plugin.transform.call(
        {
          ...testContext,
          getNativeBuildContext: () => native as never,
          ...(environment && { environment }),
        },
        code,
        file
      );
      if (!result || typeof result === 'string') {
        throw new Error('Expected the transform to return code and a map');
      }
      expect(result.code).toContain('t({ $_hash: "');
      expect(result.code).toContain(', _hash: "');
      return { ...result, file };
    } finally {
      cwdSpy.mockRestore();
      warnSpy.mockRestore();
    }
  }

  it.each(['jsx(T', 't(', 'report', 'App'])(
    'maps %s back to its line and column',
    async (token) => {
      const { code, map, file } = await transformFor('rollup');
      const written = locate(code, token);
      const original = locate(CODE, token === 't(' ? 't`' : token);
      // The rewrites of this line move what follows them
      if (token === 'report') {
        expect(written.column).toBeGreaterThan(original.column);
      }
      expect(trace(map, code, token)).toEqual({ source: file, ...original });
    }
  );

  it.each<
    [
      name: string,
      framework: Framework,
      context: { native?: object; viteConfig?: object; environment?: object },
      mapped: boolean,
    ]
  >([
    [
      'a Vite build with source maps',
      'vite',
      { viteConfig: { command: 'build', build: { sourcemap: 'hidden' } } },
      true,
    ],
    [
      'a Vite dev server',
      'vite',
      { viteConfig: { command: 'serve', build: { sourcemap: false } } },
      true,
    ],
    [
      'a Vite build without source maps',
      'vite',
      { viteConfig: { command: 'build', build: { sourcemap: false } } },
      false,
    ],
    // Vite 6 and later: the environments of a build can differ
    [
      'a Vite build whose environment asks for source maps',
      'vite',
      {
        viteConfig: { command: 'build', build: { sourcemap: false } },
        environment: {
          config: { command: 'build', build: { sourcemap: true } },
        },
      },
      true,
    ],
    [
      'a Vite build whose environment asks for no source map',
      'vite',
      {
        viteConfig: { command: 'build', build: { sourcemap: true } },
        environment: {
          config: { command: 'build', build: { sourcemap: false } },
        },
      },
      false,
    ],
    // Vite writes a map for an output that asks for one
    [
      'a Vite build whose output asks for source maps',
      'vite',
      {
        viteConfig: {
          command: 'build',
          build: {
            sourcemap: false,
            rollupOptions: { output: { sourcemap: true } },
          },
        },
      },
      true,
    ],
    [
      'a Vite build with an output of several that asks for source maps',
      'vite',
      {
        viteConfig: {
          command: 'build',
          build: {
            sourcemap: false,
            rollupOptions: { output: [{}, { sourcemap: 'hidden' }] },
          },
        },
      },
      true,
    ],
    [
      'a Vite build whose outputs ask for no source map',
      'vite',
      {
        viteConfig: {
          command: 'build',
          build: {
            sourcemap: false,
            rollupOptions: { output: [{}, { sourcemap: false }] },
          },
        },
      },
      false,
    ],
    [
      'an esbuild build with source maps',
      'esbuild',
      {
        native: {
          framework: 'esbuild',
          build: { initialOptions: { sourcemap: true } },
        },
      },
      true,
    ],
    [
      'an esbuild build without source maps',
      'esbuild',
      { native: { framework: 'esbuild', build: { initialOptions: {} } } },
      false,
    ],
    // unplugin could only drop the map, or put it in place of an earlier loader's
    [
      'a webpack loader that received no map',
      'webpack',
      { native: { framework: 'webpack' } },
      false,
    ],
    [
      'an Rspack loader that received no map',
      'rspack',
      { native: { framework: 'rspack' } },
      false,
    ],
  ])('writes a map only where one is read: %s', async (...row) => {
    const [, framework, context, mapped] = row;
    const { code, map, file } = await transformFor(framework, context);
    if (!mapped) {
      expect(map).toBeNull();
      return;
    }
    expect(trace(map, code, 'report')).toEqual({
      source: file,
      ...locate(CODE, 'report'),
    });
  });

  it.each(['webpack', 'rspack'] as const)(
    'traces its map through the map a %s loader received',
    async (framework) => {
      // What an earlier loader made of a source with other lines and columns
      const source = CODE.replace('export', '\n\nexport').replace(
        'report',
        '    report'
      );
      const earlier = generate(
        parser.parse(source, { sourceType: 'module' }),
        { sourceMaps: true, sourceFileName: '/app/src/App.tsx' },
        source
      );
      expect(locate(earlier.code, 'report')).not.toEqual(
        locate(source, 'report')
      );
      const { code, map } = await transformFor(framework, {
        code: earlier.code,
        native: { framework, inputSourceMap: earlier.map },
      });
      expect(trace(map, code, 'report')).toEqual({
        source: '/app/src/App.tsx',
        ...locate(source, 'report'),
      });
      expect((map as { sourcesContent: string[] }).sourcesContent).toEqual([
        source,
      ]);
    }
  );

  // esbuild reads the map a file names, and once the transform returns one,
  // only that: unplugin appends it to the file as another comment
  it.each<
    [
      name: string,
      input: { sources: string[]; sourceRoot?: string; inline?: boolean },
      source: string,
    ]
  >([
    // An inline map is in the file, so its sources are relative to the file
    ['inline', { sources: ['../src/App.tsx'], inline: true }, '../src/App.tsx'],
    ['in a file', { sources: ['../../src/App.tsx'] }, '../src/App.tsx'],
    [
      'in a file, under a root that is a path',
      { sources: ['App.tsx'], sourceRoot: '../../src' },
      '../src/App.tsx',
    ],
    [
      'in a file, under a root that is a URL',
      { sources: ['App.tsx'], sourceRoot: 'https://example.com/src/' },
      'https://example.com/src/App.tsx',
    ],
    [
      'inline, under a root that is a URL',
      {
        sources: ['App.tsx'],
        sourceRoot: 'https://example.com/src/',
        inline: true,
      },
      'https://example.com/src/App.tsx',
    ],
    [
      'in a file, under a root with a scheme of a bundler',
      { sources: ['App.tsx'], sourceRoot: 'webpack:///src/' },
      'webpack:///src/App.tsx',
    ],
    [
      'inline, under a root with a scheme of a bundler',
      { sources: ['App.tsx'], sourceRoot: 'webpack:///src/', inline: true },
      'webpack:///src/App.tsx',
    ],
    [
      'inline, with a source that is a URL',
      { sources: ['webpack://app/src/App.tsx'], inline: true },
      'webpack://app/src/App.tsx',
    ],
  ])(
    'traces its map through the map an esbuild input names %s',
    async (_name, { inline, ...input }, expected) => {
      const cwd = createProject();
      const source = CODE.replace('export', '\n\nexport').replace(
        'report',
        '    report'
      );
      const earlier = generate(
        parser.parse(source, { sourceType: 'module' }),
        { sourceMaps: true, sourceFileName: 'App.tsx' },
        source
      );
      fs.mkdirSync(path.join(cwd, 'lib/maps'), { recursive: true });
      const map = JSON.stringify({ ...earlier.map, ...input });
      fs.writeFileSync(path.join(cwd, 'lib/maps/compiled.js.map'), map);
      const url = inline
        ? `data:application/json;base64,${btoa(map)}`
        : 'maps/compiled.js.map';
      fs.writeFileSync(
        path.join(cwd, 'lib/compiled.js'),
        `${earlier.code}\n//# sourceMappingURL=${url}\n`
      );
      const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { outputFiles } = await build({
          absWorkingDir: cwd,
          entryPoints: ['lib/compiled.js'],
          outdir: 'dist',
          bundle: true,
          format: 'esm',
          sourcemap: 'external',
          write: false,
          external: ['gt-react', 'react/jsx-runtime'],
          plugins: [esbuild({ precomputeMessages: false })],
          logLevel: 'silent',
        });
        const [bundled, code] = outputFiles.map((file) => file.text);
        expect(code).toContain('t({ $_hash: "');
        expect(trace(bundled, code, 'report')).toEqual({
          source: expected,
          ...locate(source, 'report'),
        });
        expect(JSON.parse(bundled).sourcesContent).toEqual([source]);
      } finally {
        cwdSpy.mockRestore();
        warnSpy.mockRestore();
      }
    }
  );
});

/**
 * A JSX transform given an import source other than React's imports the same
 * calls from that source's runtimes, which the compiler does not read.
 */
describe("JSX compiled against a runtime other than React's", () => {
  const SOURCE = '@emotion/react';
  const compiledAgainst = (source: string, code: string) =>
    code.replaceAll('react/jsx-', `${source}/jsx-`);
  const warningOf = (source: string, file: string) =>
    `@generaltranslation/compiler Warning: The compiler skipped the JSX in ${file} because it is compiled against "${source}", and the compiler reads only JSX compiled against React's runtime; this is said once per build, for the first file compiled against that source. The build continues, and the JSX of such files gets no automatic <T>, no build-time hash and no usage checks. Compile the app's JSX against React's runtime, so that its files import react/jsx-runtime and react/jsx-dev-runtime, for example by resolving those two modules to the other runtime in the bundler.`;

  const PRODUCTION_CODE = `
    import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
    import { T } from 'gt-react';
    export function App({ name }) {
      return _jsxs("main", { children: [
        _jsxs("p", { children: ["Signed in as ", name] }),
        _jsx(T, { children: _jsx("p", { children: "Saved" }) })
      ] });
    }
  `;
  const DEVELOPMENT_CODE = `
    import { jsxDEV as _jsxDEV } from "react/jsx-dev-runtime";
    export const el = _jsxDEV("p", { children: ["Signed in as ", name] }, void 0, true);
  `;

  it.each<[name: string, options: GTUnpluginOptions, code: string]>([
    [
      'a file that imports a General Translation component',
      {},
      PRODUCTION_CODE,
    ],
    [
      'any file of a build with automatic <T>',
      { enableAutoJsxInjection: true },
      DEVELOPMENT_CODE,
    ],
  ])(
    'warns once per build of the source of %s, and leaves the files as they are',
    async (_name, options, code) => {
      const cwd = createProject();
      const { outputs, warnings } = await runPlugin(
        { ...PROJECT_SETTINGS, ...options },
        compiledAgainst(SOURCE, code),
        { cwd, files: ['One.tsx', 'Two.tsx'] }
      );
      expect(outputs).toEqual([null, null]);
      expect(warnings).toEqual([warningOf(SOURCE, path.join(cwd, 'One.tsx'))]);
    }
  );

  it.each<
    [
      name: string,
      options: GTUnpluginOptions,
      code: string,
      transformed: boolean,
    ]
  >([
    ["React's production runtime", {}, PRODUCTION_CODE, true],
    [
      "React's development runtime",
      { enableAutoJsxInjection: true },
      DEVELOPMENT_CODE,
      true,
    ],
    ['a file with no JSX', { precomputeMessages: false }, USEGT_CODE, true],
    [
      'a file the compiler has no work in',
      {},
      compiledAgainst(SOURCE, DEVELOPMENT_CODE),
      false,
    ],
    [
      'a build whose log level is error',
      { logLevel: 'error' },
      compiledAgainst(SOURCE, PRODUCTION_CODE),
      false,
    ],
  ])('does not warn of %s', async (_name, options, code, transformed) => {
    const { outputs, warnings } = await runPlugin(
      { ...PROJECT_SETTINGS, ...options },
      code
    );
    expect(outputs[0] !== null).toBe(transformed);
    expect(warnings).toEqual([]);
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
