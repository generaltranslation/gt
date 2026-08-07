import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectVueProject } from '../../detect.js';
import {
  inspectVueProject,
  readVueSfcExclusionPatterns,
} from '../../inspect.js';
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
  it.each(['dependencies', 'devDependencies'] as const)(
    'detects an installed root declaration in %s',
    (field) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: 'root-vue-app',
          [field]: { 'gt-vue': 'workspace:*' },
        }),
      });

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it.each(['optionalDependencies', 'peerDependencies'] as const)(
    'does not treat an unresolved %s declaration as an installed Vue application',
    (field) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: 'root-vue-library',
          [field]: { 'gt-vue': 'workspace:*' },
        }),
      });

      expect(detectVueProject(root)).toBe(false);
    }
  );

  it.each(['optionalDependencies', 'peerDependencies'] as const)(
    'detects a resolvable root declaration in %s',
    (field) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: 'root-vue-library',
          [field]: { 'gt-vue': '*' },
        }),
        'node_modules/gt-vue/package.json': JSON.stringify({
          name: 'gt-vue',
          version: '0.1.0',
          type: 'module',
          main: 'index.js',
        }),
        'node_modules/gt-vue/index.js': 'export const T = {}\n',
      });

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it('does not let a workspace descendant select the root CLI mode', async () => {
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

    expect(detectVueProject(root)).toBe(false);
    const inspection = inspectVueProject(root);
    expect(inspection).toMatchObject({
      projectRoot: fs.realpathSync(root),
      rootOwnsVue: false,
      hasVueScopes: true,
    });
    fs.writeFileSync(path.join(root, 'package.json'), '{changed-after-plan');
    const output = await extractFromVueProject({ cwd: root, inspection });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Workspace message',
    ]);
  });

  it('partitions real child SFCs without hiding legacy JSX .vue modules', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['apps/*'],
      }),
      'src/Legacy.vue': `
        import { T } from 'gt-react';
        export const legacy = <T>Legacy React module</T>;
      `,
      'apps/vue/package.json': JSON.stringify({
        name: 'workspace-vue-app',
        dependencies: { 'gt-vue': 'workspace:*' },
      }),
      'apps/vue/src/App.vue': translatableSfc('Workspace message'),
      'apps/vue/src/Localized.vue': `<i18n lang="json">
{"en":{"title":"Localized"}}
</i18n>
${translatableSfc('Custom-block workspace message')}`,
      'apps/vue/src/TextPrefixed.vue': `Copyright Fixture
${translatableSfc('Text-prefixed workspace message')}`,
    });

    const inspection = inspectVueProject(root);

    const exclusions = readVueSfcExclusionPatterns(inspection, [
      'src/Legacy.vue',
      'apps/vue/src/App.vue',
      'apps/vue/src/Localized.vue',
      'apps/vue/src/TextPrefixed.vue',
    ]).map((pattern) => pattern.split(path.sep).join(path.posix.sep));
    const normalizedRoot = fs
      .realpathSync(root)
      .split(path.sep)
      .join(path.posix.sep);

    expect(exclusions).toEqual([
      `!${normalizedRoot}/apps/vue/src/App.vue`,
      `!${normalizedRoot}/apps/vue/src/Localized.vue`,
      `!${normalizedRoot}/apps/vue/src/TextPrefixed.vue`,
    ]);
  });

  it('fails safely for missing and malformed project manifests', () => {
    const missing = createFixture({});
    const malformed = createFixture({ 'package.json': '{not-json' });

    expect(detectVueProject(missing)).toBe(false);
    expect(detectVueProject(malformed)).toBe(false);
    expect(detectVueProject(path.join(missing, 'does-not-exist'))).toBe(false);
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

  it('does not select consumers whose range excludes the local wrapper', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['packages/*', 'apps/*'],
      }),
      'packages/vue-wrapper/package.json': JSON.stringify({
        name: '@fixture/vue-wrapper',
        version: '1.0.0',
        dependencies: { 'gt-vue': 'workspace:*' },
      }),
      'apps/docs/package.json': JSON.stringify({
        name: '@fixture/docs',
        dependencies: { '@fixture/vue-wrapper': '^2.0.0' },
      }),
      'apps/docs/src/App.vue': translatableSfc('Wrong wrapper version'),
    });
    linkInstalledVue(root);

    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it.each(['^1.0.0', 'workspace:^', 'workspace:*'])(
    'selects a consumer whose %s range includes the local wrapper',
    async (specifier) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: 'workspace-root',
          private: true,
          workspaces: ['packages/*', 'apps/*'],
        }),
        'packages/vue-wrapper/package.json': JSON.stringify({
          name: '@fixture/vue-wrapper',
          version: '1.4.0',
          dependencies: { 'gt-vue': 'workspace:*' },
        }),
        'apps/docs/package.json': JSON.stringify({
          name: '@fixture/docs',
          dependencies: { '@fixture/vue-wrapper': specifier },
        }),
        'apps/docs/src/App.vue': translatableSfc('Compatible wrapper version'),
      });
      linkInstalledVue(root);

      const output = await extractFromVueProject({ cwd: root });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source)).toEqual([
        'Compatible wrapper version',
      ]);
    }
  );

  it.each([
    ['*', false],
    ['^1.0.0-beta.1', true],
    ['workspace:*', true],
  ])(
    'matches prerelease wrappers against %s like the workspace resolver',
    async (specifier, selected) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: 'workspace-root',
          private: true,
          workspaces: ['packages/*', 'apps/*'],
        }),
        'packages/vue-wrapper/package.json': JSON.stringify({
          name: '@fixture/vue-wrapper',
          version: '1.0.0-beta.1',
          dependencies: { 'gt-vue': 'workspace:*' },
        }),
        'apps/docs/package.json': JSON.stringify({
          name: '@fixture/docs',
          dependencies: { '@fixture/vue-wrapper': specifier },
        }),
        'apps/docs/src/App.vue': translatableSfc('Prerelease wrapper message'),
      });
      linkInstalledVue(root);

      const output = await extractFromVueProject({ cwd: root });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source)).toEqual(
        selected ? ['Prerelease wrapper message'] : []
      );
    }
  );

  it.each([
    ['file:../../packages/vue-wrapper', true],
    ['link:../../packages/vue-wrapper', true],
    ['portal:../../packages/vue-wrapper', true],
    ['workspace:../../packages/vue-wrapper', true],
    ['file:../../packages/other', false],
  ])(
    'resolves a %s wrapper path to its exact workspace',
    async (specifier, selected) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: 'workspace-root',
          private: true,
          workspaces: ['packages/*', 'apps/*'],
        }),
        'packages/vue-wrapper/package.json': JSON.stringify({
          name: '@fixture/vue-wrapper',
          version: '1.0.0',
          dependencies: { 'gt-vue': 'workspace:*' },
        }),
        'packages/other/package.json': JSON.stringify({
          name: '@fixture/other',
          version: '1.0.0',
        }),
        'apps/docs/package.json': JSON.stringify({
          name: '@fixture/docs',
          dependencies: { '@fixture/vue-wrapper': specifier },
        }),
        'apps/docs/src/App.vue': translatableSfc('Path-selected wrapper'),
      });
      linkInstalledVue(root);

      const output = await extractFromVueProject({ cwd: root });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source)).toEqual(
        selected ? ['Path-selected wrapper'] : []
      );
    }
  );

  it('does not select a root consumer whose range excludes the local wrapper', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['packages/*'],
        dependencies: { '@fixture/vue-wrapper': '^2.0.0' },
      }),
      'app.vue': translatableSfc('Incompatible root consumer'),
      'packages/vue-wrapper/package.json': JSON.stringify({
        name: '@fixture/vue-wrapper',
        version: '1.0.0',
        dependencies: { 'gt-vue': 'workspace:*' },
      }),
    });
    linkInstalledVue(root);

    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it('does not select installed optional Vue workspace integrations', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'react-workspace-root',
        private: true,
        workspaces: ['apps/*'],
      }),
      'apps/optional/package.json': JSON.stringify({
        name: 'optional-vue-integration',
        optionalDependencies: { 'gt-vue': '*' },
        peerDependencies: { vue: '^3.5.0' },
      }),
      'apps/optional/src/App.vue': translatableSfc('Must stay optional'),
      'apps/peer/package.json': JSON.stringify({
        name: 'peer-vue-integration',
        peerDependencies: { 'gt-vue': '*', vue: '^3.5.0' },
        peerDependenciesMeta: { 'gt-vue': { optional: true } },
      }),
      'apps/peer/src/App.vue': translatableSfc('Must stay a peer'),
      'node_modules/gt-vue/package.json': JSON.stringify({
        name: 'gt-vue',
        version: '0.1.0',
        type: 'module',
        main: 'index.js',
      }),
      'node_modules/gt-vue/index.js': 'export const T = {}\n',
    });
    linkInstalledVue(root);

    expect(detectVueProject(root)).toBe(false);
    await expect(extractFromVueProject({ cwd: root })).resolves.toEqual({
      updates: [],
      errors: [],
      warnings: [],
    });
  });

  it('selects a workspace with an installed required gt-vue peer', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'react-workspace-root',
        private: true,
        workspaces: ['apps/*'],
      }),
      'apps/vue-peer/package.json': JSON.stringify({
        name: 'required-vue-peer',
        peerDependencies: { 'gt-vue': '*', vue: '^3.5.0' },
      }),
      'apps/vue-peer/src/App.vue': translatableSfc(
        'Installed required peer message'
      ),
      'node_modules/gt-vue/package.json': JSON.stringify({
        name: 'gt-vue',
        version: '0.1.0',
        type: 'module',
        main: 'index.js',
      }),
      'node_modules/gt-vue/index.js': 'export const T = {}\n',
    });
    linkInstalledVue(root);

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Installed required peer message',
    ]);
  });

  it('selects a workspace with an installed required wrapper peer', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['packages/*', 'apps/*'],
      }),
      'packages/vue-wrapper/package.json': JSON.stringify({
        name: '@fixture/vue-wrapper',
        version: '1.0.0',
        main: 'index.js',
        dependencies: { 'gt-vue': '*' },
      }),
      'packages/vue-wrapper/index.js':
        "export { T as WrapperT } from 'gt-vue';\n",
      'apps/docs/package.json': JSON.stringify({
        name: '@fixture/docs',
        peerDependencies: { '@fixture/vue-wrapper': '^1.0.0' },
      }),
      'apps/docs/src/App.vue': `<script setup>
import { WrapperT } from '@fixture/vue-wrapper';
</script>
<template><WrapperT>Required wrapper peer message</WrapperT></template>`,
    });
    const wrapperLink = path.join(root, 'node_modules/@fixture/vue-wrapper');
    fs.mkdirSync(path.dirname(wrapperLink), { recursive: true });
    fs.symlinkSync(path.join(root, 'packages/vue-wrapper'), wrapperLink, 'dir');
    linkInstalledVue(root);

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Required wrapper peer message',
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

    expect(detectVueProject(root)).toBe(false);
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
        expect.stringContaining('/scopes.ts'),
        expect.stringContaining('/workspaces.ts'),
      ])
    );
    expect(relativeGraph).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('/config/'),
        expect.stringContaining('/script/'),
        expect.stringContaining('/template/'),
      ])
    );
    expect(graphSource).not.toMatch(
      /from ['"](?:@babel|@vue|fast-glob|semver|yaml|#vue-compiler-sfc|\.\/internal\/extractFromVueSource)/
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
