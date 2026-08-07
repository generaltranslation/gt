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

  it('appends only owned descendant Vue sources to the unchanged React scope', async () => {
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
    expect(detectVueProject()).toBe(false);

    const output = await dispatchDetected(detection.library);

    expect(output.errors).toEqual([]);
    expect(sources(output)).toEqual([
      'Root React message',
      'Owned Vue message',
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
        dependencies: { 'gt-react': '*', 'gt-vue': '*' },
      }),
      'apps/react/src/App.tsx': reactMessage('Child React message'),
    });

    const detection = determineLibrary();

    expect(detection).toEqual({ library: 'base', additionalModules: [] });
    expect(isInlineLibrary(detection.library)).toBe(false);
    expect(detectVueProject()).toBe(false);
  });

  it('keeps a file-only root file-only when a child declares gt-vue', () => {
    createVueFixture({
      'package.json': packageJson({
        private: true,
        workspaces: ['apps/*'],
      }),
      'locales/en.json': JSON.stringify({ title: 'File-only title' }),
      'apps/vue/package.json': vuePackageJson('child-vue'),
      'apps/vue/src/App.vue': translatableSfc('Child Vue message'),
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
    expect(sources(output)).toEqual([
      'Root React only',
      'Owned workspace Vue message',
    ]);
  });

  it('appends owned descendant Vue sources to the unchanged Node scope', async () => {
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
    expect(sources(output)).toEqual([
      'Root Node message',
      'Node companion Vue message',
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
    expect(sources(output)).toEqual([
      'React with dynamic config',
      'Scoped Vue config message',
    ]);
  });

  it('preserves historical parsing for explicitly selected .vue files', async () => {
    createVueFixture({
      'package.json': packageJson({
        private: true,
        workspaces: ['apps/*'],
        dependencies: { 'gt-react': '*', 'gt-vue': '*' },
      }),
      'src/Legacy.vue': reactMessage('Legacy React module'),
      'apps/vue/package.json': vuePackageJson('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Unselected Vue message'),
    });

    const detection = determineLibrary();
    const historical = await createInlineUpdates(
      Libraries.GT_REACT,
      false,
      ['src/Legacy.vue'],
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );
    const output = await dispatchDetected(detection.library, [
      'src/Legacy.vue',
    ]);

    expect(detection.library).toBe(Libraries.GT_REACT);
    expect(detectVueProject()).toBe(true);
    expect(output).toEqual(historical);
    expect(sources(output)).toEqual(['Legacy React module']);
  });

  it('preserves Babel-valid standard-tag legacy .vue modules', async () => {
    createVueFixture({
      'package.json': packageJson({
        dependencies: { 'gt-react': '*', 'gt-vue': '*' },
      }),
      'src/Leading.vue': `
        <template><T>Leading standard-tag module</T></template>;
        import { T } from 'gt-react';
      `,
      'src/TextPrefixed.vue': `
        'Copyright 2026';
        <template><T>Text-prefixed standard-tag module</T></template>;
        import { T } from 'gt-react';
      `,
    });
    const patterns = ['src/*.vue'];
    const historical = await createInlineUpdates(
      Libraries.GT_REACT,
      false,
      patterns,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );
    const output = await extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      patterns,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(output).toEqual(historical);
    expect(output.errors).toEqual([]);
    expect(sources(output).sort()).toEqual([
      'Leading standard-tag module',
      'Text-prefixed standard-tag module',
    ]);
  });

  it('preserves auto-JSX messages in ambiguous standard-tag .vue modules', async () => {
    createVueFixture({
      'package.json': packageJson({
        dependencies: { 'gt-react': '*', 'gt-vue': '*' },
      }),
      'src/Template.vue': '<template>Template auto JSX message</template>;',
      'src/Script.vue': '<script>Script auto JSX message</script>;',
      'src/Style.vue': '<style>Style auto JSX message</style>;',
    });
    const patterns = ['src/*.vue'];
    const flags = {
      ...GT_PARSING_FLAGS_DEFAULT,
      enableAutoJsxInjection: true,
    };
    const historical = await createInlineUpdates(
      Libraries.GT_REACT,
      false,
      patterns,
      flags,
      parsingOptions
    );

    const output = await extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      patterns,
      flags,
      parsingOptions
    );

    expect(output).toEqual(historical);
    expect(output.errors).toEqual([]);
    expect(sources(output).sort()).toEqual([
      'Script auto JSX message',
      'Style auto JSX message',
      'Template auto JSX message',
    ]);
  });

  it('partitions real SFCs from legacy JSX across explicit mixed patterns', async () => {
    createVueFixture({
      'package.json': packageJson({
        dependencies: { 'gt-react': '*', 'gt-vue': '*' },
      }),
      'src/App.tsx': reactMessage('React TSX module'),
      'src/Legacy.vue': reactMessage('React legacy module'),
      'src/VueApp.vue': `<i18n lang="json">
{"en":{"title":"Localized"}}
</i18n>
${translatableSfc('Vue SFC message')}`,
      'src/TextPrefixed.vue': `Copyright Fixture
${translatableSfc('Text-prefixed Vue SFC message')}`,
    });

    const output = await extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      ['src/**/*.{tsx,vue}'],
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(output.errors).toEqual([]);
    expect(sources(output).sort()).toEqual([
      'React TSX module',
      'React legacy module',
      'Text-prefixed Vue SFC message',
      'Vue SFC message',
    ]);
  });

  it('partitions an explicitly selected absolute SFC path', async () => {
    const root = createVueFixture({
      'package.json': packageJson({
        dependencies: { 'gt-react': '*', 'gt-vue': '*' },
      }),
      'src/App.vue': translatableSfc('Absolute Vue SFC message'),
    });

    const output = await extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      [path.join(root, 'src/App.vue')],
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );

    expect(output.errors).toEqual([]);
    expect(sources(output)).toEqual(['Absolute Vue SFC message']);
  });

  it('ignores optional Vue peers in a sibling React workspace', async () => {
    createFixture({
      'package.json': packageJson({
        private: true,
        workspaces: ['apps/*'],
        dependencies: { 'gt-react': '*' },
      }),
      'src/App.tsx': reactMessage('Stable React root'),
      'apps/optional/package.json': packageJson({
        name: 'optional-vue-integration',
        optionalDependencies: { 'gt-vue': '*' },
        peerDependencies: { vue: '^3.5.0' },
      }),
      'apps/optional/src/App.vue': translatableSfc('Optional Vue message'),
      'node_modules/gt-vue/package.json': JSON.stringify({
        name: 'gt-vue',
        version: '0.1.0',
        type: 'module',
        main: 'index.js',
      }),
      'node_modules/gt-vue/index.js': 'export const T = {}\n',
    });

    const output = await dispatchDetected(Libraries.GT_REACT);

    expect(detectVueProject()).toBe(false);
    expect(output.errors).toEqual([]);
    expect(sources(output)).toEqual(['Stable React root']);
  });

  it('does not apply Vue config to targeted React-only validation', async () => {
    createFixture({
      'package.json': packageJson({
        private: true,
        workspaces: ['apps/*'],
        dependencies: { 'gt-react': '*' },
      }),
      'src/App.tsx': reactMessage('Targeted React message'),
      'vite.config.ts': `export default ({ mode }) => mode === 'test' ? {} : {};`,
      'apps/vue/package.json': vuePackageJson('vue-app'),
      'apps/vue/src/App.vue': translatableSfc('Separate Vue message'),
    });

    const output = await extractInlineFromProject(
      Libraries.GT_REACT,
      true,
      ['src/App.tsx'],
      { ...GT_PARSING_FLAGS_DEFAULT, viteConfigPath: 'vite.config.ts' },
      parsingOptions
    );

    expect(output.errors).toEqual([]);
    expect(sources(output)).toEqual(['Targeted React message']);
  });

  it('keeps one project root when cwd changes while extraction starts', async () => {
    const projectA = createProjectFixture({
      'package.json': packageJson({ dependencies: { 'gt-react': '*' } }),
      'src/App.tsx': reactMessage('Project A React message'),
    });
    const projectB = createProjectFixture({
      'package.json': packageJson({ dependencies: { 'gt-vue': '*' } }),
      'src/App.vue': translatableSfc('Project B Vue message'),
    });
    temporaryDirectories.push(projectA, projectB);
    linkInstalledVue(projectB);
    process.chdir(projectA);

    const outputPromise = extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      undefined,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );
    process.chdir(projectB);
    const output = await outputPromise;

    expect(output.errors).toEqual([]);
    expect(sources(output)).toEqual(['Project A React message']);
  });

  it('anchors explicit patterns when cwd changes during Vue inspection', async () => {
    const projectA = createProjectFixture({
      'package.json': packageJson({ dependencies: { 'gt-react': '*' } }),
      'src/App.tsx': reactMessage('Project A explicit message'),
      'src/Excluded.tsx': reactMessage('Project A excluded message'),
    });
    const projectB = createProjectFixture({
      'package.json': packageJson({ dependencies: { 'gt-react': '*' } }),
      'src/App.tsx': reactMessage('Project B explicit message'),
    });
    temporaryDirectories.push(projectA, projectB);
    const explicitPatterns = ['src/**/*.{ts,tsx}', '!src/**/Excluded.tsx'];

    process.chdir(projectA);
    const historicalPromise = createInlineUpdates(
      Libraries.GT_REACT,
      false,
      explicitPatterns,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );
    process.chdir(projectB);
    const historical = await historicalPromise;

    process.chdir(projectA);
    const outputPromise = extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      explicitPatterns,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );
    process.chdir(projectB);
    const output = await outputPromise;

    expect(output).toEqual(historical);
    expect(output.errors).toEqual([]);
    expect(sources(output)).toEqual(['Project A explicit message']);
  });

  it('anchors the historical half of an explicitly selected mixed project', async () => {
    const projectA = createProjectFixture({
      'package.json': packageJson({
        dependencies: { 'gt-react': '*', 'gt-vue': '*' },
      }),
      'src/App.tsx': reactMessage('Project A mixed React message'),
      'src/Excluded.tsx': reactMessage('Project A mixed excluded message'),
      'src/App.vue': translatableSfc('Project A mixed Vue message'),
    });
    const projectB = createProjectFixture({
      'package.json': packageJson({ dependencies: { 'gt-react': '*' } }),
      'src/App.tsx': reactMessage('Project B mixed-race message'),
    });
    temporaryDirectories.push(projectA, projectB);
    linkInstalledVue(projectA);
    const explicitPatterns = ['src/**/*.{ts,tsx,vue}', '!src/**/Excluded.tsx'];
    process.chdir(projectA);

    const outputPromise = extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      explicitPatterns,
      GT_PARSING_FLAGS_DEFAULT,
      parsingOptions
    );
    process.chdir(projectB);
    const output = await outputPromise;

    expect(output.errors).toEqual([]);
    expect(sources(output)).toEqual([
      'Project A mixed React message',
      'Project A mixed Vue message',
    ]);
  });

  it('does not resolve Vue config before proving ownership in a mixed root', async () => {
    createVueFixture({
      'package.json': packageJson({
        dependencies: { 'gt-react': '*', 'gt-vue': '*', vite: '*' },
      }),
      'src/App.tsx': reactMessage('Mixed root React message'),
      'vite.config.ts': `
        export default ({ mode }) => ({
          resolve: { alias: mode === 'test' ? { '@app': '/one' } : { '@app': '/two' } },
        });
      `,
    });
    const flags = {
      ...GT_PARSING_FLAGS_DEFAULT,
      viteConfigPath: 'vite.config.ts',
    };
    const historical = await createInlineUpdates(
      Libraries.GT_REACT,
      true,
      ['src/App.tsx'],
      flags,
      parsingOptions
    );

    const output = await extractInlineFromProject(
      Libraries.GT_REACT,
      true,
      ['src/App.tsx'],
      flags,
      parsingOptions
    );

    expect(output).toEqual(historical);
    expect(output.errors).toEqual([]);
    expect(sources(output)).toEqual(['Mixed root React message']);
  });

  it('deduplicates identical source context for a mixed-runtime hash', async () => {
    createVueFixture({
      'package.json': packageJson({
        dependencies: { 'gt-react': '*', 'gt-vue': '*' },
      }),
      'src/App.tsx': `
        import { T } from 'gt-react'; import { T as VueT } from 'gt-vue';
        export const App = () => <><T>Shared message</T><VueT>Shared message</VueT></>;
      `,
    });

    const output = await extractInlineFromProject(
      Libraries.GT_REACT,
      false,
      undefined,
      { ...GT_PARSING_FLAGS_DEFAULT, includeSourceCodeContext: true },
      parsingOptions
    );

    expect(output.errors).toEqual([]);
    expect(output.updates).toHaveLength(1);
    const sourceCode = output.updates[0]?.metadata.sourceCode as
      | Record<string, unknown[]>
      | undefined;
    expect(sourceCode?.['src/App.tsx']).toHaveLength(1);
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
