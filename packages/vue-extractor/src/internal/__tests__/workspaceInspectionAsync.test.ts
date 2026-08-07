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
});

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  return root;
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
