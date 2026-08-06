import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { determineLibrary } from '../../fs/determineFramework/index.js';
import { isInlineLibrary, Libraries } from '../../types/libraries.js';
import { createInlineUpdatesForLibraries } from '../createInlineUpdatesForLibrary.js';
import { linkTestVueInstallation } from '../../vue/parse/__tests__/testVueInstallation.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('workspace inline source discovery', () => {
  it('preserves root-only implicit defaults for pure React workspaces', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-react-workspace-defaults-')
    );
    temporaryDirectories.push(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      private: true,
      workspaces: ['apps/*'],
      dependencies: { 'gt-react': '0.0.0' },
    });

    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'src', 'Root.tsx'),
      `import { T } from 'gt-react'; export const Root = () => <T>Root message</T>;`
    );

    const workspaceDirectory = path.join(projectRoot, 'apps', 'web');
    fs.mkdirSync(path.join(workspaceDirectory, 'src'), { recursive: true });
    writeJson(path.join(workspaceDirectory, 'package.json'), {
      dependencies: { 'gt-react': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(workspaceDirectory, 'src', 'App.tsx'),
      `import { T } from 'gt-react'; export const App = () => <T>Workspace message</T>;`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const detected = determineLibrary();
    const output = await createInlineUpdatesForLibraries(
      [detected.library, ...detected.additionalModules].filter(isInlineLibrary),
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.updates.map((update) => update.source)).toEqual([
      'Root message',
    ]);
  });

  it('extracts a React-family workspace when the root is only an aggregator', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-tanstack-workspace-aggregator-')
    );
    temporaryDirectories.push(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      private: true,
      workspaces: ['apps/*'],
    });

    const workspaceDirectory = path.join(projectRoot, 'apps', 'web');
    fs.mkdirSync(path.join(workspaceDirectory, 'src'), { recursive: true });
    writeJson(path.join(workspaceDirectory, 'package.json'), {
      dependencies: { 'gt-tanstack-start': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(workspaceDirectory, 'src', 'App.tsx'),
      `import { T } from 'gt-tanstack-start'; export const App = () => <T>TanStack workspace message</T>;`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const detected = determineLibrary();
    expect(detected.library).toBe(Libraries.GT_TANSTACK_START);

    const output = await createInlineUpdatesForLibraries(
      [detected.library, ...detected.additionalModules].filter(isInlineLibrary),
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(output.updates.map((update) => update.source)).toEqual([
      'TanStack workspace message',
    ]);
  });

  it('extracts every React-family runtime from a workspace-only aggregator', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-multi-react-workspace-aggregator-')
    );
    temporaryDirectories.push(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      private: true,
      workspaces: ['apps/*'],
    });

    const nextDirectory = path.join(projectRoot, 'apps', 'next');
    fs.mkdirSync(path.join(nextDirectory, 'src'), { recursive: true });
    writeJson(path.join(nextDirectory, 'package.json'), {
      dependencies: { 'gt-next': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(nextDirectory, 'src', 'App.tsx'),
      `import { T } from 'gt-next'; export const App = () => <T>Next workspace message</T>;`
    );

    const tanstackDirectory = path.join(projectRoot, 'apps', 'tanstack');
    fs.mkdirSync(path.join(tanstackDirectory, 'src'), { recursive: true });
    writeJson(path.join(tanstackDirectory, 'package.json'), {
      dependencies: { 'gt-tanstack-start': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(tanstackDirectory, 'src', 'App.tsx'),
      `import { T } from 'gt-tanstack-start'; export const App = () => <T>TanStack workspace message</T>;`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const detected = determineLibrary();
    expect(detected).toEqual({
      library: Libraries.GT_NEXT,
      additionalModules: [Libraries.GT_TANSTACK_START],
    });

    const output = await createInlineUpdatesForLibraries(
      [detected.library, ...detected.additionalModules].filter(isInlineLibrary),
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'Next workspace message',
      'TanStack workspace message',
    ]);
  });

  it('preserves root React-family extraction when a workspace declares Next.js', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-root-tanstack-workspace-next-')
    );
    temporaryDirectories.push(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      private: true,
      workspaces: ['apps/*'],
      dependencies: {
        'gt-react': '0.0.0',
        'gt-tanstack-start': '0.0.0',
      },
    });

    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'src', 'ReactMessage.tsx'),
      `import { T } from 'gt-react'; export const ReactMessage = () => <T>React root</T>;`
    );
    fs.writeFileSync(
      path.join(projectRoot, 'src', 'TanStackMessage.tsx'),
      `import { T } from 'gt-tanstack-start'; export const TanStackMessage = () => <T>TanStack root</T>;`
    );

    const nextWorkspace = path.join(projectRoot, 'apps', 'next');
    fs.mkdirSync(nextWorkspace, { recursive: true });
    writeJson(path.join(nextWorkspace, 'package.json'), {
      dependencies: { 'gt-next': '0.0.0' },
    });
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const detected = determineLibrary();
    expect(detected.library).toBe(Libraries.GT_TANSTACK_START);

    const output = await createInlineUpdatesForLibraries(
      [detected.library, ...detected.additionalModules].filter(isInlineLibrary),
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'React root',
      'TanStack root',
    ]);
  });

  it('preserves TanStack extraction when Next.js is only a root peer dependency', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-root-tanstack-peer-next-')
    );
    temporaryDirectories.push(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      dependencies: { 'gt-tanstack-start': '0.0.0' },
      peerDependencies: { 'gt-next': '0.0.0' },
    });

    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'src', 'App.tsx'),
      `import { T } from 'gt-tanstack-start'; export const App = () => <T>TanStack peer-safe message</T>;`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const detected = determineLibrary();
    expect(detected.library).toBe(Libraries.GT_TANSTACK_START);

    const output = await createInlineUpdatesForLibraries(
      [detected.library, ...detected.additionalModules].filter(isInlineLibrary),
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(output.updates.map((update) => update.source)).toEqual([
      'TanStack peer-safe message',
    ]);
  });

  it('keeps React JSX and string extraction clean when Vue is also detected', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-mixed-react-vue-js-')
    );
    temporaryDirectories.push(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      dependencies: {
        'gt-react': '0.0.0',
        'gt-vue': '0.0.0',
      },
    });

    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'src', 'App.js'),
      `import { T, msg, useGT, useMessages } from 'gt-react';
const gt = useGT();
const m = useMessages();
gt('React string');
m(msg('React message'));
export const App = () => <T>React rich text</T>;`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const detected = determineLibrary();
    expect(detected).toEqual({
      library: Libraries.GT_REACT,
      additionalModules: [Libraries.GT_VUE],
    });

    const output = await createInlineUpdatesForLibraries(
      [detected.library, ...detected.additionalModules].filter(isInlineLibrary),
      true,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'React message',
      'React rich text',
      'React string',
    ]);
  });

  it('extracts every framework selected from declared workspace packages', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-mixed-workspace-')
    );
    temporaryDirectories.push(projectRoot);
    linkTestVueInstallation(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      private: true,
      workspaces: ['apps/*'],
    });

    const reactDirectory = path.join(projectRoot, 'apps', 'react');
    fs.mkdirSync(path.join(reactDirectory, 'src'), { recursive: true });
    writeJson(path.join(reactDirectory, 'package.json'), {
      dependencies: { 'gt-react': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(reactDirectory, 'src', 'App.tsx'),
      `import { T } from 'gt-react';
export function App() {
  return <T>React workspace</T>;
}`
    );

    const vueDirectory = path.join(projectRoot, 'apps', 'vue');
    fs.mkdirSync(path.join(vueDirectory, 'src'), { recursive: true });
    writeJson(path.join(vueDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(vueDirectory, 'src', 'App.vue'),
      `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
gt('Vue workspace');
</script>`
    );

    const nodeDirectory = path.join(projectRoot, 'apps', 'server');
    fs.mkdirSync(path.join(nodeDirectory, 'src'), { recursive: true });
    writeJson(path.join(nodeDirectory, 'package.json'), {
      dependencies: { 'gt-node': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(nodeDirectory, 'src', 'server.ts'),
      `import { msg } from 'gt-node'; export const message = msg('Node workspace');`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const detected = determineLibrary();
    expect(detected).toEqual({
      library: Libraries.GT_REACT,
      additionalModules: [Libraries.GT_NODE, Libraries.GT_VUE],
    });

    const output = await createInlineUpdatesForLibraries(
      [detected.library, ...detected.additionalModules].filter(isInlineLibrary),
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'Node workspace',
      'React workspace',
      'Vue workspace',
    ]);
  });

  it('does not expand root React defaults when a Vue workspace is present', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-root-react-child-react-vue-')
    );
    temporaryDirectories.push(projectRoot);
    linkTestVueInstallation(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      private: true,
      workspaces: ['apps/*'],
      dependencies: { 'gt-react': '0.0.0' },
    });

    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'src', 'Root.tsx'),
      `import { T } from 'gt-react'; export const Root = () => <T>Root React message</T>;`
    );

    const reactDirectory = path.join(projectRoot, 'apps', 'react');
    fs.mkdirSync(path.join(reactDirectory, 'src'), { recursive: true });
    writeJson(path.join(reactDirectory, 'package.json'), {
      dependencies: { 'gt-react': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(reactDirectory, 'src', 'App.tsx'),
      `import { T } from 'gt-react'; export const App = () => <T>Child React message</T>;`
    );

    const vueDirectory = path.join(projectRoot, 'apps', 'vue');
    fs.mkdirSync(path.join(vueDirectory, 'src'), { recursive: true });
    writeJson(path.join(vueDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(vueDirectory, 'src', 'App.vue'),
      `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
gt('Vue child message');
</script>`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const detected = determineLibrary();
    expect(detected).toEqual({
      library: Libraries.GT_REACT,
      additionalModules: [Libraries.GT_VUE],
    });

    const output = await createInlineUpdatesForLibraries(
      [detected.library, ...detected.additionalModules].filter(isInlineLibrary),
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'Root React message',
      'Vue child message',
    ]);
  });

  it('preserves gt-node extraction in mixed Vue workspaces', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-vue-node-workspace-')
    );
    temporaryDirectories.push(projectRoot);
    linkTestVueInstallation(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      private: true,
      workspaces: ['apps/*'],
    });

    const vueDirectory = path.join(projectRoot, 'apps', 'vue');
    fs.mkdirSync(path.join(vueDirectory, 'src'), { recursive: true });
    writeJson(path.join(vueDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(vueDirectory, 'src', 'App.vue'),
      `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
gt('Vue workspace');
</script>`
    );

    const nodeDirectory = path.join(projectRoot, 'apps', 'server');
    fs.mkdirSync(path.join(nodeDirectory, 'src'), { recursive: true });
    writeJson(path.join(nodeDirectory, 'package.json'), {
      dependencies: { 'gt-node': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(nodeDirectory, 'src', 'server.ts'),
      `import { msg } from 'gt-node'; export const message = msg('Node workspace');`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const detected = determineLibrary();
    expect(detected).toEqual({
      library: Libraries.GT_VUE,
      additionalModules: [Libraries.GT_NODE],
    });

    const output = await createInlineUpdatesForLibraries(
      [detected.library, ...detected.additionalModules].filter(isInlineLibrary),
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'Node workspace',
      'Vue workspace',
    ]);
  });

  it('does not return a partial catalog for a Vue workspace using a local barrel', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-vue-barrel-workspace-')
    );
    temporaryDirectories.push(projectRoot);
    linkTestVueInstallation(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      private: true,
      workspaces: ['apps/*', 'packages/*'],
    });

    const barrelDirectory = path.join(projectRoot, 'packages', 'i18n');
    fs.mkdirSync(path.join(barrelDirectory, 'src'), { recursive: true });
    writeJson(path.join(barrelDirectory, 'package.json'), {
      name: '@fixture/vue-i18n',
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(barrelDirectory, 'src', 'index.ts'),
      `import { msg } from 'gt-vue';
export { T, useGT } from 'gt-vue';
export const barrelMessage = msg('Barrel marker');`
    );

    const appDirectory = path.join(projectRoot, 'apps', 'docs');
    fs.mkdirSync(path.join(appDirectory, 'src'), { recursive: true });
    writeJson(path.join(appDirectory, 'package.json'), {
      name: '@fixture/docs',
      dependencies: { '@fixture/vue-i18n': 'workspace:*' },
    });
    writeJson(path.join(appDirectory, 'tsconfig.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@fixture/vue-i18n': ['../../packages/i18n/src/index.ts'],
        },
      },
    });
    fs.writeFileSync(
      path.join(appDirectory, 'src', 'App.vue'),
      `<script setup>
import { T, useGT } from '@fixture/vue-i18n';
const gt = useGT();
</script>
<template><T>Consumer rich text</T><p>{{ gt('Consumer string') }}</p></template>`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    expect(determineLibrary()).toEqual({
      library: Libraries.GT_VUE,
      additionalModules: [],
    });

    const output = await createInlineUpdatesForLibraries(
      [Libraries.GT_VUE],
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    // Before transitive Vue workspace discovery this returned only the barrel
    // marker: a non-empty partial catalog that could replace both app entries.
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'Barrel marker',
      'Consumer rich text',
      'Consumer string',
    ]);
  });

  it('keeps root Vue sources reached through a tsconfig workspace alias', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-vue-root-alias-workspace-')
    );
    temporaryDirectories.push(projectRoot);
    linkTestVueInstallation(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      private: true,
      workspaces: ['packages/*'],
    });
    writeJson(path.join(projectRoot, 'tsconfig.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@i18n': ['packages/i18n/src/index.ts'],
        },
      },
    });

    const barrelDirectory = path.join(projectRoot, 'packages', 'i18n');
    fs.mkdirSync(path.join(barrelDirectory, 'src'), { recursive: true });
    writeJson(path.join(barrelDirectory, 'package.json'), {
      name: '@fixture/vue-i18n',
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(barrelDirectory, 'src', 'index.ts'),
      `import { msg } from 'gt-vue';
export { T, useGT } from 'gt-vue';
export const barrelMessage = msg('Root alias barrel marker');`
    );

    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'src', 'App.vue'),
      `<script setup>
import { T, useGT } from '@i18n';
const gt = useGT();
</script>
<template><T>Root alias rich text</T><p>{{ gt('Root alias string') }}</p></template>`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    expect(determineLibrary()).toEqual({
      library: Libraries.GT_VUE,
      additionalModules: [],
    });

    const output = await createInlineUpdatesForLibraries(
      [Libraries.GT_VUE],
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'Root alias barrel marker',
      'Root alias rich text',
      'Root alias string',
    ]);
  });

  it.skipIf(process.platform === 'win32')(
    'preserves React root source symlink discovery',
    async () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gt-react-symlink-root-')
      );
      const outsideDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gt-react-outside-')
      );
      const outsideFileDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gt-react-outside-file-')
      );
      temporaryDirectories.push(
        projectRoot,
        outsideDirectory,
        outsideFileDirectory
      );
      writeJson(path.join(projectRoot, 'package.json'), {
        dependencies: { 'gt-react': '0.0.0' },
      });

      fs.writeFileSync(
        path.join(outsideDirectory, 'Directory.tsx'),
        `import { T } from 'gt-react'; export const App = () => <T>Outside directory</T>;`
      );
      fs.symlinkSync(outsideDirectory, path.join(projectRoot, 'src'), 'dir');

      fs.mkdirSync(path.join(projectRoot, 'components'), { recursive: true });
      const outsideFile = path.join(outsideFileDirectory, 'File.tsx');
      fs.writeFileSync(
        outsideFile,
        `import { T } from 'gt-react'; export const App = () => <T>Outside file</T>;`
      );
      fs.symlinkSync(
        outsideFile,
        path.join(projectRoot, 'components', 'App.tsx')
      );
      vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

      const output = await createInlineUpdatesForLibraries(
        [Libraries.GT_REACT],
        false,
        undefined,
        {
          autoderive: false,
          enableAutoJsxInjection: false,
          includeSourceCodeContext: false,
          legacyGtReactImportSource: false,
        },
        { conditionNames: ['import', 'default'] }
      );

      expect(output.errors).toEqual([]);
      expect(output.warnings).toEqual([]);
      expect(output.updates.map((update) => update.source).sort()).toEqual([
        'Outside directory',
        'Outside file',
      ]);
    }
  );
});

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, JSON.stringify(value));
}
