import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function buildPackage(): void {
  const command = process.env.npm_execpath ? process.execPath : 'pnpm';
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', 'build']
    : ['run', 'build'];

  execFileSync(command, args, {
    cwd: packageRoot,
    stdio: 'pipe',
    timeout: 60_000,
  });
}

function readDistFile(file: string): string {
  return readFileSync(join(packageRoot, 'dist', file), 'utf8');
}

function getImportSpecifiers(code: string): string[] {
  return [...code.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map(
    ([, specifier]) => specifier
  );
}

function getNamedReactImports(code: string): string[] {
  return [
    ...code.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*["']react["']/g),
  ].flatMap(([, names]) =>
    names
      .split(',')
      .map((name) => name.trim().split(/\s+as\s+/)[0])
      .filter(Boolean)
  );
}

function node(args: string[]): void {
  execFileSync(process.execPath, args, { cwd: packageRoot, stdio: 'pipe' });
}

// Each test blocks on child processes, so concurrent tests only queue and every
// timeout would also count the time spent waiting for the others.
describe.sequential('gt-tanstack-start package exports', () => {
  beforeAll(() => {
    // Turbo guarantees this package's build task completes before its test
    // task. Standalone package tests rebuild so they cannot use stale output.
    if (process.env.TURBO_HASH) return;
    buildPackage();
  }, 65_000);

  it('publishes ESM-only entrypoints', () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as {
      main: string;
      module: string;
      types: string;
      exports: Record<string, unknown>;
    };

    expect(packageJson.main).toBe('./dist/index.server.mjs');
    expect(packageJson.module).toBe('./dist/index.server.mjs');
    expect(packageJson.types).toBe('./dist/index.server.d.mts');
    expect(JSON.stringify(packageJson.exports)).not.toContain('require');

    expect(
      readdirSync(join(packageRoot, 'dist'))
        .filter((file) => /\.(cjs|mjs)$/.test(file))
        .sort()
    ).toEqual(['index.client.mjs', 'index.server.mjs', 'server.mjs']);
  });

  it('references only declared dependencies from public declarations', () => {
    for (const file of [
      'index.client.d.mts',
      'index.server.d.mts',
      'server.d.mts',
    ]) {
      const declaration = readFileSync(join(packageRoot, 'dist', file), 'utf8');

      expect(declaration).not.toMatch(
        /@tanstack\/(?:start-client-core|start-fn-stubs)/
      );
    }
  });

  it('keeps Node.js builtins out of the browser entrypoint', () => {
    // Browser bundlers cannot resolve Node.js builtins such as
    // node:async_hooks, which backs the server request condition store.
    const builtins = new Set(builtinModules);
    const specifiers = getImportSpecifiers(readDistFile('index.client.mjs'));

    expect(specifiers.length).toBeGreaterThan(0);
    expect(
      specifiers.filter(
        (specifier) => specifier.startsWith('node:') || builtins.has(specifier)
      )
    ).toEqual([]);
  });

  it.each(['index.client.mjs', 'index.server.mjs'])(
    'does not import React 19-only use from %s',
    (file) => {
      // The peer range includes React 18, whose ESM build has no `use` export,
      // so importing it fails at module link time.
      const reactImports = getNamedReactImports(readDistFile(file));

      expect(reactImports.length).toBeGreaterThan(0);
      expect(reactImports).not.toContain('use');
    }
  );

  it('loads isomorphic helpers and middleware from the main ESM entrypoint', () => {
    node([
      '--input-type=module',
      '-e',
      `
        import assert from 'node:assert/strict';
        import { GTProvider, getGT, getLocale, gtMiddleware, parseLocale, setupRouterGTIntegration } from 'gt-tanstack-start';
        import { getGT as legacyGetGT, gtMiddleware as legacyGtMiddleware } from 'gt-tanstack-start/server';

        assert.equal(typeof GTProvider, 'function');
        assert.equal(typeof parseLocale, 'function');
        assert.equal(typeof setupRouterGTIntegration, 'function');
        assert.equal(typeof getGT, 'function');
        assert.equal(typeof getLocale, 'function');
        assert.equal(typeof gtMiddleware, 'object');
        assert.equal(typeof legacyGetGT, 'function');
        assert.equal(typeof legacyGtMiddleware, 'object');
      `,
    ]);
  });

  it('exports the components injected by the compiler from both entrypoints', () => {
    for (const conditions of [[], ['--conditions=browser']]) {
      node([
        ...conditions,
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';
          import { GtInternalTranslateJsx, GtInternalVar } from 'gt-tanstack-start';

          assert.equal(typeof GtInternalTranslateJsx, 'function');
          assert.equal(typeof GtInternalVar, 'function');
        `,
      ]);
    }
  });

  it('loads the Vite plugin and its opt-in GT compiler from the ESM entrypoint', () => {
    node([
      '--input-type=module',
      '-e',
      `
        import assert from 'node:assert/strict';
        import { gtTanstackStart } from 'gt-tanstack-start/plugin/vite';

        assert.deepEqual(
          gtTanstackStart().map((plugin) => plugin.name),
          ['gt-tanstack-start']
        );
        const plugins = gtTanstackStart({
          experimentalCompilerOptions: { type: 'babel', logLevel: 'silent' },
        });
        assert.deepEqual(
          plugins.map((plugin) => plugin.name),
          ['gt-tanstack-start', '@generaltranslation/GT_PLUGIN']
        );
      `,
    ]);
  });

  it('loads isomorphic helpers from the browser ESM entrypoint', () => {
    node([
      '--conditions=browser',
      '--input-type=module',
      '-e',
      `
        import assert from 'node:assert/strict';
        import { getGT, getLocale, gtMiddleware, initializeGT } from 'gt-tanstack-start';

        assert.equal(typeof getGT, 'function');
        assert.equal(typeof getLocale, 'function');
        assert.equal(typeof gtMiddleware, 'object');
        assert.equal(typeof initializeGT, 'function');
      `,
    ]);
  });

  it.each(['workerd', 'worker'])(
    'resolves the server ESM entrypoint when %s and browser conditions are active',
    (workerCondition) => {
      node([
        `--conditions=${workerCondition}`,
        '--conditions=browser',
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';

          assert.equal(
            import.meta.resolve('gt-tanstack-start').endsWith('/dist/index.server.mjs'),
            true
          );
        `,
      ]);
    }
  );
});
