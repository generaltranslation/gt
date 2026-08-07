import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { extractFromVueProject } from '../../project.js';
import {
  createProjectFixture,
  linkInstalledVue,
  removeProjectFixture,
  translatableSfc,
} from './projectTestUtils.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    removeProjectFixture(directory);
  }
});

describe('extractFromVueProject', () => {
  it('discovers root app.vue and conventional Nuxt source directories', async () => {
    const root = createVueFixture({
      'app.vue': translatableSfc('Root app'),
      'layouts/default.vue': translatableSfc('Default layout'),
      'pages/index.vue': translatableSfc('Index page'),
      'components/AppNav.vue': translatableSfc('App navigation'),
      'composables/useTitle.ts': `
        import { msg } from 'gt-vue';
        export const title = msg('Composable title');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(output.updates.map(({ source }) => source).sort()).toEqual([
      'App navigation',
      'Composable title',
      'Default layout',
      'Index page',
      'Root app',
    ]);
  });

  it('uses explicit source patterns as a replacement for defaults', async () => {
    const root = createVueFixture({
      'src/Ignored.vue': translatableSfc('Ignored default source'),
      'custom/Selected.vue': translatableSfc('Selected explicit source'),
    });

    const output = await extractFromVueProject({
      cwd: root,
      filePatterns: ['custom/**/*.vue'],
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Selected explicit source',
    ]);
  });

  it('ignores a script module explicitly selected with a .vue filename', async () => {
    const root = createVueFixture({
      'src/Legacy.vue': `
        import { T } from 'gt-react';
        export const legacy = <T>Legacy React module</T>;
      `,
    });

    await expect(
      extractFromVueProject({
        cwd: root,
        filePatterns: ['src/Legacy.vue'],
      })
    ).resolves.toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('extracts an SFC whose standard blocks follow a custom block', async () => {
    const root = createVueFixture({
      'src/Localized.vue': `<i18n lang="json">
{"en":{"title":"Localized"}}
</i18n>
${translatableSfc('Message after custom block')}`,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Message after custom block',
    ]);
  });

  it.each([
    ['block comment', '/* Copyright Fixture */'],
    ['line comment', '// Copyright Fixture'],
    ['doctype', '<!DOCTYPE html>'],
    ['plain text', 'Copyright Fixture'],
    ['markdown frontmatter', '---\ntitle: Fixture\n---'],
    ['shebang', '#!/usr/bin/env vue'],
  ])('extracts an SFC after a leading %s', async (_name, prelude) => {
    const root = createVueFixture({
      'src/App.vue': `${prelude}\n${translatableSfc('Message after prelude')}`,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Message after prelude',
    ]);
  });

  it('extracts an SFC after a same-line text prefix', async () => {
    const root = createVueFixture({
      'src/App.vue': `Copyright Fixture ${translatableSfc('Same-line prefix')}`,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Same-line prefix',
    ]);
  });

  it('uses the nearest nested package config for explicitly matched sources', async () => {
    const root = createVueFixture({
      'packages/docs/package.json': JSON.stringify({
        name: '@fixture/docs',
        private: true,
      }),
      'packages/docs/vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({
          template: { compilerOptions: { delimiters: ['[[', ']]'] } },
        })] };
      `,
      'packages/docs/src/App.vue': `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
</script>
<template><p>[[ gt('Nested package message') ]]</p></template>
`,
    });

    const output = await extractFromVueProject({
      cwd: root,
      filePatterns: ['packages/docs/src/**/*.vue'],
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Nested package message',
    ]);
  });

  it('inherits root compiler options across a nested package boundary without Vue ownership', async () => {
    const root = createVueFixture({
      'vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({
          template: { compilerOptions: { delimiters: ['[[', ']]'] } },
        })] };
      `,
      'packages/docs/package.json': JSON.stringify({
        name: '@fixture/docs',
        private: true,
      }),
      'packages/docs/src/App.vue': `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
</script>
<template><p>[[ gt('Inherited root compiler options') ]]</p></template>
`,
    });

    const output = await extractFromVueProject({
      cwd: root,
      filePatterns: ['packages/docs/src/**/*.vue'],
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Inherited root compiler options',
    ]);
  });

  it('gives an explicitly matched package that owns gt-vue an independent compiler scope', async () => {
    const root = createVueFixture({
      'vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({
          template: { compilerOptions: { delimiters: ['[[', ']]'] } },
        })] };
      `,
      'packages/docs/package.json': vuePackage('@fixture/docs'),
      'packages/docs/src/App.vue': `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
</script>
<template><p>{{ gt('Independent nested compiler options') }}</p></template>
`,
    });

    const output = await extractFromVueProject({
      cwd: root,
      filePatterns: ['packages/docs/src/**/*.vue'],
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Independent nested compiler options',
    ]);
  });

  it('calculates exact context-aware catalog hashes with generaltranslation/id', async () => {
    const root = createVueFixture({
      'src/messages.ts': `
        import { useGT } from 'gt-vue';
        const gt = useGT();
        export const title = gt('Welcome to San Francisco', {
          $context: 'homepage hero',
        });
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'STRING',
      metadata: {
        context: 'homepage hero',
        hash: hashSource({
          source: 'Welcome to San Francisco',
          context: 'homepage hero',
          dataFormat: 'STRING',
        }),
      },
      source: 'Welcome to San Francisco',
    });
  });

  it('deduplicates hashes while merging unique file and source metadata', async () => {
    const root = createVueFixture({
      'src/first.ts': `
        import { msg } from 'gt-vue';
        export const first = msg('Repeated message');
      `,
      'src/second.ts': `
        import { msg } from 'gt-vue';
        export const second = msg('Repeated message');
      `,
    });

    const output = await extractFromVueProject({
      cwd: root,
      includeSourceCodeContext: true,
      surroundingLineCount: 1,
    });

    expect(output.errors).toEqual([]);
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]?.metadata.filePaths?.sort()).toEqual([
      'src/first.ts',
      'src/second.ts',
    ]);
    expect(
      Object.keys(output.updates[0]?.metadata.sourceCode ?? {}).sort()
    ).toEqual(['src/first.ts', 'src/second.ts']);
    expect(
      output.updates[0]?.metadata.sourceCode?.['src/first.ts']
    ).toHaveLength(1);
    expect(
      output.updates[0]?.metadata.sourceCode?.['src/second.ts']
    ).toHaveLength(1);
  });

  it('isolates React-family and unrelated useGT sources in a mixed project', async () => {
    const root = createVueFixture(
      {
        'src/App.js': `
          import React from 'react';
          import { T, msg, useGT } from 'gt-react';
          export function App() {
            const gt = useGT();
            return <T>{gt('React call')} {msg('React message')}</T>;
          }
        `,
        'src/Next.tsx': `
          import { useGT } from 'gt-next';
          export const NextView = () => <div>{useGT()('Next call')}</div>;
        `,
        'src/ordinary.cjs': `
          module.exports.useGT = () => (value) => value;
        `,
        'src/Ordinary.js': `
          import { useGT } from './ordinary.cjs';
          export const View = () => <span>{useGT()('Ordinary call')}</span>;
        `,
        'src/vueMessage.ts': `
          import { msg } from 'gt-vue';
          export const vueMessage = msg('Vue-owned message');
        `,
      },
      {
        'gt-react': '*',
        'gt-next': '*',
      }
    );

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Vue-owned message',
    ]);
  });

  it('fails closed when a T context is dynamic', async () => {
    const root = createVueFixture({
      'src/App.vue': `<script setup lang="ts">
import { ref } from 'vue';
import { T } from 'gt-vue';
const context = ref('one');
</script>
<template><T :context="context">Dynamic context</T></template>
`,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain('dynamic context');
  });

  it('returns no partial catalog when any selected app has invalid compiler config', async () => {
    const root = createWorkspaceFixture({
      'apps/good/package.json': vuePackage('good-app'),
      'apps/good/src/App.vue': translatableSfc('Good app message'),
      'apps/bad/package.json': vuePackage('bad-app'),
      'apps/bad/src/App.vue': translatableSfc('Bad app message'),
      'apps/bad/vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        const readWhitespace = () => 'preserve';
        export default {
          plugins: [vue({
            template: {
              compilerOptions: { whitespace: readWhitespace() },
            },
          })],
        };
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it('returns no partial catalog when one selected source has an extraction error', async () => {
    const root = createVueFixture({
      'src/Good.vue': translatableSfc('Valid message'),
      'src/Bad.vue': `<script setup lang="ts">
import { ref } from 'vue';
import { T } from 'gt-vue';
const context = ref('dynamic');
</script>
<template><T :context="context">Invalid message</T></template>
`,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain('dynamic context');
  });

  it('allows one child Vue app to use a centrally located explicit Vite config', async () => {
    const root = createWorkspaceFixture({
      'config/vue.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
      'apps/docs/package.json': vuePackage('docs-app'),
      'apps/docs/src/App.vue': translatableSfc('Central config message'),
    });

    const output = await extractFromVueProject({
      cwd: root,
      viteConfigPath: 'config/vue.ts',
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Central config message',
    ]);
  });

  it('applies a central explicit config when explicit patterns select one of several apps', async () => {
    const root = createWorkspaceFixture({
      'config/vue.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })] };
      `,
      'apps/selected/package.json': vuePackage('selected-app'),
      'apps/selected/src/App.vue': `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
</script>
<template>[[ gt('Selected central config') ]]</template>
`,
      'apps/other/package.json': vuePackage('other-app'),
      'apps/other/src/App.vue': translatableSfc('Unselected app'),
    });

    const output = await extractFromVueProject({
      cwd: root,
      filePatterns: ['apps/selected/src/**/*.vue'],
      viteConfigPath: 'config/vue.ts',
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Selected central config',
    ]);
  });

  it('does not validate Vue config when explicit patterns match no Vue-owned files', async () => {
    const root = createWorkspaceFixture({
      'src/App.tsx': `
        import { T } from 'gt-react';
        export const App = () => <T>React only</T>;
      `,
      'vite.config.ts': `export default ({ mode }) => mode === 'test' ? {} : {};`,
      'apps/vue/package.json': vuePackage('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Unselected Vue app'),
    });

    await expect(
      extractFromVueProject({
        cwd: root,
        filePatterns: ['src/App.tsx'],
        viteConfigPath: 'vite.config.ts',
      })
    ).resolves.toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('rejects a central explicit config that is ambiguous across matched apps', async () => {
    const root = createWorkspaceFixture({
      'config/vue.ts': `export default {}`,
      'apps/first/package.json': vuePackage('first-app'),
      'apps/first/src/messages.ts': `
        import { msg } from 'gt-vue';
        export const first = msg('First app');
      `,
      'apps/second/package.json': vuePackage('second-app'),
      'apps/second/src/messages.ts': `
        import { msg } from 'gt-vue';
        export const second = msg('Second app');
      `,
    });

    const output = await extractFromVueProject({
      cwd: root,
      viteConfigPath: 'config/vue.ts',
    });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'does not own any matched Vue sources'
    );
  });

  it.each(['missing.config.ts', '../outside.config.ts', 'vite.config.json'])(
    'validates explicit config %s for STRING-only sources',
    async (viteConfigPath) => {
      const root = createVueFixture({
        'src/messages.ts': `
          import { msg } from 'gt-vue';
          export const title = msg('String-only source');
        `,
      });

      const output = await extractFromVueProject({
        cwd: root,
        viteConfigPath,
      });

      expect(output.updates).toEqual([]);
      expect(output.errors).not.toEqual([]);
    }
  );

  it('fails closed when a custom Nuxt source directory hides every default match', async () => {
    const root = createVueFixture({
      'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: 'client/' });`,
      'client/app.vue': translatableSfc('Hidden Nuxt message'),
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'custom Nuxt source directories'
    );
  });

  it('allows explicit patterns to cover a custom Nuxt source directory', async () => {
    const root = createVueFixture({
      'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: 'client/' });`,
      'client/app.vue': translatableSfc('Explicit Nuxt source'),
    });

    const output = await extractFromVueProject({
      cwd: root,
      filePatterns: ['client/**/*.vue'],
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Explicit Nuxt source',
    ]);
  });

  it('rejects a hidden Nuxt workspace instead of returning another app as a partial catalog', async () => {
    const root = createWorkspaceFixture({
      'apps/good/package.json': vuePackage('good-app'),
      'apps/good/src/App.vue': translatableSfc('Visible app message'),
      'apps/custom/package.json': vuePackage('custom-app'),
      'apps/custom/nuxt.config.ts': `export default defineNuxtConfig({ srcDir: 'client/' });`,
      'apps/custom/client/app.vue': translatableSfc('Hidden app message'),
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'custom Nuxt source directories'
    );
  });

  it('validates hidden Nuxt workspaces when another app supplies an explicit Vite config', async () => {
    const root = createWorkspaceFixture({
      'apps/vite/package.json': vuePackage('vite-app'),
      'apps/vite/vite.config.ts': `export default {}`,
      'apps/vite/src/App.vue': translatableSfc('Visible Vite message'),
      'apps/nuxt/package.json': vuePackage('nuxt-app'),
      'apps/nuxt/nuxt.config.ts': `export default defineNuxtConfig({ srcDir: 'client/' });`,
      'apps/nuxt/client/app.vue': translatableSfc('Hidden Nuxt message'),
    });

    const output = await extractFromVueProject({
      cwd: root,
      viteConfigPath: 'apps/vite/vite.config.ts',
    });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'custom Nuxt source directories'
    );
  });

  it.each(['js', 'mjs', 'cjs'])(
    'validates Vue JSX config for rich content in .%s files',
    async (extension) => {
      const root = createVueFixture({
        'vite.config.ts': `
          import vueJsx from '@vitejs/plugin-vue-jsx';
          const customPlugin = () => ({});
          export default { plugins: [vueJsx({ babelPlugins: [customPlugin] })] };
        `,
        [`src/View.${extension}`]: `
          import { T } from 'gt-vue';
          export const View = () => <T>Configured JSX</T>;
        `,
      });

      const output = await extractFromVueProject({ cwd: root });

      expect(output.updates).toEqual([]);
      expect(output.errors.join('\n')).toContain('option "babelPlugins"');
    }
  );

  it('follows TypeScript path aliases through local gt-vue reexports', async () => {
    const root = createVueFixture({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@local/gt': ['src/gt.ts'] },
        },
      }),
      'src/gt.ts': "export { T as LocalT } from 'gt-vue';\n",
      'src/App.vue': `<script setup lang="ts">
import { LocalT } from '@local/gt';
</script>
<template><LocalT>Aliased reexport message</LocalT></template>
`,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Aliased reexport message',
    ]);
  });

  it('establishes provenance through a static Vite alias before extraction', async () => {
    const root = createVueFixture({
      'vite.config.ts': `
        import path from 'node:path';
        import { defineConfig } from 'vite';
        export default defineConfig({
          resolve: { alias: { '@i18n': path.resolve(__dirname, 'src/i18n.ts') } },
        });
      `,
      'src/i18n.ts': "export { msg } from 'gt-vue';\n",
      'src/messages.ts': `
        import { msg } from '@i18n';
        export const title = msg('Vite alias message');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Vite alias message',
    ]);
  });

  it.each([
    `
      const chooseAlias = () => '/dynamic';
      export default { resolve: { alias: { '@i18n': chooseAlias() } } };
    `,
    `
      export default { resolve: { alias: [
        { find: '@i18n', replacement: '/static', customResolver() {} },
      ] } };
    `,
    `export default ({ command }) => command === 'serve' ? {} : {};`,
  ])(
    'fails atomically when application aliases are not static',
    async (config) => {
      const root = createVueFixture({
        'vite.config.ts': config,
        'src/messages.ts': `
        import { msg } from 'gt-vue';
        export const title = msg('Direct message must not mask alias risk');
      `,
      });

      const output = await extractFromVueProject({ cwd: root });

      expect(output.updates).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not statically resolve the Vue application module aliases'
      );
    }
  );

  it('keeps transitive workspace aliases scoped to their originating app', async () => {
    const root = createWorkspaceFixture({
      'apps/first/package.json': vuePackage('first-app'),
      'apps/first/vite.config.ts': `
        import path from 'node:path';
        export default { resolve: { alias: {
          '#runtime': path.resolve(__dirname, 'src/runtime.ts'),
        } } };
      `,
      'apps/first/src/runtime.ts': "export { msg } from 'gt-vue';",
      'apps/first/src/messages.ts': `
        import { translate } from '@fixture/shared';
        export const title = translate('First app message');
      `,
      'apps/second/package.json': vuePackage('second-app'),
      'apps/second/vite.config.ts': `
        import path from 'node:path';
        export default { resolve: { alias: {
          '#runtime': path.resolve(__dirname, 'src/runtime.ts'),
        } } };
      `,
      'apps/second/src/runtime.ts':
        'export const msg = (value: string) => value;',
      'apps/second/src/messages.ts': `
        import { translate } from '@fixture/shared';
        export const title = translate('Second app ordinary message');
      `,
      'packages/shared/package.json': JSON.stringify({
        name: '@fixture/shared',
        exports: { '.': './src/barrel.js' },
      }),
      'packages/shared/src/barrel.ts':
        "export { msg as translate } from '#runtime';",
    });
    const sharedLink = path.join(root, 'node_modules/@fixture/shared');
    fs.mkdirSync(path.dirname(sharedLink), { recursive: true });
    fs.symlinkSync(path.join(root, 'packages/shared'), sharedLink, 'dir');

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'First app message',
    ]);
  });

  it('is deterministic across 80 concurrent project extractions', async () => {
    const root = createVueFixture({
      'src/App.vue': `<script setup lang="ts">
import { T, msg } from 'gt-vue';
export const subtitle = msg('Concurrent subtitle');
</script>
<template><T context="concurrency">Concurrent heading</T></template>
`,
    });

    const outputs = await Promise.all(
      Array.from({ length: 80 }, () =>
        extractFromVueProject({
          cwd: root,
          includeSourceCodeContext: true,
        })
      )
    );

    expect(outputs[0]?.errors).toEqual([]);
    expect(outputs[0]?.updates).toHaveLength(2);
    const expected = JSON.stringify(outputs[0]);
    expect(outputs.every((output) => JSON.stringify(output) === expected)).toBe(
      true
    );
  });
});

function createVueFixture(
  files: Record<string, string>,
  additionalDependencies: Record<string, string> = {}
): string {
  return createFixture({
    'package.json': JSON.stringify({
      name: 'vue-project',
      private: true,
      dependencies: {
        ...additionalDependencies,
        'gt-vue': 'workspace:*',
        vue: '^3.5.0',
      },
    }),
    ...files,
  });
}

function createWorkspaceFixture(files: Record<string, string>): string {
  return createFixture({
    'package.json': JSON.stringify({
      name: 'vue-workspace',
      private: true,
      workspaces: ['apps/*'],
    }),
    ...files,
  });
}

function vuePackage(name: string): string {
  return JSON.stringify({
    name,
    dependencies: { 'gt-vue': 'workspace:*', vue: '^3.5.0' },
  });
}

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  linkInstalledVue(root);
  return root;
}
