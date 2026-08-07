import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GT_PARSING_FLAGS_DEFAULT } from '../../config/defaults.js';
import { determineLibrary } from '../../fs/determineFramework/index.js';
import { createInlineUpdates } from '../../react/parse/createInlineUpdates.js';
import { isInlineLibrary, Libraries } from '../../types/libraries.js';
import type { ParsingConfigOptions } from '../../types/parsing.js';
import { detectVueProject } from '@generaltranslation/vue-extractor/detect';
import { logger } from '../../console/logger.js';
import { extractInlineFromProject } from '../extractInline.js';

const originalCwd = process.cwd();
const temporaryDirectories: string[] = [];
const requireFromCli = createRequire(import.meta.url);
const installedVueDirectory = path.dirname(
  requireFromCli.resolve('vue/package.json')
);
const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['development', 'browser', 'module', 'import', 'default'],
};

afterEach(() => {
  process.chdir(originalCwd);
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    removeProjectFixture(directory);
  }
});

describe('project-level Vue CLI regression boundary', () => {
  it('extracts a root Vue project through only the package project API', async () => {
    createVueFixture({
      'package.json': vuePackageJson('root-vue-app'),
      'app.vue': translatableSfc('Root Vue message'),
    });
    const detection = determineLibrary();

    expect(detection).toEqual({ library: 'base', additionalModules: [] });
    expect(detectVueProject()).toBe(true);

    const output = await extractInlineFromProject(
      Libraries.GT_VUE,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(sources(output)).toEqual(['Root Vue message']);
  });

  it('keeps pure React extraction byte-for-byte equivalent to the historical path', async () => {
    createFixture({
      'package.json': packageJson({ dependencies: { 'gt-react': '*' } }),
      'src/App.tsx': reactMessage('Pure React message'),
    });
    const detection = determineLibrary();

    expect(detection).toEqual({
      library: Libraries.GT_REACT,
      additionalModules: [],
    });
    expect(detectVueProject()).toBe(false);

    const historical = await createInlineUpdates(
      Libraries.GT_REACT,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );
    const dispatched = await dispatchDetected(detection.library);

    expect(dispatched).toEqual(historical);
    expect(dispatched.errors).toEqual([]);
    expect(sources(dispatched)).toEqual(['Pure React message']);
  });

  it('keeps a React root primary and appends only its gt-vue-owned workspace', async () => {
    createVueFixture({
      'package.json': packageJson({
        private: true,
        workspaces: ['apps/*'],
        dependencies: { 'gt-react': '*' },
      }),
      'src/App.tsx': reactMessage('Root React message'),
      'src/Unowned.vue': translatableSfc('Unowned root Vue message'),
      'apps/vue/package.json': vuePackageJson('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Owned Vue message'),
      'apps/unowned/package.json': packageJson({ name: 'unowned-app' }),
      'apps/unowned/src/App.vue': translatableSfc(
        'Unowned workspace Vue message'
      ),
    });
    const detection = determineLibrary();

    expect(detection.library).toBe(Libraries.GT_REACT);
    expect(detectVueProject()).toBe(true);

    const output = await dispatchDetected(detection.library);

    expect(output.errors).toEqual([]);
    expect(sources(output).sort()).toEqual([
      'Owned Vue message',
      'Root React message',
    ]);
  });

  it('keeps a file-only root file-only when only a child declares gt-react', () => {
    createFixture({
      'package.json': packageJson({
        private: true,
        workspaces: ['apps/*'],
      }),
      'locales/en.json': JSON.stringify({ title: 'File-only title' }),
      'apps/react/package.json': packageJson({
        name: 'child-react',
        dependencies: { 'gt-react': '*' },
      }),
      'apps/react/src/App.tsx': reactMessage('Child React message'),
    });

    const detection = determineLibrary();

    expect(detection).toEqual({ library: 'base', additionalModules: [] });
    expect(isInlineLibrary(detection.library)).toBe(false);
    expect(detectVueProject()).toBe(false);
  });

  it('does not broaden React defaults to unrelated workspaces when Vue is present', async () => {
    createVueFixture({
      'package.json': packageJson({
        private: true,
        workspaces: ['apps/*'],
        dependencies: { 'gt-react': '*' },
      }),
      'src/App.tsx': reactMessage('Root React only'),
      'apps/react/package.json': packageJson({
        name: 'unrelated-react',
        dependencies: { 'gt-react': '*' },
      }),
      'apps/react/src/App.tsx': reactMessage(
        'Unrelated workspace React message'
      ),
      'apps/vue/package.json': vuePackageJson('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Owned workspace Vue message'),
    });

    const detection = determineLibrary();
    const output = await dispatchDetected(detection.library);

    expect(detection.library).toBe(Libraries.GT_REACT);
    expect(output.errors).toEqual([]);
    expect(sources(output).sort()).toEqual([
      'Owned workspace Vue message',
      'Root React only',
    ]);
  });

  it('retains both root gt-node and owned Vue messages', async () => {
    createVueFixture({
      'package.json': packageJson({
        private: true,
        workspaces: ['apps/*'],
        dependencies: { 'gt-node': '*' },
      }),
      'src/message.ts': `
        import { msg } from 'gt-node';
        export const message = msg('Root Node message');
      `,
      'apps/vue/package.json': vuePackageJson('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Node companion Vue message'),
    });

    const detection = determineLibrary();
    const output = await dispatchDetected(detection.library);

    expect(detection.library).toBe(Libraries.GT_NODE);
    expect(output.errors).toEqual([]);
    expect(sources(output).sort()).toEqual([
      'Node companion Vue message',
      'Root Node message',
    ]);
  });

  it('does not resolve a React root dynamic Vite config during child Vue extraction', async () => {
    createVueFixture({
      'package.json': packageJson({
        private: true,
        workspaces: ['apps/*'],
        dependencies: { 'gt-react': '*', vite: '*' },
      }),
      'vite.config.ts': `
        export default ({ mode }) => ({
          resolve: { alias: mode === 'test' ? { '@app': '/one' } : { '@app': '/two' } },
        });
      `,
      'src/App.tsx': reactMessage('React with dynamic config'),
      'apps/vue/package.json': vuePackageJson('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Scoped Vue config message'),
    });

    const detection = determineLibrary();
    const output = await dispatchDetected(detection.library);

    expect(detection.library).toBe(Libraries.GT_REACT);
    expect(output.errors).toEqual([]);
    expect(sources(output).sort()).toEqual([
      'React with dynamic config',
      'Scoped Vue config message',
    ]);
  });

  it('splits explicit .vue patterns away from the historical parser', async () => {
    createVueFixture({
      'package.json': packageJson({
        dependencies: { 'gt-react': '*', 'gt-vue': '*', vue: '*' },
      }),
      'src/App.tsx': reactMessage('Explicit React message'),
      'src/App.vue': translatableSfc('Explicit Vue message'),
    });
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

    const detection = determineLibrary();
    const output = await dispatchDetected(detection.library, [
      'src/**/*.{tsx,vue}',
    ]);

    expect(detection.library).toBe(Libraries.GT_REACT);
    expect(output.errors).toEqual([]);
    expect(sources(output).sort()).toEqual([
      'Explicit React message',
      'Explicit Vue message',
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

async function dispatchDetected(library: string, filePatterns?: string[]) {
  if (!isInlineLibrary(library)) {
    throw new Error(`Expected an inline library, received ${library}`);
  }
  return extractInlineFromProject(
    library,
    false,
    filePatterns,
    GT_PARSING_FLAGS_DEFAULT,
    parsingOptions
  );
}

function sources(output: Awaited<ReturnType<typeof dispatchDetected>>) {
  return output.updates.map(({ source }) => source);
}

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  process.chdir(root);
  return root;
}

function createProjectFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-cli-vue-project-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
  return root;
}

function linkInstalledVue(root: string): void {
  const nodeModules = path.join(root, 'node_modules');
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.symlinkSync(installedVueDirectory, path.join(nodeModules, 'vue'), 'dir');
}

function removeProjectFixture(root: string): void {
  fs.rmSync(root, { force: true, recursive: true });
}

function translatableSfc(message: string): string {
  return `<script setup lang="ts">
import { T } from 'gt-vue';
</script>
<template><T>${message}</T></template>
`;
}

function createVueFixture(files: Record<string, string>): string {
  const root = createFixture(files);
  linkInstalledVue(root);
  return root;
}

function packageJson(values: Record<string, unknown> = {}): string {
  return JSON.stringify({ name: 'fixture-root', ...values }, null, 2);
}

function vuePackageJson(name: string): string {
  return packageJson({
    name,
    dependencies: { 'gt-vue': '*', vue: '*' },
  });
}

function reactMessage(message: string): string {
  return `
    import { T } from 'gt-react';
    export function App() {
      return <T>${message}</T>;
    }
  `;
}
