import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  inspectVueProject,
  inspectVueProjectAsync,
} from '../project/inspectVueProject.js';
import { readJavaScriptPackageManifest } from '../project/manifest.js';
import { extractFromVueProject } from '../project/extractFromVueProject.js';
import {
  createWorkspaceDiscoveryCache,
  readDeclaredWorkspacePackages,
  readDeclaredWorkspacePackagesAsync,
} from '../project/workspaces.js';
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

describe('asynchronous Vue workspace inspection', () => {
  it('matches synchronous discovery without synchronously reading child manifests', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['stale/*'],
      }),
      'pnpm-workspace.yaml': `packages:
  - 'apps/*'
  - '!apps/excluded'
`,
      'apps/vue/package.json': JSON.stringify({
        name: 'vue-app',
        dependencies: { 'gt-vue': '*' },
      }),
      'apps/ordinary/package.json': JSON.stringify({
        name: 'ordinary-app',
        dependencies: { 'gt-react': '*' },
      }),
      'apps/excluded/package.json': JSON.stringify({
        name: 'excluded-vue-app',
        dependencies: { 'gt-vue': '*' },
      }),
      'apps/invalid/package.json': '{invalid',
    });
    const rootManifest = readJavaScriptPackageManifest(
      path.join(root, 'package.json')
    );
    expect(rootManifest).toBeDefined();
    const synchronous = readDeclaredWorkspacePackages(
      root,
      rootManifest!,
      createWorkspaceDiscoveryCache()
    );
    const readFileSync = vi.spyOn(fs, 'readFileSync');

    const asynchronous = await readDeclaredWorkspacePackagesAsync(
      root,
      rootManifest!,
      createWorkspaceDiscoveryCache()
    );

    expect(normalizeWorkspacePackages(root, asynchronous)).toEqual(
      normalizeWorkspacePackages(root, synchronous)
    );
    const synchronousChildManifestReads = readFileSync.mock.calls.filter(
      ([file]) =>
        typeof file === 'string' &&
        file.startsWith(path.join(root, 'apps') + path.sep) &&
        path.basename(file) === 'package.json'
    );
    expect(synchronousChildManifestReads).toEqual([]);
  });

  it('produces the same reusable extraction plan as synchronous inspection', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['apps/*'],
      }),
      'apps/vue/package.json': JSON.stringify({
        name: 'vue-app',
        dependencies: { 'gt-vue': '*' },
      }),
      'apps/vue/src/App.vue': translatableSfc(
        'Asynchronously discovered message'
      ),
    });
    linkInstalledVue(root);

    const asynchronous = await inspectVueProjectAsync(root);

    expect(asynchronous).toEqual(inspectVueProject(root));
    const output = await extractFromVueProject({
      cwd: root,
      inspection: asynchronous,
    });
    expect(output.errors).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual([
      'Asynchronously discovered message',
    ]);
  });

  it('rejects symlink escapes in static and dynamic workspace paths', async () => {
    const outside = createFixture({
      'static/vue/package.json': JSON.stringify({
        name: 'outside-static-vue',
        dependencies: { 'gt-vue': '*' },
      }),
      'dynamic/package.json': JSON.stringify({
        name: 'outside-dynamic-vue',
        dependencies: { 'gt-vue': '*' },
      }),
    });
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['linked/*', 'packages/*'],
      }),
      'packages/local/package.json': JSON.stringify({
        name: 'local-react-package',
        dependencies: { 'gt-react': '*' },
      }),
    });
    fs.symlinkSync(
      path.join(outside, 'static'),
      path.join(root, 'linked'),
      'dir'
    );
    fs.symlinkSync(
      path.join(outside, 'dynamic'),
      path.join(root, 'packages/escaped'),
      'dir'
    );
    const rootManifest = readJavaScriptPackageManifest(
      path.join(root, 'package.json')
    );
    expect(rootManifest).toBeDefined();

    const synchronous = readDeclaredWorkspacePackages(
      root,
      rootManifest!,
      createWorkspaceDiscoveryCache()
    );
    const asynchronous = await readDeclaredWorkspacePackagesAsync(
      root,
      rootManifest!,
      createWorkspaceDiscoveryCache()
    );

    expect(normalizeWorkspacePackages(root, synchronous)).toEqual([
      {
        directory: 'packages/local',
        manifest: {
          name: 'local-react-package',
          dependencies: { 'gt-react': '*' },
        },
      },
    ]);
    expect(normalizeWorkspacePackages(root, asynchronous)).toEqual(
      normalizeWorkspacePackages(root, synchronous)
    );
  });

  it('retains physical containment for every glob fallback match', async () => {
    const outside = createFixture({
      'x/package.json': JSON.stringify({
        name: 'outside-vue',
        dependencies: { 'gt-vue': '*' },
      }),
    });
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['link-out/x', '.'],
      }),
    });
    fs.symlinkSync(outside, path.join(root, 'link-out'), 'dir');

    expect(readWorkspacePackagesSync(root)).toEqual([]);
    expect(await readWorkspacePackages(root)).toEqual([]);
  });

  it('rejects a shallow base redirected into node_modules', async () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['alias/*'],
      }),
      'node_modules/bad/package.json': JSON.stringify({
        name: 'installed-vue',
        dependencies: { 'gt-vue': '*' },
      }),
    });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(root, 'alias'));

    expect(readWorkspacePackagesSync(root)).toEqual([]);
    expect(await readWorkspacePackages(root)).toEqual([]);
  });

  it('matches the glob fallback for bounded shallow workspace patterns', async () => {
    const outside = createFixture({
      'manifest.json': JSON.stringify({
        name: 'outside-manifest-vue',
        dependencies: { 'gt-vue': '*' },
      }),
      'directory/package.json': JSON.stringify({
        name: 'outside-directory-vue',
        dependencies: { 'gt-vue': '*' },
      }),
    });
    const optimizedRoot = createShallowWorkspaceFixture(outside, false);
    const fallbackRoot = createShallowWorkspaceFixture(outside, true);

    const optimized = await readWorkspacePackages(optimizedRoot);
    const fallback = await readWorkspacePackages(fallbackRoot);

    expect(normalizeWorkspacePackages(optimizedRoot, optimized)).toEqual([
      {
        directory: 'apps/valid',
        manifest: { name: 'valid-app' },
      },
      {
        directory: 'packages/valid',
        manifest: { name: 'valid-package' },
      },
    ]);
    expect(normalizeWorkspacePackages(fallbackRoot, fallback)).toEqual(
      normalizeWorkspacePackages(optimizedRoot, optimized)
    );
  });

  it('resolves shallow workspace bases instead of every child manifest', async () => {
    const packageCount = 128;
    const files: Record<string, string> = {
      'package.json': JSON.stringify({
        name: 'workspace-root',
        private: true,
        workspaces: ['packages/*'],
      }),
    };
    for (let index = 0; index < packageCount; index += 1) {
      files[`packages/package-${index}/package.json`] = JSON.stringify({
        name: `react-package-${index}`,
        dependencies: { 'gt-react': '*' },
      });
    }
    const root = createFixture(files);
    const rootManifest = readJavaScriptPackageManifest(
      path.join(root, 'package.json')
    );
    expect(rootManifest).toBeDefined();
    const realpath = vi.spyOn(fs.promises, 'realpath');

    const packages = await readDeclaredWorkspacePackagesAsync(
      root,
      rootManifest!,
      createWorkspaceDiscoveryCache()
    );

    expect(packages).toHaveLength(packageCount);
    expect(
      realpath.mock.calls.filter(
        ([file]) =>
          typeof file === 'string' && path.basename(file) === 'package.json'
      )
    ).toEqual([]);
    expect(realpath).toHaveBeenCalledTimes(2);
  });
});

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  return root;
}

function createShallowWorkspaceFixture(
  outside: string,
  forceGlobFallback: boolean
): string {
  const patterns = ['packages/*', 'apps/*', 'missing/*'];
  const root = createFixture({
    'package.json': JSON.stringify({
      name: 'workspace-root',
      private: true,
      workspaces: patterns,
    }),
    ...(forceGlobFallback
      ? {
          'pnpm-workspace.yaml': `packages:\n${patterns
            .map((pattern) => `  - '${pattern}'`)
            .join('\n')}\n  - '!packages/not-present'\n`,
        }
      : {}),
    'apps/valid/package.json': JSON.stringify({ name: 'valid-app' }),
    'packages/valid/package.json': JSON.stringify({ name: 'valid-package' }),
    'packages/.hidden/package.json': JSON.stringify({ name: 'hidden-vue' }),
    'packages/malformed/package.json': '{invalid',
    'packages/missing/README.md': 'No manifest',
    'packages/symlink-manifest/README.md': 'Linked manifest',
  });
  fs.symlinkSync(
    path.join(outside, 'manifest.json'),
    path.join(root, 'packages/symlink-manifest/package.json'),
    'file'
  );
  fs.symlinkSync(
    path.join(outside, 'directory'),
    path.join(root, 'packages/symlink-directory'),
    'dir'
  );
  return root;
}

async function readWorkspacePackages(root: string) {
  const manifest = readJavaScriptPackageManifest(
    path.join(root, 'package.json')
  );
  expect(manifest).toBeDefined();
  return readDeclaredWorkspacePackagesAsync(
    root,
    manifest!,
    createWorkspaceDiscoveryCache()
  );
}

function readWorkspacePackagesSync(root: string) {
  const manifest = readJavaScriptPackageManifest(
    path.join(root, 'package.json')
  );
  expect(manifest).toBeDefined();
  return readDeclaredWorkspacePackages(
    root,
    manifest!,
    createWorkspaceDiscoveryCache()
  );
}

function normalizeWorkspacePackages(
  root: string,
  packages: ReturnType<typeof readDeclaredWorkspacePackages>
) {
  return packages.map(({ directory, manifest }) => ({
    directory: path.relative(root, directory),
    manifest,
  }));
}
