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
  parseLocalDependencyPath,
  resolveInstalledJavaScriptPackage,
} from '../project/manifest.js';
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
          exports: { '.': { import: './index.js' } },
        }),
        'node_modules/gt-vue/index.js': 'export const T = {}\n',
      });

      expect(detectVueProject(root)).toBe(true);
    }
  );

  it('honors an optional dependency that overrides the same required dependency', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'root-react-app',
        dependencies: { 'gt-vue': '^1.0.0' },
        optionalDependencies: { 'gt-vue': '^2.0.0' },
      }),
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('rejects an installed optional dependency outside its declared range', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'root-react-app',
        dependencies: { 'gt-vue': '^1.0.0' },
        optionalDependencies: { 'gt-vue': '^2.0.0' },
      }),
      'node_modules/gt-vue/package.json': JSON.stringify({
        name: 'gt-vue',
        version: '1.0.0',
        type: 'module',
        exports: { '.': { import: './index.js' } },
      }),
      'node_modules/gt-vue/index.js': 'export const T = {}\n',
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it('rejects an installed required peer outside its declared range', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'root-react-library',
        peerDependencies: { 'gt-vue': '^2.0.0' },
      }),
      'node_modules/gt-vue/package.json': JSON.stringify({
        name: 'gt-vue',
        version: '1.0.0',
        type: 'module',
        exports: { '.': { import: './index.js' } },
      }),
      'node_modules/gt-vue/index.js': 'export const T = {}\n',
    });

    expect(detectVueProject(root)).toBe(false);
  });

  it("uses an active Plug'n'Play API to locate import-only packages", () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'pnp-root',
        dependencies: { '@fixture/vue-wrapper': '^1.0.0' },
      }),
      'packages/vue-wrapper/package.json': JSON.stringify({
        name: '@fixture/vue-wrapper',
        version: '1.0.0',
        type: 'module',
        exports: { '.': { import: './index.js' } },
      }),
      'packages/vue-wrapper/index.js': 'export const WrapperT = {}\n',
      'node_modules/pnpapi/package.json': JSON.stringify({
        name: 'pnpapi',
        version: '1.0.0',
        main: 'index.cjs',
      }),
      'node_modules/pnpapi/index.cjs': `
        const path = require('node:path');
        exports.resolveToUnqualified = (request, issuer) =>
          request === '@fixture/vue-wrapper'
            ? path.join(path.dirname(issuer), 'packages/vue-wrapper')
            : null;
      `,
    });
    const originalPnpDescriptor = Object.getOwnPropertyDescriptor(
      process.versions,
      'pnp'
    );
    Object.defineProperty(process.versions, 'pnp', {
      configurable: true,
      value: '3',
    });

    try {
      expect(
        resolveInstalledJavaScriptPackage(root, '@fixture/vue-wrapper')
      ).toMatchObject({
        directory: fs.realpathSync(path.join(root, 'packages/vue-wrapper')),
        manifest: { name: '@fixture/vue-wrapper', version: '1.0.0' },
      });
    } finally {
      if (originalPnpDescriptor) {
        Object.defineProperty(process.versions, 'pnp', originalPnpDescriptor);
      } else {
        delete (process.versions as Record<string, string | undefined>).pnp;
      }
    }
  });

  it('does not fall through a malformed nearest installed package', () => {
    const root = createFixture({
      'package.json': JSON.stringify({ name: 'workspace-root' }),
      'apps/docs/package.json': JSON.stringify({
        name: '@fixture/docs',
        dependencies: { '@fixture/vue-wrapper': '^1.0.0' },
      }),
      'apps/docs/node_modules/@fixture/vue-wrapper/package.json': '{broken',
      'node_modules/@fixture/vue-wrapper/package.json': JSON.stringify({
        name: '@fixture/vue-wrapper',
        version: '1.0.0',
      }),
    });

    expect(
      resolveInstalledJavaScriptPackage(
        path.join(root, 'apps/docs'),
        '@fixture/vue-wrapper'
      )
    ).toBeUndefined();
  });

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
        exports: './src/index.ts',
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
        exports: './src/index.ts',
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

  it.each(['dependencies', 'devDependencies'] as const)(
    'detects a root that consumes a local gt-vue wrapper through %s',
    (field) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: '@fixture/docs',
          private: true,
          workspaces: ['packages/*'],
          [field]: { '@fixture/vue-wrapper': 'workspace:*' },
        }),
        'packages/vue-wrapper/package.json': JSON.stringify({
          name: '@fixture/vue-wrapper',
          version: '1.0.0',
          exports: { '.': { import: './index.js' } },
          dependencies: { 'gt-vue': 'workspace:*' },
        }),
        'packages/vue-wrapper/index.js':
          "export { T as WrapperT } from 'gt-vue';\n",
        'src/App.ts': `
          import { WrapperT } from '@fixture/vue-wrapper';
          void WrapperT;
        `,
      });
      linkWorkspaceBinding(
        root,
        '',
        '@fixture/vue-wrapper',
        'packages/vue-wrapper'
      );

      expect(detectVueProject(root)).toBe(true);
      expect(inspectVueProject(root)).toMatchObject({
        rootOwnsVue: true,
        hasVueScopes: true,
      });
    }
  );

  it('detects a local wrapper whose gt-vue API is exposed by a wildcard subpath', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: '@fixture/docs',
        private: true,
        workspaces: ['packages/*'],
        dependencies: { '@fixture/vue-wrapper': 'workspace:*' },
      }),
      'packages/vue-wrapper/package.json': JSON.stringify({
        name: '@fixture/vue-wrapper',
        version: '1.0.0',
        exports: { './*': { import: './src/*.ts' } },
        dependencies: { 'gt-vue': 'workspace:*' },
      }),
      'packages/vue-wrapper/src/runtime.ts':
        "export { createGT } from 'gt-vue';\n",
      'src/App.ts': `
        import { createGT } from '@fixture/vue-wrapper/runtime';
        void createGT;
      `,
    });
    linkWorkspaceBinding(
      root,
      '',
      '@fixture/vue-wrapper',
      'packages/vue-wrapper'
    );

    expect(detectVueProject(root)).toBe(true);
    expect(inspectVueProject(root)).toMatchObject({
      rootOwnsVue: true,
      hasVueScopes: true,
    });
  });

  it.each(['dependencies', 'devDependencies'] as const)(
    'keeps a local gt-vue owner in %s scoped to itself when its public API is ordinary',
    async (field) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: '@fixture/file-only-root',
          private: true,
          workspaces: ['packages/*'],
          dependencies: { ordinary: 'workspace:*' },
        }),
        'app.vue': translatableSfc('Unowned root message'),
        'packages/ordinary/package.json': JSON.stringify({
          name: 'ordinary',
          version: '1.0.0',
          exports: './index.js',
          [field]: { 'gt-vue': '*' },
        }),
        'packages/ordinary/index.js':
          "export const ordinary = 'not a gt-vue reexport';\n",
        'packages/ordinary/src/App.vue': translatableSfc(
          'Direct owner message'
        ),
      });
      linkWorkspaceBinding(root, '', 'ordinary', 'packages/ordinary');
      linkInstalledVue(root);

      expect(detectVueProject(root)).toBe(false);
      expect(inspectVueProject(root)).toMatchObject({
        rootOwnsVue: false,
        hasVueScopes: true,
      });
      const output = await extractFromVueProject({ cwd: root });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source)).toEqual([
        'Direct owner message',
      ]);
    }
  );

  it('does not propagate a wrapper consumer reached only through a development edge', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: '@fixture/file-only-root',
        private: true,
        workspaces: ['packages/*'],
        dependencies: { middle: 'workspace:*' },
      }),
      'app.vue': translatableSfc('Unowned root message'),
      'packages/wrapper/package.json': JSON.stringify({
        name: 'wrapper',
        version: '1.0.0',
        exports: './index.js',
        dependencies: { 'gt-vue': '*' },
      }),
      'packages/wrapper/index.js': "export { T as WrapperT } from 'gt-vue';\n",
      'packages/middle/package.json': JSON.stringify({
        name: 'middle',
        version: '1.0.0',
        devDependencies: { wrapper: 'workspace:*' },
      }),
      'packages/middle/src/App.vue': wrapperSfc(
        'Development consumer message',
        'wrapper'
      ),
    });
    linkWorkspaceBinding(root, '', 'middle', 'packages/middle');
    linkWorkspaceBinding(
      root,
      'packages/middle',
      'wrapper',
      'packages/wrapper'
    );
    linkInstalledVue(root);

    expect(detectVueProject(root)).toBe(false);
    expect(inspectVueProject(root)).toMatchObject({
      rootOwnsVue: false,
      hasVueScopes: true,
    });
    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Development consumer message',
    ]);
  });

  it.each(['file:', 'link:', 'portal:'])(
    'extracts a root that consumes an explicit %s wrapper outside workspaces',
    async (protocol) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: '@fixture/docs',
          private: true,
          dependencies: {
            '@fixture/vue-wrapper': `${protocol}./vendor/vue-wrapper`,
          },
        }),
        'vendor/vue-wrapper/package.json': JSON.stringify({
          name: '@fixture/vue-wrapper',
          version: '1.0.0',
          dependencies: { 'gt-vue': '*' },
        }),
        'vendor/vue-wrapper/index.js':
          "export { T as WrapperT } from 'gt-vue';\n",
        'src/App.vue': `<script setup>
import { WrapperT } from '@fixture/vue-wrapper';
</script>
<template><WrapperT>Local wrapper root message</WrapperT></template>`,
      });
      linkWorkspaceBinding(
        root,
        '',
        '@fixture/vue-wrapper',
        'vendor/vue-wrapper'
      );
      linkInstalledVue(root);

      expect(detectVueProject(root)).toBe(true);
      expect(inspectVueProject(root)).toMatchObject({
        rootOwnsVue: true,
        hasVueScopes: true,
      });
      const output = await extractFromVueProject({ cwd: root });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source)).toEqual([
        'Local wrapper root message',
      ]);
    }
  );

  it.each(['dependencies', 'devDependencies'] as const)(
    'does not classify a root from an external package %s on gt-vue',
    (field) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: 'file-only-root',
          dependencies: { ordinary: '1.0.0' },
        }),
        'node_modules/ordinary/package.json': JSON.stringify({
          name: 'ordinary',
          version: '1.0.0',
          [field]: { 'gt-vue': '1.0.0' },
        }),
        'node_modules/ordinary/index.js': 'export const ordinary = true;\n',
      });

      expect(detectVueProject(root)).toBe(false);
    }
  );

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

  it.each([
    '^1.0.0',
    'latest',
    'workspace:^',
    'workspace:*',
    'workspace:',
    'workspace:latest',
  ])(
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
          exports: './index.js',
          dependencies: { 'gt-vue': 'workspace:*' },
        }),
        'packages/vue-wrapper/index.js':
          "export { T as WrapperT } from 'gt-vue';\n",
        'apps/docs/package.json': JSON.stringify({
          name: '@fixture/docs',
          dependencies: { '@fixture/vue-wrapper': specifier },
        }),
        'apps/docs/src/App.vue': wrapperSfc('Compatible wrapper version'),
      });
      linkWorkspaceBinding(
        root,
        'apps/docs',
        '@fixture/vue-wrapper',
        'packages/vue-wrapper'
      );
      linkInstalledVue(root);

      const output = await extractFromVueProject({ cwd: root });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source)).toEqual([
        'Compatible wrapper version',
      ]);
    }
  );

  it('does not select a compatible bare range without an installed local binding', async () => {
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
        dependencies: { '@fixture/vue-wrapper': '^1.0.0' },
      }),
      'apps/docs/src/App.vue': translatableSfc(
        'Registry-selected wrapper version'
      ),
      'apps/docs/node_modules/@fixture/vue-wrapper/package.json':
        JSON.stringify({
          name: '@fixture/vue-wrapper',
          version: '1.4.0',
          type: 'module',
          exports: './index.js',
        }),
      'apps/docs/node_modules/@fixture/vue-wrapper/index.js':
        "export { T as WrapperT } from 'gt-vue';\n",
    });
    linkInstalledVue(root);

    await expect(extractFromVueProject({ cwd: root })).resolves.toEqual({
      updates: [],
      errors: [],
      warnings: [],
    });
  });

  it.each([
    ['*', false],
    ['>=0.0.0', false],
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
          exports: './index.js',
          dependencies: { 'gt-vue': 'workspace:*' },
        }),
        'packages/vue-wrapper/index.js':
          "export { T as WrapperT } from 'gt-vue';\n",
        'apps/docs/package.json': JSON.stringify({
          name: '@fixture/docs',
          dependencies: { '@fixture/vue-wrapper': specifier },
        }),
        'apps/docs/src/App.vue': wrapperSfc('Prerelease wrapper message'),
      });
      if (selected) {
        linkWorkspaceBinding(
          root,
          'apps/docs',
          '@fixture/vue-wrapper',
          'packages/vue-wrapper'
        );
      }
      linkInstalledVue(root);

      const output = await extractFromVueProject({ cwd: root });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source)).toEqual(
        selected ? ['Prerelease wrapper message'] : []
      );
    }
  );

  it.each([
    ['vue-alias', 'workspace:@fixture/vue-wrapper@*', true],
    ['@fixture/vue-alias', 'workspace:@fixture/vue-wrapper@^1.0.0', true],
    ['relative-alias', 'workspace:../../packages/vue-wrapper', true],
    ['tagged-alias', 'workspace:@fixture/vue-wrapper@latest', true],
    ['stale-alias', 'workspace:@fixture/vue-wrapper@^2.0.0', false],
  ])(
    'selects a consumer of workspace alias %s',
    async (bindingName, specifier, selected) => {
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
        'packages/vue-wrapper/index.js':
          "export { T as WrapperT } from 'gt-vue';\n",
        'apps/docs/package.json': JSON.stringify({
          name: '@fixture/docs',
          dependencies: { [bindingName]: specifier },
        }),
        'apps/docs/src/App.vue': `<script setup>
import { WrapperT } from '${bindingName}';
</script>
<template><WrapperT>Workspace alias message</WrapperT></template>`,
      });
      linkWorkspaceBinding(
        root,
        'apps/docs',
        bindingName,
        'packages/vue-wrapper'
      );
      linkInstalledVue(root);

      const output = await extractFromVueProject({ cwd: root });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source)).toEqual(
        selected ? ['Workspace alias message'] : []
      );
    }
  );

  it.each([
    ['npm:@fixture/vue-wrapper@^1.0.0', true],
    ['npm:@fixture/vue-wrapper', true],
    ['npm:@fixture/vue-wrapper@latest', true],
    ['npm:@fixture/vue-wrapper@^2.0.0', false],
  ])(
    'validates the installed npm alias range %s',
    async (specifier, selected) => {
      const bindingName = 'vue-alias';
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
        'packages/vue-wrapper/index.js':
          "export { T as WrapperT } from 'gt-vue';\n",
        'apps/docs/package.json': JSON.stringify({
          name: '@fixture/docs',
          dependencies: { [bindingName]: specifier },
        }),
        'apps/docs/src/App.vue': `<script setup>
import { WrapperT } from '${bindingName}';
</script>
<template><WrapperT>Npm alias message</WrapperT></template>`,
      });
      linkWorkspaceBinding(
        root,
        'apps/docs',
        bindingName,
        'packages/vue-wrapper'
      );
      linkInstalledVue(root);

      const output = await extractFromVueProject({ cwd: root });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source)).toEqual(
        selected ? ['Npm alias message'] : []
      );
    }
  );

  it.each([
    ['@fixture/vue-wrapper', "'@fixture/vue-wrapper': ^1.0.0"],
    ['vue-alias', 'vue-alias: npm:@fixture/vue-wrapper@^1.0.0'],
  ])(
    'selects the local catalog binding %s',
    async (bindingName, catalogEntry) => {
      const root = createFixture({
        'package.json': JSON.stringify({
          name: 'workspace-root',
          private: true,
        }),
        'pnpm-workspace.yaml': `packages:
  - 'packages/*'
  - 'apps/*'
catalog:
  ${catalogEntry}
`,
        'packages/vue-wrapper/package.json': JSON.stringify({
          name: '@fixture/vue-wrapper',
          version: '1.4.0',
          dependencies: { 'gt-vue': 'workspace:*' },
        }),
        'packages/vue-wrapper/index.js':
          "export { T as WrapperT } from 'gt-vue';\n",
        'apps/docs/package.json': JSON.stringify({
          name: '@fixture/docs',
          dependencies: { [bindingName]: 'catalog:' },
        }),
        'apps/docs/src/App.vue': `<script setup>
import { WrapperT } from '${bindingName}';
</script>
<template><WrapperT>Catalog-selected wrapper</WrapperT></template>`,
      });
      linkWorkspaceBinding(
        root,
        'apps/docs',
        bindingName,
        'packages/vue-wrapper'
      );
      linkInstalledVue(root);

      const output = await extractFromVueProject({ cwd: root });

      expect(output.errors).toEqual([]);
      expect(output.updates.map(({ source }) => source)).toEqual([
        'Catalog-selected wrapper',
      ]);
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
          exports: './index.js',
          dependencies: { 'gt-vue': 'workspace:*' },
        }),
        'packages/vue-wrapper/index.js':
          "export { T as WrapperT } from 'gt-vue';\n",
        'packages/other/package.json': JSON.stringify({
          name: '@fixture/other',
          version: '1.0.0',
        }),
        'apps/docs/package.json': JSON.stringify({
          name: '@fixture/docs',
          dependencies: { '@fixture/vue-wrapper': specifier },
        }),
        'apps/docs/src/App.vue': wrapperSfc('Path-selected wrapper'),
      });
      if (selected) {
        linkWorkspaceBinding(
          root,
          'apps/docs',
          '@fixture/vue-wrapper',
          'packages/vue-wrapper'
        );
      }
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
    linkWorkspaceBinding(
      root,
      '',
      '@fixture/vue-wrapper',
      'packages/vue-wrapper'
    );
    linkInstalledVue(root);

    expect(detectVueProject(root)).toBe(false);
    const output = await extractFromVueProject({ cwd: root });

    expect(output).toEqual({ updates: [], errors: [], warnings: [] });
  });

  it.each([
    ['workspace:.', '.'],
    ['workspace:..', '..'],
    ['workspace:../wrapper', '../wrapper'],
  ])('parses the local workspace path %s', (specifier, localPath) => {
    expect(parseLocalDependencyPath(specifier)).toBe(localPath);
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
        exports: { '.': { import: './index.js' } },
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

  it('does not select workspace runtimes hidden by optional overrides or incompatible peers', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'react-workspace-root',
        private: true,
        workspaces: ['apps/*'],
      }),
      'apps/optional/package.json': JSON.stringify({
        name: 'optional-override-integration',
        dependencies: { 'gt-vue': '^1.0.0' },
        optionalDependencies: { 'gt-vue': '^2.0.0' },
      }),
      'apps/optional/src/App.vue': translatableSfc(
        'Must stay optional after override'
      ),
      'apps/peer/package.json': JSON.stringify({
        name: 'incompatible-peer-integration',
        peerDependencies: { 'gt-vue': '^2.0.0' },
      }),
      'apps/peer/src/App.vue': translatableSfc(
        'Must stay outside the peer range'
      ),
      'node_modules/gt-vue/package.json': JSON.stringify({
        name: 'gt-vue',
        version: '1.0.0',
        type: 'module',
        exports: { '.': { import: './index.js' } },
      }),
      'node_modules/gt-vue/index.js': 'export const T = {}\n',
    });

    expect(inspectVueProject(root)).toMatchObject({
      rootOwnsVue: false,
      hasVueScopes: false,
    });
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
        type: 'module',
        exports: { '.': { import: './index.js' } },
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

  it('rejects an installed local wrapper outside a required peer range', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['packages/*', 'apps/*'],
      }),
      'packages/vue-wrapper/package.json': JSON.stringify({
        name: '@fixture/vue-wrapper',
        version: '1.0.0',
        dependencies: { 'gt-vue': '*' },
      }),
      'apps/docs/package.json': JSON.stringify({
        name: '@fixture/docs',
        peerDependencies: { '@fixture/vue-wrapper': '^2.0.0' },
      }),
      'apps/docs/src/App.vue': translatableSfc(
        'Incompatible required wrapper peer'
      ),
    });
    linkWorkspaceBinding(
      root,
      '',
      '@fixture/vue-wrapper',
      'packages/vue-wrapper'
    );
    linkInstalledVue(root);

    await expect(extractFromVueProject({ cwd: root })).resolves.toEqual({
      updates: [],
      errors: [],
      warnings: [],
    });
  });

  it('selects an installed required peer through a workspace alias', async () => {
    const bindingName = 'vue-peer-alias';
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['packages/*', 'apps/*'],
      }),
      'packages/vue-wrapper/package.json': JSON.stringify({
        name: '@fixture/vue-wrapper',
        version: '1.0.0',
        dependencies: { 'gt-vue': '*' },
      }),
      'packages/vue-wrapper/index.js':
        "export { T as WrapperT } from 'gt-vue';\n",
      'apps/docs/package.json': JSON.stringify({
        name: '@fixture/docs',
        peerDependencies: {
          [bindingName]: 'workspace:@fixture/vue-wrapper@*',
        },
      }),
      'apps/docs/src/App.vue': `<script setup>
import { WrapperT } from '${bindingName}';
</script>
<template><WrapperT>Required peer alias message</WrapperT></template>`,
    });
    linkWorkspaceBinding(root, '', bindingName, 'packages/vue-wrapper');
    linkInstalledVue(root);

    const output = await extractFromVueProject({ cwd: root });

    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Required peer alias message',
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

  it('does not load the Vue compiler or project extraction graph from /detect', () => {
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
        expect.stringContaining('/template/'),
      ])
    );
    expect(graphSource).not.toMatch(
      /from ['"](?:@vue|fast-glob|yaml|#vue-compiler-sfc|\.\/internal\/extractFromVueSource)/
    );
  });
});

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  return root;
}

function wrapperSfc(message: string, source = '@fixture/vue-wrapper'): string {
  return `<script setup lang="ts">
import { WrapperT } from '${source}';
</script>
<template><WrapperT>${message}</WrapperT></template>
`;
}

function linkWorkspaceBinding(
  root: string,
  consumerDirectory: string,
  bindingName: string,
  targetDirectory: string
): void {
  const destination = path.join(
    root,
    consumerDirectory,
    'node_modules',
    ...bindingName.split('/')
  );
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(path.join(root, targetDirectory), destination, 'dir');
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
