import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectVueProject } from '../../detect.js';
import { extractFromVueProject } from '../../project.js';
import {
  createProjectFixture,
  linkInstalledVue,
  removeProjectFixture,
  translatableSfc,
  writePackageJson,
} from './projectTestUtils.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    removeProjectFixture(directory);
  }
});

describe('detectVueProject', () => {
  it.each([
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ] as const)('detects a root declaration in %s', (field) => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'root-vue-app',
        [field]: { 'gt-vue': 'workspace:*' },
      }),
    });

    expect(detectVueProject(root)).toBe(true);
  });

  it('fails safely for missing and malformed project manifests', () => {
    const missing = createFixture({});
    const malformed = createFixture({ 'package.json': '{not-json' });

    expect(detectVueProject(missing)).toBe(false);
    expect(detectVueProject(malformed)).toBe(false);
    expect(detectVueProject(path.join(missing, 'does-not-exist'))).toBe(false);
  });

  it('detects a workspace-only Vue app without selecting the aggregator root', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['apps/*'],
      }),
      'app.vue': translatableSfc('Root must stay out'),
      'apps/vue/package.json': JSON.stringify({
        name: 'workspace-vue-app',
        dependencies: { 'gt-vue': 'workspace:*' },
      }),
      'apps/vue/src/App.vue': translatableSfc('Workspace message'),
    });
    linkInstalledVue(root);

    expect(detectVueProject(root)).toBe(true);
    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Workspace message',
    ]);
  });

  it('selects reverse consumers of a local wrapper while excluding the root', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['packages/*', 'apps/*'],
      }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@fixture/vue-wrapper': ['packages/vue-wrapper/src/index.ts'],
          },
        },
      }),
      'app.vue': translatableSfc('Aggregator root message'),
      'packages/vue-wrapper/package.json': JSON.stringify({
        name: '@fixture/vue-wrapper',
        dependencies: { 'gt-vue': 'workspace:*' },
      }),
      'packages/vue-wrapper/src/index.ts':
        "export { T as WrapperT } from 'gt-vue';\n",
      'apps/docs/package.json': JSON.stringify({
        name: '@fixture/docs',
        dependencies: { '@fixture/vue-wrapper': 'workspace:*' },
      }),
      'apps/docs/src/App.vue': `<script setup lang="ts">
import { WrapperT } from '@fixture/vue-wrapper';
</script>
<template><WrapperT>Wrapper consumer</WrapperT></template>
`,
    });
    linkInstalledVue(root);

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Wrapper consumer',
    ]);
  });

  it('selects workspace consumers when the root package is the gt-vue wrapper', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: '@fixture/root-vue-wrapper',
        private: true,
        workspaces: ['apps/*'],
        dependencies: { 'gt-vue': 'workspace:*' },
      }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@fixture/root-vue-wrapper': ['src/index.ts'],
          },
        },
      }),
      'src/index.ts': "export { T as WrapperT } from 'gt-vue';\n",
      'apps/docs/package.json': JSON.stringify({
        name: '@fixture/docs',
        dependencies: { '@fixture/root-vue-wrapper': 'workspace:*' },
      }),
      'apps/docs/src/App.vue': `<script setup lang="ts">
import { WrapperT } from '@fixture/root-vue-wrapper';
</script>
<template><WrapperT>Root wrapper consumer</WrapperT></template>
`,
    });
    linkInstalledVue(root);

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Root wrapper consumer',
    ]);
  });

  it('treats a valid pnpm workspace file as authoritative', () => {
    const emptyPnpmRoot = createFixture({
      'package.json': JSON.stringify({
        private: true,
        workspaces: ['stale'],
      }),
      'pnpm-workspace.yaml': 'packages: []\n',
      'stale/package.json': JSON.stringify({
        name: 'stale-vue-app',
        dependencies: { 'gt-vue': '*' },
      }),
    });
    const excludedPnpmRoot = createFixture({
      'package.json': JSON.stringify({
        private: true,
        workspaces: ['packages/*'],
      }),
      'pnpm-workspace.yaml':
        "packages:\n  - 'packages/*'\n  - '!packages/excluded'\n",
      'packages/excluded/package.json': JSON.stringify({
        name: 'excluded-vue-app',
        dependencies: { 'gt-vue': '*' },
      }),
      'packages/ordinary/package.json': JSON.stringify({
        name: 'ordinary-package',
      }),
    });

    expect(detectVueProject(emptyPnpmRoot)).toBe(false);
    expect(detectVueProject(excludedPnpmRoot)).toBe(false);
  });

  it.each([
    ['malformed YAML', 'packages: [\n'],
    ['invalid packages shape', 'packages: stale\n'],
  ])(
    'does not fall back to package.json workspaces for %s in pnpm-workspace.yaml',
    (_name, workspaceFile) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          private: true,
          workspaces: ['stale'],
        }),
        'pnpm-workspace.yaml': workspaceFile,
        'stale/package.json': JSON.stringify({
          name: 'stale-vue-app',
          dependencies: { 'gt-vue': '*' },
        }),
      });

      expect(detectVueProject(root)).toBe(false);
    }
  );

  it('rejects workspace patterns that could escape the project root', () => {
    const outside = createFixture({
      'package.json': JSON.stringify({
        name: 'outside-vue-app',
        dependencies: { 'gt-vue': '*' },
      }),
    });
    const root = createFixture({});
    const outsideName = path.basename(outside);
    writePackageJson(root, '', {
      name: 'workspace-root',
      private: true,
      workspaces: [
        `../${outsideName}`,
        `{packages/safe,../${outsideName}}`,
        '/tmp/**',
        'C:\\outside\\*',
        42,
      ],
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('escapes glob metacharacters in discovered package directories', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['packages/*'],
      }),
      'packages/vue[docs]/package.json': JSON.stringify({
        name: '@fixture/vue-docs',
        dependencies: { 'gt-vue': '*' },
      }),
      'packages/vue[docs]/app.vue': translatableSfc(
        'Literal bracket directory'
      ),
    });
    linkInstalledVue(root);

    expect(detectVueProject(root)).toBe(true);
    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Literal bracket directory',
    ]);
  });

  it('does not load parser, compiler, or project extraction modules from /detect', () => {
    const detectEntry = path.resolve(__dirname, '../../detect.ts');
    const localGraph = collectLocalModuleGraph(detectEntry);
    const relativeGraph = [...localGraph].map((file) =>
      path.relative(path.resolve(__dirname, '../..'), file)
    );
    const graphSource = [...localGraph]
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');

    expect(relativeGraph).not.toContain('project.ts');
    expect(relativeGraph).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('/config/'),
        expect.stringContaining('/script/'),
        expect.stringContaining('/template/'),
      ])
    );
    expect(graphSource).not.toMatch(
      /from ['"](?:@babel|@vue|#vue-compiler-sfc|\.\/internal\/extractFromVueSource)/
    );
  });
});

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  return root;
}

function collectLocalModuleGraph(entry: string): Set<string> {
  const visited = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const specifier = match[1];
      if (!specifier) continue;
      const resolved = path.resolve(
        path.dirname(file),
        specifier.replace(/\.js$/, '.ts')
      );
      if (fs.existsSync(resolved)) pending.push(resolved);
    }
  }
  return visited;
}
