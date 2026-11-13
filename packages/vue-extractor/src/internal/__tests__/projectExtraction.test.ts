import fs from 'node:fs';
import path from 'node:path';
import { hashSource } from 'generaltranslation/id';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectVueProject } from '../../inspect.js';
import {
  extractFromVueProject,
  mergeVueProjectExtraction,
} from '../../project.js';
import type { VueProjectExtractionResult } from '../../types.js';
import {
  createTestProject,
  linkInstalledVue,
  translatableSfc,
} from './projectTestUtils.js';

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

  it('hashes and deduplicates module-level t() calls through project extraction', async () => {
    const root = createVueFixture({
      'src/messages.ts': `
        import { msg, t } from 'gt-vue';
        t('Module greeting');
        t('Module greeting');
        msg('Module greeting');
        t('Module greeting', { $context: 'toolbar action' });
        t('Literal {name} — 你好\\nnext');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(
      output.updates.map(({ dataFormat, metadata, source }) => ({
        context: metadata.context,
        dataFormat,
        hash: metadata.hash,
        source,
      }))
    ).toEqual([
      {
        context: undefined,
        dataFormat: 'STRING',
        hash: 'f7333e2142c92464',
        source: 'Module greeting',
      },
      {
        context: 'toolbar action',
        dataFormat: 'STRING',
        hash: 'e811c9263249a811',
        source: 'Module greeting',
      },
      {
        context: undefined,
        dataFormat: 'STRING',
        hash: '1eddffaf048e42ac',
        source: 'Literal {name} — 你好\nnext',
      },
    ]);

    expect(
      hashSource({ dataFormat: 'STRING', source: 'Module greeting' })
    ).toBe('f7333e2142c92464');
    expect(
      hashSource({
        context: 'toolbar action',
        dataFormat: 'STRING',
        source: 'Module greeting',
      })
    ).toBe('e811c9263249a811');
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

  it('hashes missing and explicit-empty T children distinctly', async () => {
    const validRoot = createVueFixture({
      'src/Missing.tsx': `
        import { T } from 'gt-vue';
        export const Missing = () => <T />;
      `,
    });
    const validOutput = await extractFromVueProject({ cwd: validRoot });

    expect(validOutput.errors).toEqual([]);
    expect(
      validOutput.updates.map(({ metadata, source }) => ({
        hash: metadata.hash,
        source,
      }))
    ).toEqual([{ hash: '309dc626c8db3d4c', source: undefined }]);

    const emptyRoot = createVueFixture({
      'src/Empty.tsx': `
        import { T } from 'gt-vue';
        export const EmptyArray = () => <T>{[]}</T>;
      `,
    });
    const emptyOutput = await extractFromVueProject({ cwd: emptyRoot });

    expect(emptyOutput.errors).toEqual([]);
    expect(
      emptyOutput.updates.map(({ metadata, source }) => ({
        hash: metadata.hash,
        source,
      }))
    ).toEqual([{ hash: 'bdb7cc7686d0e468', source: [] }]);
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

  it.each([
    {
      environment: 'TS_NODE_BASEURL' as const,
      filePatterns: undefined,
      name: 'full extraction with TS_NODE_BASEURL',
      sources: ['Selected discovered config', 'Other discovered config'],
    },
    {
      environment: 'TS_NODE_BASEURL' as const,
      filePatterns: ['src/Selected.tsx'],
      name: 'targeted extraction with TS_NODE_BASEURL',
      sources: ['Selected discovered config'],
    },
    {
      environment: 'TS_NODE_PROJECT' as const,
      filePatterns: undefined,
      name: 'full extraction with TS_NODE_PROJECT',
      sources: ['Selected discovered config', 'Other discovered config'],
    },
    {
      environment: 'TS_NODE_PROJECT' as const,
      filePatterns: ['src/Selected.tsx'],
      name: 'targeted extraction with TS_NODE_PROJECT',
      sources: ['Selected discovered config'],
    },
  ])(
    'isolates discovered configs from ambient ts-node settings during $name',
    async ({ environment, filePatterns, sources }) => {
      const root = createVueFixture({
        'tsconfig.json': JSON.stringify({
          extends: './config/base.json',
        }),
        'config/base.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '..',
            paths: { '@local/gt': ['src/gt.ts'] },
          },
        }),
        'config/wrong.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '..',
            paths: { '@local/gt': ['src/not-gt.ts'] },
          },
        }),
        'src/not-gt.ts': 'export const LocalT = Symbol();\n',
        'src/gt.ts': "export { T as LocalT } from 'gt-vue';\n",
        'src/Selected.tsx': `
          import { LocalT } from '@local/gt';
          export const Selected = () => (
            <LocalT>Selected discovered config</LocalT>
          );
        `,
        'src/Other.vue': `<script setup lang="ts">
import { LocalT } from '@local/gt';
</script>
<template><LocalT>Other discovered config</LocalT></template>
`,
      });
      const previousBaseUrl = process.env.TS_NODE_BASEURL;
      const previousProject = process.env.TS_NODE_PROJECT;
      delete process.env.TS_NODE_BASEURL;
      delete process.env.TS_NODE_PROJECT;
      process.env[environment] =
        environment === 'TS_NODE_PROJECT'
          ? path.join(root, 'config', 'wrong.json')
          : 'ambient-base-url';

      try {
        const output = await extractFromVueProject({
          cwd: root,
          filePatterns,
        });

        expect(output.errors).toEqual([]);
        expect(output.updates.map(({ source }) => source).sort()).toEqual(
          [...sources].sort()
        );
      } finally {
        restoreEnvironmentVariable('TS_NODE_BASEURL', previousBaseUrl);
        restoreEnvironmentVariable('TS_NODE_PROJECT', previousProject);
      }
    }
  );

  it.each([
    {
      filePatterns: undefined,
      name: 'framework-default source discovery',
      sources: ['Selected explicit config', 'Other explicit config'],
    },
    {
      filePatterns: ['src/Selected.tsx'],
      name: 'targeted source discovery',
      sources: ['Selected explicit config'],
    },
  ])(
    'uses an explicit jsconfig with reusable inspection and $name',
    async ({ filePatterns, sources }) => {
      const root = createVueFixture({
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: { '@local/gt': ['src/not-gt.ts'] },
          },
        }),
        'config/jsconfig.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '..',
            paths: { '@local/gt': ['src/gt.ts'] },
          },
        }),
        'src/not-gt.ts': 'export const LocalT = Symbol();\n',
        'src/gt.ts': "export { T as LocalT } from 'gt-vue';\n",
        'src/Selected.tsx': `
          import { LocalT } from '@local/gt';
          export const Selected = () => (
            <LocalT>Selected explicit config</LocalT>
          );
        `,
        'src/Other.vue': `<script setup lang="ts">
import { LocalT } from '@local/gt';
</script>
<template><LocalT>Other explicit config</LocalT></template>
`,
      });
      const inspection = inspectVueProject(root);

      const output = await extractFromVueProject({
        cwd: root,
        inspection,
        filePatterns,
        tsconfigPath: 'config/jsconfig.json',
      });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source).sort()).toEqual(
        [...sources].sort()
      );
    }
  );

  it.each([
    {
      environment: 'TS_NODE_BASEURL' as const,
      filePatterns: undefined,
      name: 'full extraction with TS_NODE_BASEURL',
      sources: ['Selected isolated config', 'Other isolated config'],
    },
    {
      environment: 'TS_NODE_BASEURL' as const,
      filePatterns: ['src/Selected.tsx'],
      name: 'targeted extraction with TS_NODE_BASEURL',
      sources: ['Selected isolated config'],
    },
    {
      environment: 'TS_NODE_PROJECT' as const,
      filePatterns: undefined,
      name: 'full extraction with TS_NODE_PROJECT',
      sources: ['Selected isolated config', 'Other isolated config'],
    },
    {
      environment: 'TS_NODE_PROJECT' as const,
      filePatterns: ['src/Selected.tsx'],
      name: 'targeted extraction with TS_NODE_PROJECT',
      sources: ['Selected isolated config'],
    },
  ])(
    'isolates an explicit config from ambient ts-node settings during $name',
    async ({ environment, filePatterns, sources }) => {
      const root = createVueFixture({
        'tsconfig.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: { '@local/gt': ['src/not-gt.ts'] },
          },
        }),
        'config/jsconfig.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '..',
            paths: { '@local/gt': ['src/gt.ts'] },
          },
        }),
        'src/not-gt.ts': 'export const LocalT = Symbol();\n',
        'src/gt.ts': "export { T as LocalT } from 'gt-vue';\n",
        'src/Selected.tsx': `
          import { LocalT } from '@local/gt';
          export const Selected = () => (
            <LocalT>Selected isolated config</LocalT>
          );
        `,
        'src/Other.vue': `<script setup lang="ts">
import { LocalT } from '@local/gt';
</script>
<template><LocalT>Other isolated config</LocalT></template>
`,
      });
      const previousBaseUrl = process.env.TS_NODE_BASEURL;
      const previousProject = process.env.TS_NODE_PROJECT;
      delete process.env.TS_NODE_BASEURL;
      delete process.env.TS_NODE_PROJECT;
      process.env[environment] =
        environment === 'TS_NODE_PROJECT'
          ? path.join(root, 'tsconfig.json')
          : 'ambient-base-url';

      try {
        const output = await extractFromVueProject({
          cwd: root,
          filePatterns,
          tsconfigPath: 'config/jsconfig.json',
        });

        expect(output.errors).toEqual([]);
        expect(output.updates.map(({ source }) => source).sort()).toEqual(
          [...sources].sort()
        );
      } finally {
        restoreEnvironmentVariable('TS_NODE_BASEURL', previousBaseUrl);
        restoreEnvironmentVariable('TS_NODE_PROJECT', previousProject);
      }
    }
  );

  it.each([
    ['missing config', 'config/missing.json', undefined],
    ['malformed config', 'config/tsconfig.json', '{ malformed'],
    [
      'invalid path mappings',
      'config/jsconfig.json',
      JSON.stringify({
        compilerOptions: { paths: { '@local/gt': 'src/gt.ts' } },
      }),
    ],
  ])(
    'fails atomically for an explicit $name',
    async (_name, tsconfigPath, config) => {
      const root = createVueFixture({
        ...(config === undefined ? {} : { [tsconfigPath]: config }),
        'src/App.vue': translatableSfc('Must not publish'),
      });

      const output = await extractFromVueProject({
        cwd: root,
        tsconfigPath,
      });

      expect(output.updates).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not load the configured TypeScript project file'
      );
      expect(output.errors.join('\n')).toContain(tsconfigPath);
    }
  );

  it('follows a package self-reference whose emitted export has only TypeScript source', async () => {
    const root = createLinkedProject({
      'package.json': JSON.stringify({
        name: '@fixture/self-vue-app',
        private: true,
        dependencies: { 'gt-vue': 'workspace:*', vue: '^3.5.0' },
        exports: { './runtime': './dist/runtime.js' },
      }),
      'dist/runtime.ts': "export { T as LocalT } from 'gt-vue';\n",
      'src/App.tsx': `
        import { LocalT } from '@fixture/self-vue-app/runtime';
        export const App = () => <LocalT>Self-reference message</LocalT>;
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Self-reference message',
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

  it('is deterministic across 16 concurrent project extractions', async () => {
    const root = createVueFixture({
      'src/App.vue': `<script setup lang="ts">
import { T, msg } from 'gt-vue';
export const subtitle = msg('Concurrent subtitle');
</script>
<template><T context="concurrency">Concurrent heading</T></template>
`,
    });

    const outputs = await Promise.all(
      Array.from({ length: 16 }, () =>
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

  function createVueFixture(
    files: Record<string, string>,
    additionalDependencies: Record<string, string> = {}
  ): string {
    return createLinkedProject({
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

  function restoreEnvironmentVariable(
    name: 'TS_NODE_BASEURL' | 'TS_NODE_PROJECT',
    value: string | undefined
  ): void {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe('project extraction orchestration parity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not resolve an unowned React root Vite config', async () => {
    const root = createWorkspaceFixture({
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
    const root = createWorkspaceFixture({
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
    const root = createWorkspaceFixture({
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
    const root = createWorkspaceFixture({
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
    const root = createWorkspaceFixture({
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
    const root = createWorkspaceFixture({
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
      const outside = createTestProject();
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

  function createVueProject(files: Record<string, string>): string {
    return createLinkedProject({
      'package.json': vuePackage('vue-project'),
      ...files,
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
});

describe('project alias provenance', () => {
  it('ignores an incomplete Vue alias config for React-owned source', async () => {
    const root = createAliasFixture({
      'src/App.tsx': `
        import { useGT } from 'gt-react';
        export function App() {
          const gt = useGT();
          return <h1>{gt('React-owned message')}</h1>;
        }
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('fails closed when a direct gt-vue source shares an incomplete alias config', async () => {
    const root = createAliasFixture({
      'src/message.ts': `
        import { msg } from 'gt-vue';
        export const message = msg('Vue-owned message');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve the Vue application module aliases'
    );
  });

  it('does not infer gt-vue ownership from an unresolved GT-shaped alias', async () => {
    const root = createAliasFixture({
      'src/App.tsx': `
        import { useGT } from '#i18n';
        export function App() {
          const gt = useGT();
          return <h1>{gt('Ordinary aliased message')}</h1>;
        }
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('does not treat an ordinary relative useGT helper as gt-vue', async () => {
    const root = createAliasFixture({
      'src/ordinary.ts': `
        export const useGT = () => (value: string) => value;
      `,
      'src/view.ts': `
        import { useGT } from './ordinary';
        export const title = useGT()('Ordinary message');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('keeps an ordinary React helper behind an incomplete alias silent', async () => {
    const root = createAliasFixture({
      'vite.config.ts': `
        import path from 'node:path';
        const dynamicAliases = getAliases();
        export default { resolve: { alias: {
          '@app': path.resolve(__dirname, 'src/app.ts'),
          ...dynamicAliases,
        } } };
      `,
      'src/app.ts': `
        export const useGT = () => (value: string) => value;
      `,
      'src/App.tsx': `
        import { useGT } from '@app';
        export function App() {
          const gt = useGT();
          return <h1>{gt('React-owned aliased message')}</h1>;
        }
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('fails closed when an incomplete alias candidate proves gt-vue provenance', async () => {
    const root = createAliasFixture({
      'vite.config.ts': `
        import path from 'node:path';
        const dynamicAliases = getAliases();
        export default { resolve: { alias: {
          '@i18n': path.resolve(__dirname, 'src/i18n.ts'),
          ...dynamicAliases,
        } } };
      `,
      'src/i18n.ts': "export { msg } from 'gt-vue';",
      'src/message.ts': `
        import { msg } from '@i18n';
        export const message = msg('Vue-owned aliased message');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve the Vue application module aliases'
    );
  });

  it('keeps diagnostic alias candidates attached through transitive barrels', async () => {
    const root = createAliasFixture({
      'vite.config.ts': `
        import path from 'node:path';
        export default { resolve: { alias: {
          '#runtime': path.resolve(__dirname, 'src/runtime.ts'),
          ...getAliases(),
        } } };
      `,
      'src/runtime.ts': "export { msg } from 'gt-vue';",
      'shared/barrel.ts': "export { msg as translate } from '#runtime';",
      'src/message.ts': `
        import { translate } from '../shared/barrel';
        export const message = translate('Transitive aliased message');
      `,
    });

    const output = await extractFromVueProject({ cwd: root });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'Could not statically resolve the Vue application module aliases'
    );
  });

  function createAliasFixture(files: Record<string, string>): string {
    return createTestProject({
      'package.json': JSON.stringify({
        name: 'alias-provenance-fixture',
        private: true,
        dependencies: {
          'gt-react': '*',
          'gt-vue': '*',
        },
      }),
      'vite.config.ts': `
      const createAliases = () => ({ '#i18n': './src/i18n' });
      export default { resolve: { alias: createAliases() } };
    `,
      ...files,
    });
  }
});

describe('mergeVueProjectExtraction', () => {
  it('preserves primary ordering and combines diagnostics without deduplicating primary warnings', () => {
    const primaryUpdate = update('Primary', 'primary-hash', ['primary.tsx']);
    const vueUpdate = update('Vue', 'vue-hash', ['component.vue']);
    const primaryWarnings = [
      'shared warning',
      'primary warning',
      'shared warning',
    ];

    const result = mergeVueProjectExtraction(
      {
        updates: [primaryUpdate],
        errors: ['primary error'],
        warnings: primaryWarnings,
      },
      {
        updates: [vueUpdate],
        errors: ['vue error'],
        warnings: ['shared warning', 'vue warning'],
      }
    );

    expect(result.updates).toEqual([primaryUpdate, vueUpdate]);
    expect(result.errors).toEqual(['primary error', 'vue error']);
    expect(result.warnings).toEqual([
      'shared warning',
      'primary warning',
      'shared warning',
      'shared warning',
      'vue warning',
    ]);
    expect(primaryWarnings).toEqual([
      'shared warning',
      'primary warning',
      'shared warning',
    ]);
  });

  it('deduplicates hash collisions without mutating primary updates', () => {
    const primaryUpdate = update('Shared', 'shared-hash', ['primary.tsx']);
    const primarySnapshot = structuredClone(primaryUpdate);

    const result = mergeVueProjectExtraction(
      { updates: [primaryUpdate], errors: [], warnings: [] },
      {
        updates: [
          update('Shared', 'shared-hash', ['component.vue', 'primary.tsx']),
        ],
        errors: [],
        warnings: [],
      }
    );

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).not.toBe(primaryUpdate);
    expect(result.updates[0]?.metadata.filePaths).toEqual([
      'primary.tsx',
      'component.vue',
    ]);
    expect(primaryUpdate).toEqual(primarySnapshot);
  });

  it('merges source context into a copy for a matching Vue hash', () => {
    const duplicate = { before: 'before', target: 'target', after: 'after' };
    const distinct = { before: 'other', target: 'target', after: 'after' };
    const primaryUpdate = update('Shared', 'shared-hash', ['src/shared.tsx']);
    primaryUpdate.metadata.sourceCode = {
      'src/shared.tsx': [structuredClone(duplicate)],
    };
    const primarySourceCode = primaryUpdate.metadata.sourceCode;
    const primaryEntries = primarySourceCode['src/shared.tsx'];
    const vueUpdate = update('Shared', 'shared-hash', ['src/shared.tsx']);
    vueUpdate.metadata.sourceCode = {
      'src/shared.tsx': [structuredClone(duplicate), distinct],
    };

    const result = mergeVueProjectExtraction(
      { updates: [primaryUpdate], errors: [], warnings: [] },
      { updates: [vueUpdate], errors: [], warnings: [] }
    );

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]?.metadata.sourceCode).toEqual({
      'src/shared.tsx': [duplicate, distinct],
    });
    expect(primaryUpdate.metadata.sourceCode).toEqual({
      'src/shared.tsx': [duplicate],
    });
    expect(primaryUpdate.metadata.sourceCode).toBe(primarySourceCode);
    expect(primaryUpdate.metadata.sourceCode['src/shared.tsx']).toBe(
      primaryEntries
    );
    expect(result.updates[0]?.metadata.sourceCode).not.toBe(primarySourceCode);
  });

  function update(
    source: string,
    hash: string,
    filePaths: string[]
  ): VueProjectExtractionResult {
    return {
      dataFormat: 'STRING',
      source,
      metadata: { hash, filePaths },
    };
  }
});

/** Creates a disposable project that can resolve the installed Vue compiler. */
function createLinkedProject(files: Record<string, string>): string {
  const root = createTestProject(files);
  linkInstalledVue(root);
  return root;
}

function createWorkspaceFixture(files: Record<string, string>): string {
  return createLinkedProject({
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
