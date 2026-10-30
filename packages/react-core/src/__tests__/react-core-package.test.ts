import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const runtimeEntryNames = ['components', 'components-rsc', 'hooks', 'pure'];
// Each public entrypoint is emitted as a thin re-export barrel in both module
// formats, plus a type declaration for each format.
const entryArtifacts = runtimeEntryNames
  .flatMap((entryName) => [
    `${entryName}.cjs`,
    `${entryName}.mjs`,
    `${entryName}.d.ts`,
    `${entryName}.d.mts`,
  ])
  .map((artifact) => join(packageRoot, 'dist', artifact));

function hasBuiltArtifacts(): boolean {
  return (
    existsSync(join(packageRoot, 'dist')) &&
    entryArtifacts.every((artifact) => existsSync(artifact))
  );
}

function buildPackage(): void {
  const command = process.env.npm_execpath ? process.execPath : 'pnpm';
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', 'build']
    : ['run', 'build'];

  execFileSync(command, args, {
    cwd: packageRoot,
    stdio: 'pipe',
  });
}

function node(args: string[]): void {
  execFileSync(process.execPath, args, { cwd: packageRoot, stdio: 'pipe' });
}

function getRuntimeModuleFiles(): string[] {
  return readdirSync(join(packageRoot, 'dist'), { recursive: true })
    .map((entry) => String(entry))
    .filter((file) => /\.(cjs|mjs)$/.test(file) && !file.endsWith('.map'));
}

describe('@generaltranslation/react-core package exports', () => {
  beforeAll(() => {
    if (hasBuiltArtifacts()) return;
    buildPackage();
  });

  it('loads named exports from built CJS entrypoints', () => {
    node([
      '-e',
      `
          const assert = require('node:assert/strict');
          const pure = require('@generaltranslation/react-core/pure');
          const components = require('@generaltranslation/react-core/components');
          const hooks = require('@generaltranslation/react-core/hooks');
          const componentsRsc = require('@generaltranslation/react-core/components-rsc');

          assert.equal(typeof pure.msg, 'function');
          assert.equal(typeof components.T, 'function');
          assert.equal(typeof hooks.useGT, 'function');
          assert.equal(typeof componentsRsc.Branch, 'function');
        `,
    ]);
  });

  it('loads named exports from built ESM entrypoints', () => {
    node([
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { msg } from '@generaltranslation/react-core/pure';
          import { T } from '@generaltranslation/react-core/components';
          import { useGT } from '@generaltranslation/react-core/hooks';
          import { Branch } from '@generaltranslation/react-core/components-rsc';

          assert.equal(typeof msg, 'function');
          assert.equal(typeof T, 'function');
          assert.equal(typeof useGT, 'function');
          assert.equal(typeof Branch, 'function');
        `,
    ]);
  });

  it('emits each entrypoint as a barrel in both module formats', () => {
    const runtimeFiles = getRuntimeModuleFiles();
    for (const entryName of runtimeEntryNames) {
      expect(runtimeFiles).toContain(`${entryName}.cjs`);
      expect(runtimeFiles).toContain(`${entryName}.mjs`);
    }
  });

  it('emits unbundled runtime modules so consumers can tree-shake', () => {
    // The build is intentionally unbundled: entrypoints are thin re-export
    // barrels and the implementation lives in granular sibling modules that
    // can be shared and individually dropped by a downstream bundler. This is
    // the opposite of the previous per-entry bundled artifacts, so the dist
    // tree contains far more runtime modules than there are entrypoints.
    const runtimeFiles = getRuntimeModuleFiles();
    expect(runtimeFiles.length).toBeGreaterThan(runtimeEntryNames.length * 2);
  });
});

describe('@generaltranslation/react-core/internal/experimental', () => {
  const twinExports = [
    'GtInternalRegisterLocaleTwin',
    'GtInternalTranslateJsx',
    'T',
    'internalInitializeGTSRA',
    'markNavigatingReload',
    'msg',
    't',
    'useGT',
    'useMessages',
    'withLocaleTwinReload',
  ];
  const twinOnlyExports = [
    'GtInternalRegisterLocaleTwin',
    'markNavigatingReload',
    'withLocaleTwinReload',
  ];
  const regularEntries = ['pure', 'components', 'hooks', 'components-rsc'];

  beforeAll(() => {
    if (
      existsSync(join(packageRoot, 'dist/experimental/internal.cjs')) &&
      existsSync(join(packageRoot, 'dist/experimental/internal.mjs'))
    ) {
      return;
    }
    buildPackage();
  });

  it.each([
    [
      'cjs',
      `const experimental = require('@generaltranslation/react-core/internal/experimental');`,
    ],
    [
      'esm',
      `const experimental = await import('@generaltranslation/react-core/internal/experimental');`,
    ],
  ])('exports the locale twin React runtime (%s)', (format, load) => {
    node([
      ...(format === 'esm' ? ['--input-type=module'] : []),
      '-e',
      `
        (async () => {
          ${load}
          const missing = ${JSON.stringify(twinExports)}.filter(
            (name) => typeof experimental[name] !== 'function'
          );
          if (missing.length) throw new Error('missing: ' + missing.join(', '));
        })().catch((error) => { console.error(error); process.exit(1); });
      `,
    ]);
  });

  it('keeps locale twins out of the regular entrypoints', () => {
    node([
      '-e',
      `
        for (const entry of ${JSON.stringify(regularEntries)}) {
          const module = require('@generaltranslation/react-core/' + entry);
          const leaked = ${JSON.stringify(twinOnlyExports)}.filter((name) => name in module);
          if (leaked.length) throw new Error(entry + ' leaked: ' + leaked.join(', '));
        }
      `,
    ]);
  });

  it('publishes declarations for both module formats', () => {
    for (const file of [
      'dist/experimental/internal.d.ts',
      'dist/experimental/internal.d.mts',
    ]) {
      expect(existsSync(join(packageRoot, file)), file).toBe(true);
    }
  });
});
