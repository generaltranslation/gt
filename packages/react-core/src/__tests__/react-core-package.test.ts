import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const runtimeEntryNames = [
  'compat',
  'components',
  'components-rsc',
  'hooks',
  'pure',
  'unstable',
];
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
  // npm_execpath may be a JS CLI (corepack pnpm.cjs, runnable via node) or
  // a native binary (mise-installed pnpm on CI, runnable directly).
  const npmExecpath = process.env.npm_execpath;
  const isJsCli = npmExecpath !== undefined && /\.[cm]?js$/.test(npmExecpath);
  const command = isJsCli ? process.execPath : (npmExecpath ?? 'pnpm');
  const args = isJsCli ? [npmExecpath, 'run', 'build'] : ['run', 'build'];

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

  it('loads named exports from built CJS and ESM entrypoints', () => {
    // One Node process loads both formats: require() for CJS, import() for ESM.
    node([
      '-e',
      `
          const assert = require('node:assert/strict');
          const entry = (name) => '@generaltranslation/react-core/' + name;

          (async () => {
            for (const [format, load] of [
              ['cjs', (name) => require(entry(name))],
              ['esm', (name) => import(entry(name))],
            ]) {
              for (const [name, exportName] of [
                ['pure', 't'],
                ['components', 'T'],
                ['hooks', 'useGT'],
                ['components-rsc', 'Branch'],
                ['unstable', 't'],
                ['unstable', 'useGT'],
                ['unstable', 'useMessages'],
              ]) {
                const mod = await load(name);
                assert.equal(typeof mod[exportName], 'function', format + ' ' + name);
              }
              // gt-i18n owns the message helpers; react-core does not re-export them.
              assert.equal('msg' in (await load('unstable')), false, format);
            }
          })().catch((error) => {
            console.error(error);
            process.exit(1);
          });
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
