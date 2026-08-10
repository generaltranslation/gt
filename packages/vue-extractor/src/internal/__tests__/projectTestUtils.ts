import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const requireFromVuePackage = createRequire(import.meta.url);
const installedVueDirectory = path.dirname(
  requireFromVuePackage.resolve('vue/package.json')
);

/** Creates a disposable JavaScript project from project-relative file names. */
export function createProjectFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-project-'));
  writeProjectFiles(root, files);
  return root;
}

/** Writes project-relative files, creating their parent directories. */
export function writeProjectFiles(
  root: string,
  files: Record<string, string>
): void {
  for (const [relativePath, contents] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
}

/** Writes a package manifest without repeating JSON formatting in fixtures. */
export function writePackageJson(
  root: string,
  relativeDirectory: string,
  manifest: Record<string, unknown>
): void {
  writeProjectFiles(root, {
    [path.posix.join(relativeDirectory, 'package.json')]: JSON.stringify(
      manifest,
      null,
      2
    ),
  });
}

/**
 * Links the repository's installed Vue package into a fixture.
 *
 * Project extraction deliberately resolves the consumer's exact compiler, so
 * tests use the real installed Vue package instead of injecting a compiler.
 */
export function linkInstalledVue(root: string): void {
  const nodeModules = path.join(root, 'node_modules');
  const destination = path.join(nodeModules, 'vue');
  fs.mkdirSync(nodeModules, { recursive: true });
  if (fs.existsSync(destination)) return;
  fs.symlinkSync(installedVueDirectory, destination, 'dir');
}

/** Removes a disposable fixture without following links outside of it. */
export function removeProjectFixture(root: string): void {
  fs.rmSync(root, { force: true, recursive: true });
}

/** A minimal SFC that proves the imported component comes from gt-vue. */
export function translatableSfc(message: string, component = 'T'): string {
  return `<script setup lang="ts">
import { T${component === 'T' ? '' : ` as ${component}`} } from 'gt-vue';
</script>
<template><${component}>${message}</${component}></template>
`;
}
