import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractFromVueProject } from '../../project.js';
import {
  createProjectFixture,
  linkInstalledVue,
  removeProjectFixture,
  translatableSfc,
} from './projectTestUtils.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    removeProjectFixture(directory);
  }
});

describe('project extraction orchestration parity', () => {
  it('does not resolve an unowned React root Vite config', async () => {
    const root = createWorkspace({
      'package.json': JSON.stringify({
        private: true,
        workspaces: ['apps/*'],
        dependencies: {
          '@vitejs/plugin-react': '*',
          'gt-react': '*',
          react: '*',
          vite: '*',
        },
      }),
      'vite.config.ts': `
        import react from '@vitejs/plugin-react';
        export default ({ command }) => command === 'serve'
          ? { plugins: [react()] }
          : { plugins: [react()], build: { sourcemap: true } };
      `,
      'src/App.tsx': `
        import { T } from 'gt-react';
        export const App = () => <T>React root</T>;
      `,
      'apps/vue/package.json': vuePackage('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Vue workspace survives'),
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Vue workspace survives',
    ]);
  });

  it('does not scan an unrelated root SFC for a child Vue workspace', async () => {
    const root = createWorkspace({
      'src/Legacy.vue': `<script setup>const broken = ;</script>`,
      'apps/vue/package.json': vuePackage('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Owned child message'),
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Owned child message',
    ]);
  });

  it('does not promote explicitly matched sources outside owned Vue scopes', async () => {
    const root = createWorkspace({
      'package.json': JSON.stringify({
        name: 'react-workspace-root',
        private: true,
        workspaces: ['apps/*'],
        dependencies: { 'gt-react': '*' },
      }),
      'src/Legacy.vue': `<script setup>const broken = ;</script>`,
      'apps/vue/package.json': vuePackage('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Owned child message'),
    });

    const output = await extractFromVueProject({
      cwd: root,
      filePatterns: ['src/**/*'],
    });

    expect(output.errors).toEqual([]);
    expect(output.updates).toEqual([]);
  });

  it('honors explicit patterns inside an owned Vue workspace scope', async () => {
    const root = createWorkspace({
      'src/Legacy.vue': `<script setup>const broken = ;</script>`,
      'apps/vue/package.json': vuePackage('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Explicit owned message'),
    });

    const output = await extractFromVueProject({
      cwd: root,
      filePatterns: ['apps/vue/src/**/*.vue'],
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Explicit owned message',
    ]);
  });

  it('keeps compiler options isolated across Vue workspaces', async () => {
    const root = createWorkspace({
      'apps/custom/package.json': vuePackage('custom-app'),
      'apps/custom/vite.config.ts': customDelimiterConfig(),
      'apps/custom/src/App.vue': vueCall(
        '[[',
        ']]',
        'Custom workspace message'
      ),
      'apps/standard/package.json': vuePackage('standard-app'),
      'apps/standard/src/App.vue': vueCall(
        '{{',
        '}}',
        'Standard workspace message'
      ),
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source).sort()).toEqual([
      'Custom workspace message',
      'Standard workspace message',
    ]);
  });

  it('applies an explicit config only to its owning workspace', async () => {
    const root = createWorkspace({
      'apps/selected/package.json': vuePackage('selected-app'),
      'apps/selected/vite.config.ts': customDelimiterConfig(),
      'apps/selected/src/App.vue': vueCall(
        '[[',
        ']]',
        'Selected workspace config'
      ),
      'apps/default/package.json': vuePackage('default-app'),
      'apps/default/src/App.vue': vueCall(
        '{{',
        '}}',
        'Default workspace config'
      ),
    });

    const output = await extractFromVueProject({
      cwd: root,
      viteConfigPath: 'apps/selected/vite.config.ts',
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source).sort()).toEqual([
      'Default workspace config',
      'Selected workspace config',
    ]);
  });

  it('accepts supported Vue JSX plugin options', async () => {
    const root = createVueProject({
      'vite.config.ts': `
        import vueJsx from '@vitejs/plugin-vue-jsx';
        export default { plugins: [vueJsx({ babelPlugins: [], optimize: true })] };
      `,
      'src/View.tsx': `
        import { T } from 'gt-vue';
        export const View = () => <T context="card">Supported TSX</T>;
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates).toEqual([
      expect.objectContaining({
        dataFormat: 'JSX',
        source: 'Supported TSX',
        metadata: expect.objectContaining({ context: 'card' }),
      }),
    ]);
  });

  it('resolves Nuxt source aliases through a static srcDir', async () => {
    const root = createVueProject({
      'nuxt.config.ts': `
        export default defineNuxtConfig({ srcDir: 'src/' });
      `,
      'src/i18n.ts': `export { msg as defineMessage } from 'gt-vue';`,
      'src/messages.ts': `
        import { defineMessage } from '~/i18n';
        export const title = defineMessage('Nuxt alias message');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Nuxt alias message',
    ]);
  });

  it.skipIf(process.platform === 'win32')(
    'does not follow source globs through a symlink outside the project',
    async () => {
      const outside = createTemporaryDirectory();
      fs.writeFileSync(
        path.join(outside, 'Outside.vue'),
        translatableSfc('Outside symlink message')
      );
      const root = createVueProject({});
      fs.symlinkSync(outside, path.join(root, 'src'), 'dir');

      const output = await extractFromVueProject({ cwd: root });

      expect(output).toEqual({ updates: [], errors: [], warnings: [] });
    }
  );

  it('reports invalid source patterns instead of returning an empty catalog', async () => {
    const root = createVueProject({
      'src/App.vue': translatableSfc('Pattern failure must be atomic'),
    });

    const output = await extractFromVueProject({
      cwd: root,
      filePatterns: [null as unknown as string],
    });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not match the configured Vue source patterns'
    );
  });

  it('reports an inaccessible project root during source matching', async () => {
    const root = createVueProject({
      'src/App.vue': translatableSfc('Root failure must be atomic'),
    });
    const realpathSync = fs.realpathSync;
    vi.spyOn(fs, 'realpathSync').mockImplementation((target) => {
      if (path.resolve(String(target)) === root) {
        throw new Error('root disappeared');
      }
      return realpathSync(target);
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not resolve the Vue project root'
    );
    expect(output.errors.join('\n')).toContain('root disappeared');
  });

  it('reports a matched-file realpath race without returning partial updates', async () => {
    const root = createVueProject({
      'src/Good.vue': translatableSfc('Good message'),
      'src/Lost.vue': translatableSfc('Lost message'),
    });
    const realpathSync = fs.realpathSync;
    const lostFile = realpathSync(path.join(root, 'src/Lost.vue'));
    vi.spyOn(fs, 'realpathSync').mockImplementation((target) => {
      if (path.resolve(String(target)) === lostFile) {
        throw new Error('matched file disappeared');
      }
      return realpathSync(target);
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not resolve a matched Vue source file'
    );
    expect(output.errors.join('\n')).toContain('src/Lost.vue');
    expect(output.errors.join('\n')).toContain('matched file disappeared');
  });
});

function createWorkspace(files: Record<string, string>): string {
  return createFixture({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      private: true,
      workspaces: ['apps/*'],
    }),
    ...files,
  });
}

function createVueProject(files: Record<string, string>): string {
  return createFixture({
    'package.json': vuePackage('vue-project'),
    ...files,
  });
}

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  linkInstalledVue(root);
  return root;
}

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-outside-'));
  temporaryDirectories.push(directory);
  return directory;
}

function vuePackage(name: string): string {
  return JSON.stringify({
    name,
    dependencies: { 'gt-vue': 'workspace:*', vue: '^3.5.0' },
  });
}

function customDelimiterConfig(): string {
  return `
    import vue from '@vitejs/plugin-vue';
    export default { plugins: [vue({
      template: { compilerOptions: { delimiters: ['[[', ']]'] } },
    })] };
  `;
}

function vueCall(open: string, close: string, source: string): string {
  return `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
</script>
<template>${open} gt(${JSON.stringify(source)}) ${close}</template>`;
}
