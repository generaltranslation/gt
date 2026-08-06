import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVueInlineUpdates } from '../createVueInlineUpdates.js';
import { linkTestVueInstallation } from './testVueInstallation.js';

const temporaryDirectories: string[] = [];
const parsingFlags = {
  autoderive: false,
  enableAutoJsxInjection: false,
  includeSourceCodeContext: false,
  legacyGtReactImportSource: false,
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('workspace Vue extraction', () => {
  it('extracts a Vue workspace selected by root-level library detection', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-vue-workspace-integration-')
    );
    temporaryDirectories.push(projectRoot);
    linkTestVueInstallation(projectRoot);
    const appDirectory = path.join(projectRoot, 'apps', 'vue');
    const sourceFile = path.join(appDirectory, 'src', 'App.vue');
    fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ private: true, workspaces: ['apps/*'] })
    );
    fs.writeFileSync(
      path.join(appDirectory, 'package.json'),
      JSON.stringify({ dependencies: { 'gt-vue': '0.0.0' } })
    );
    fs.writeFileSync(
      sourceFile,
      `<script setup>
        import { useGT } from 'gt-vue';
        const gt = useGT();
      </script>
      <template>{{ gt('Workspace source') }}</template>`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags);

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(output.updates).toEqual([
      expect.objectContaining({
        dataFormat: 'STRING',
        source: 'Workspace source',
        metadata: expect.objectContaining({
          filePaths: ['apps/vue/src/App.vue'],
          hash: expect.any(String),
        }),
      }),
    ]);
  });

  it('resolves gt-vue reexports through a workspace tsconfig path alias', async () => {
    const projectRoot = createWorkspaceRoot();
    const appDirectory = path.join(projectRoot, 'apps', 'vue');
    const sourceDirectory = path.join(appDirectory, 'src');
    fs.mkdirSync(path.join(sourceDirectory, 'i18n'), { recursive: true });
    writeJson(path.join(appDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    writeJson(path.join(appDirectory, 'tsconfig.json'), {
      compilerOptions: {
        baseUrl: '.',
        paths: { '@i18n': ['src/i18n/index.ts'] },
      },
    });
    fs.writeFileSync(
      path.join(sourceDirectory, 'i18n', 'index.ts'),
      `export { T as Translate, msg as defineMessage } from 'gt-vue';`
    );
    fs.writeFileSync(
      path.join(sourceDirectory, 'App.vue'),
      `<script setup>
import { Translate, defineMessage } from '@i18n';
defineMessage('CLI alias message');
</script>
<template><Translate>CLI alias rich text</Translate></template>`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags, {
      conditionNames: ['import', 'default'],
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'CLI alias message',
      'CLI alias rich text',
    ]);
  });

  it('uses the compiler options owned by each Vue workspace', async () => {
    const projectRoot = createWorkspaceRoot();
    const appDirectory = path.join(projectRoot, 'apps', 'vue');
    fs.mkdirSync(path.join(appDirectory, 'src'), { recursive: true });
    writeJson(path.join(appDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(appDirectory, 'vite.config.ts'),
      `import vue from '@vitejs/plugin-vue';
export default { plugins: [vue({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })] };`
    );
    fs.writeFileSync(
      path.join(appDirectory, 'src', 'App.vue'),
      `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
</script>
<template>[[ gt('Workspace delimiters') ]]</template>`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags);

    expect(output.errors).toEqual([]);
    expect(output.updates).toEqual([
      expect.objectContaining({
        dataFormat: 'STRING',
        source: 'Workspace delimiters',
      }),
    ]);
  });

  it('keeps compiler options isolated across multiple Vue workspaces', async () => {
    const projectRoot = createWorkspaceRoot();
    const customDirectory = path.join(projectRoot, 'apps', 'custom');
    fs.mkdirSync(path.join(customDirectory, 'src'), { recursive: true });
    writeJson(path.join(customDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(customDirectory, 'vite.config.ts'),
      `import vue from '@vitejs/plugin-vue';
export default { plugins: [vue({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })] };`
    );
    fs.writeFileSync(
      path.join(customDirectory, 'src', 'App.vue'),
      vueCall('[[', ']]', 'Custom workspace')
    );

    const standardDirectory = path.join(projectRoot, 'apps', 'standard');
    fs.mkdirSync(path.join(standardDirectory, 'src'), { recursive: true });
    writeJson(path.join(standardDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(standardDirectory, 'src', 'App.vue'),
      vueCall('{{', '}}', 'Standard workspace')
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags);

    expect(output.errors).toEqual([]);
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'Custom workspace',
      'Standard workspace',
    ]);
  });

  it('applies an explicit Vite config only to its owning workspace', async () => {
    const projectRoot = createWorkspaceRoot();
    const selectedDirectory = path.join(projectRoot, 'apps', 'selected');
    fs.mkdirSync(path.join(selectedDirectory, 'src'), { recursive: true });
    writeJson(path.join(selectedDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(selectedDirectory, 'vite.config.ts'),
      `import vue from '@vitejs/plugin-vue';
export default { plugins: [vue({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })] };`
    );
    fs.writeFileSync(
      path.join(selectedDirectory, 'src', 'App.vue'),
      vueCall('[[', ']]', 'Selected config')
    );

    const defaultDirectory = path.join(projectRoot, 'apps', 'default');
    fs.mkdirSync(path.join(defaultDirectory, 'src'), { recursive: true });
    writeJson(path.join(defaultDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(defaultDirectory, 'src', 'App.vue'),
      vueCall('{{', '}}', 'Default config')
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, {
      ...parsingFlags,
      viteConfigPath: 'apps/selected/vite.config.ts',
    });

    expect(output.errors).toEqual([]);
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'Default config',
      'Selected config',
    ]);
  });

  it('allows one workspace to use a centrally located explicit config', async () => {
    const projectRoot = createWorkspaceRoot();
    const configDirectory = path.join(projectRoot, 'config');
    fs.mkdirSync(configDirectory);
    fs.writeFileSync(
      path.join(configDirectory, 'vue.ts'),
      `import vue from '@vitejs/plugin-vue';
export default { plugins: [vue({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })] };`
    );
    const appDirectory = path.join(projectRoot, 'apps', 'vue');
    fs.mkdirSync(path.join(appDirectory, 'src'), { recursive: true });
    writeJson(path.join(appDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(appDirectory, 'src', 'App.vue'),
      vueCall('[[', ']]', 'Central config')
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, {
      ...parsingFlags,
      viteConfigPath: 'config/vue.ts',
    });

    expect(output.errors).toEqual([]);
    expect(output.updates).toEqual([
      expect.objectContaining({ source: 'Central config' }),
    ]);
  });

  it.each(['missing.config.ts', '../outside.config.ts'])(
    'rejects an invalid explicit Vite config path %s before extraction',
    async (viteConfigPath) => {
      const projectRoot = createWorkspaceRoot();
      writeVueWorkspace(
        path.join(projectRoot, 'apps', 'vue'),
        'Must not extract',
        true
      );
      vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

      const output = await createVueInlineUpdates(undefined, {
        ...parsingFlags,
        viteConfigPath,
      });

      expect(output.updates).toEqual([]);
      expect(output.errors).not.toEqual([]);
    }
  );

  it('rejects a root config that is ambiguous across multiple Vue workspaces', async () => {
    const projectRoot = createWorkspaceRoot();
    fs.writeFileSync(
      path.join(projectRoot, 'vite.config.ts'),
      `import vue from '@vitejs/plugin-vue'; export default { plugins: [vue()] };`
    );
    writeVueWorkspace(
      path.join(projectRoot, 'apps', 'first'),
      'First workspace',
      true
    );
    writeVueWorkspace(
      path.join(projectRoot, 'apps', 'second'),
      'Second workspace',
      true
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, {
      ...parsingFlags,
      viteConfigPath: 'vite.config.ts',
    });

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'does not own any matched Vue sources'
    );
  });

  it('does not require compiler config resolution for script-only extraction', async () => {
    const projectRoot = createWorkspaceRoot();
    const sourceDirectory = path.join(projectRoot, 'src');
    fs.mkdirSync(sourceDirectory);
    fs.writeFileSync(
      path.join(sourceDirectory, 'messages.ts'),
      `import { useGT } from 'gt-vue';
const gt = useGT();
gt('Script only');`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, {
      ...parsingFlags,
      viteConfigPath: 'missing.config.ts',
    });

    expect(output.errors).toEqual([]);
    expect(output.updates).toEqual([
      expect.objectContaining({ source: 'Script only' }),
    ]);
  });

  it('rejects unsupported JSX transforms in a TSX-only Vue workspace', async () => {
    const projectRoot = createWorkspaceRoot();
    const appDirectory = path.join(projectRoot, 'apps', 'vue');
    fs.mkdirSync(path.join(appDirectory, 'src'), { recursive: true });
    writeJson(path.join(appDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(appDirectory, 'vite.config.ts'),
      `import vueJsx from '@vitejs/plugin-vue-jsx';
export default { plugins: [vueJsx({ babelPlugins: [rewriteJSXText] })] };`
    );
    fs.writeFileSync(
      path.join(appDirectory, 'src', 'View.tsx'),
      `import { T } from 'gt-vue';
export const View = () => <T>Must not publish</T>;`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags);

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toContain(
      'unsupported @vitejs/plugin-vue-jsx option "babelPlugins"'
    );
  });

  it('preserves TSX extraction for supported Vue JSX options', async () => {
    const projectRoot = createWorkspaceRoot();
    const appDirectory = path.join(projectRoot, 'apps', 'vue');
    fs.mkdirSync(path.join(appDirectory, 'src'), { recursive: true });
    writeJson(path.join(appDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(appDirectory, 'vite.config.ts'),
      `import vueJsx from '@vitejs/plugin-vue-jsx';
export default { plugins: [vueJsx({ babelPlugins: [], optimize: true })] };`
    );
    fs.writeFileSync(
      path.join(appDirectory, 'src', 'View.tsx'),
      `import { T } from 'gt-vue';
export const View = () => <T context="card">Supported TSX</T>;`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags);

    expect(output.errors).toEqual([]);
    expect(output.updates).toEqual([
      expect.objectContaining({
        dataFormat: 'JSX',
        source: 'Supported TSX',
        metadata: expect.objectContaining({ context: 'card' }),
      }),
    ]);
  });

  it('fails atomically when one workspace compiler configuration is unsafe', async () => {
    const projectRoot = createWorkspaceRoot();
    const unsafeDirectory = path.join(projectRoot, 'apps', 'unsafe');
    fs.mkdirSync(path.join(unsafeDirectory, 'src'), { recursive: true });
    writeJson(path.join(unsafeDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(unsafeDirectory, 'vite.config.ts'),
      `import vue from '@vitejs/plugin-vue';
const delimiters = getDelimiters();
export default { plugins: [vue({ template: { compilerOptions: { delimiters } } })] };`
    );
    fs.writeFileSync(
      path.join(unsafeDirectory, 'src', 'App.vue'),
      vueCall('{{', '}}', 'Unsafe workspace')
    );

    const validDirectory = path.join(projectRoot, 'apps', 'valid');
    writeVueWorkspace(validDirectory, 'Must not publish partially', true);
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags);

    expect(output.updates).toEqual([]);
    expect(output.errors.join('\n')).toMatch(/compiler|delimiter|dynamic/i);
  });

  it('escapes metacharacters in declared workspace directory names', async () => {
    const projectRoot = createWorkspaceRoot();
    const declaredDirectory = path.join(projectRoot, 'apps', 'vue[1]');
    const unrelatedDirectory = path.join(projectRoot, 'apps', 'vue1');
    writeVueWorkspace(declaredDirectory, 'Declared workspace', true);
    writeVueWorkspace(unrelatedDirectory, 'Unrelated workspace', false);
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags);

    expect(output.errors).toEqual([]);
    expect(output.updates.map((update) => update.source)).toEqual([
      'Declared workspace',
    ]);
  });

  it.skipIf(process.platform === 'win32')(
    'does not follow default source globs through symlinks outside the project',
    async () => {
      const projectRoot = createWorkspaceRoot();
      const outsideDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gt-vue-outside-source-')
      );
      temporaryDirectories.push(outsideDirectory);
      const appDirectory = path.join(projectRoot, 'apps', 'vue');
      fs.mkdirSync(appDirectory, { recursive: true });
      writeJson(path.join(appDirectory, 'package.json'), {
        dependencies: { 'gt-vue': '0.0.0' },
      });
      fs.writeFileSync(
        path.join(outsideDirectory, 'Outside.vue'),
        `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
gt('Outside symlink source');
</script>`
      );
      fs.symlinkSync(outsideDirectory, path.join(appDirectory, 'src'), 'dir');
      vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

      const output = await createVueInlineUpdates(undefined, parsingFlags);

      expect(output).toEqual({ updates: [], errors: [], warnings: [] });
    }
  );
});

function createWorkspaceRoot(): string {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'gt-vue-workspace-integration-')
  );
  temporaryDirectories.push(projectRoot);
  linkTestVueInstallation(projectRoot);
  writeJson(path.join(projectRoot, 'package.json'), {
    private: true,
    workspaces: ['apps/*'],
  });
  return projectRoot;
}

function writeVueWorkspace(
  directory: string,
  source: string,
  declaresGtVue: boolean
): void {
  fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
  writeJson(
    path.join(directory, 'package.json'),
    declaresGtVue ? { dependencies: { 'gt-vue': '0.0.0' } } : {}
  );
  fs.writeFileSync(
    path.join(directory, 'src', 'App.vue'),
    `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
gt(${JSON.stringify(source)});
</script>`
  );
}

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, JSON.stringify(value));
}

function vueCall(open: string, close: string, source: string): string {
  return `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
</script>
<template>${open} gt(${JSON.stringify(source)}) ${close}</template>`;
}
