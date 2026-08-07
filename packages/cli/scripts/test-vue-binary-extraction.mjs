import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, '..');
const requireFromScript = createRequire(import.meta.url);
const binaryNames = {
  'darwin-arm64': 'gt-darwin-arm64',
  'darwin-x64': 'gt-darwin-x64',
  'linux-arm64': 'gt-linux-arm64',
  'linux-x64': 'gt-linux-x64',
  'win32-x64': 'gt-win32-x64.exe',
};
const platformKey = `${process.platform}-${process.arch}`;
const defaultBinaryName = binaryNames[platformKey];
const binaryPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : defaultBinaryName
    ? path.join(packageDirectory, 'binaries', defaultBinaryName)
    : undefined;

if (!binaryPath) {
  throw new Error(`No compiled CLI binary supports ${platformKey}.`);
}
if (!fs.existsSync(binaryPath)) {
  throw new Error(`Compiled CLI binary was not found at ${binaryPath}.`);
}

const fixtureRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'gt-cli-vue-binary-')
);

try {
  writeFixture('package.json', {
    name: 'gt-cli-vue-binary-fixture',
    private: true,
    dependencies: {
      'gt-react': '*',
      'gt-vue': '*',
      vue: '*',
    },
  });
  writeFixture('gt.config.json', {
    defaultLocale: 'en',
    locales: ['fr'],
  });
  writeFixture(
    'src/Ambiguous.vue',
    `'Copyright 2026';
<template><T>Compiled ambiguous legacy message</T></template>;
import { T } from 'gt-react';
`
  );
  writeFixture(
    'src/Leading.vue',
    `<template><T>Compiled leading legacy message</T></template>;
import { T } from 'gt-react';
`
  );
  linkInstalledVue();

  validateLegacyModule('src/Ambiguous.vue');
  validateLegacyModule('src/Leading.vue');
  process.stdout.write(
    `Validated compiled Vue extraction with ${path.basename(binaryPath)}.\n`
  );
} finally {
  fs.rmSync(fixtureRoot, { force: true, recursive: true });
}

/** Writes one JSON or source fixture beneath the temporary project root. */
function writeFixture(relativePath, contents) {
  const filePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    typeof contents === 'string'
      ? contents
      : `${JSON.stringify(contents, null, 2)}\n`
  );
}

/** Makes the workspace Vue compiler resolvable from the isolated fixture. */
function linkInstalledVue() {
  const vueDirectory = path.dirname(
    requireFromScript.resolve('vue/package.json')
  );
  const nodeModules = path.join(fixtureRoot, 'node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.symlinkSync(
    vueDirectory,
    path.join(nodeModules, 'vue'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
}

/** Requires the actual executable to preserve one historical React extraction. */
function validateLegacyModule(relativePath) {
  const result = spawnSync(
    binaryPath,
    [
      '--skip-version-check',
      '--suppress-id-compatibility-warning',
      'validate',
      relativePath,
    ],
    {
      cwd: fixtureRoot,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    }
  );
  if (result.error) throw result.error;

  const output = stripVTControlCharacters(
    `${result.stdout ?? ''}${result.stderr ?? ''}`
  );
  const expected = 'Success! Found 1 translatable entries for gt-react.';
  if (result.status !== 0 || !output.includes(expected)) {
    throw new Error(
      `Compiled CLI failed to extract ${relativePath}.\n` +
        `Exit status: ${result.status ?? 'unknown'}\n${output}`
    );
  }
}
