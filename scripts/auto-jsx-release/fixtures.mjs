import path from 'node:path';
import { vi } from 'vitest';
import {
  digest,
  mergedReleaseTitle,
  releaseBranch,
  releasePackages,
  releaseRepository,
  versionBranch,
} from './shared.mjs';

export const expectedSha = '1234567890abcdef1234567890abcdef12345678';

export function mergedReleasePullRequest() {
  return {
    number: 2251,
    title: mergedReleaseTitle,
    state: 'closed',
    merged: true,
    merged_at: '2026-09-07T22:00:00Z',
    merge_commit_sha: expectedSha,
    head: { ref: versionBranch, repo: { full_name: releaseRepository } },
    base: { ref: releaseBranch, repo: { full_name: releaseRepository } },
  };
}

export function releaseFixture() {
  const root = '/reviewed-release';
  const files = new Map();
  const archives = new Map();
  const manifests = new Map();
  const metadata = new Map();
  const context = {
    branch: releaseBranch,
    sha: expectedSha,
    dirty: '',
    pending: [],
    temporaryDirectories: 0,
    files,
    archives,
    manifests,
    metadata,
    associatedPullRequests: [mergedReleasePullRequest()],
    pullRequest: mergedReleasePullRequest(),
  };
  const setJson = (file, value) =>
    files.set(file, Buffer.from(`${JSON.stringify(value)}\n`));
  for (const [name, directory] of Object.entries(releasePackages)) {
    const version =
      name === '@generaltranslation/compiler'
        ? '1.3.50-auto-jsx.0'
        : ['gt', 'gtx-cli'].includes(name)
          ? '2.20.1-auto-jsx.0'
          : name === 'locadex'
            ? '1.0.220-auto-jsx.0'
            : '11.2.0-auto-jsx.0';
    const manifest = {
      name,
      version,
      main: './dist/index.js',
      exports: { '.': './dist/index.js' },
      dependencies: {},
    };
    if (['gtx-cli', 'locadex'].includes(name)) {
      manifest.dependencies.gt = 'workspace:*';
    }
    if (name === 'gt-next') {
      manifest.dependencies['gt-react'] = 'workspace:*';
      manifest.peerDependencies = {
        '@generaltranslation/compiler': '^1.3.50-auto-jsx.0',
      };
      manifest.devDependencies = {
        '@generaltranslation/compiler': 'workspace:*',
      };
    }
    if (name === '@generaltranslation/compiler') {
      manifest.dependencies.generaltranslation = 'workspace:*';
    }
    manifests.set(name, manifest);
    setJson(path.join(root, 'packages', directory, 'package.json'), manifest);
    metadata.set(name, {
      name,
      'dist-tags': { latest: version.split('-')[0], bin: '1.0.0-bin.0' },
      versions: {},
    });
  }
  const core = { name: 'generaltranslation', version: '9.2.0' };
  manifests.set(core.name, core);
  setJson(path.join(root, 'packages/core/package.json'), core);
  metadata.set(core.name, {
    name: core.name,
    versions: { '9.2.0': { name: core.name, version: core.version } },
  });
  setJson(path.join(root, '.changeset/pre.json'), {
    mode: 'pre',
    tag: 'auto-jsx',
    initialVersions: Object.fromEntries(
      [...manifests].map(([name, manifest]) => [
        name,
        manifest.version.split('-')[0],
      ])
    ),
    changesets: ['feature'],
  });
  files.set(
    path.join(root, '.changeset/config.json'),
    Buffer.from('{\n  "baseBranch": "main",\n  "changelog": false\n}\n')
  );
  context.versionPlan = {
    changesets: [
      { id: 'feature', releases: [{ name: 'gt-next', type: 'minor' }] },
    ],
    releases: [...manifests]
      .filter(([name]) => Object.hasOwn(releasePackages, name))
      .map(([name, manifest]) => ({
        name,
        type: 'patch',
        newVersion: manifest.version,
      })),
  };
  const ops = {
    env: {
      GITHUB_REPOSITORY: 'generaltranslation/gt',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REF: `refs/heads/${releaseBranch}`,
      GITHUB_SHA: expectedSha,
      GITHUB_OUTPUT: '/actions/output',
      GH_TOKEN: 'test-github-token',
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'test-token',
      ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.invalid/oidc',
    },
    log: vi.fn(),
    read: async (file) => {
      if (!files.has(file)) throw new Error(`Missing fixture ${file}`);
      return Buffer.from(files.get(file));
    },
    write: async (file, data) => files.set(file, Buffer.from(data)),
    append: async (file, data) =>
      files.set(
        file,
        Buffer.concat([files.get(file) ?? Buffer.alloc(0), Buffer.from(data)])
      ),
    exists: async (file) => files.has(file),
    list: async (directory) => {
      if (directory === path.join(root, 'packages')) {
        return [...Object.values(releasePackages), 'core', 'README.md'];
      }
      if (directory === path.join(root, '.changeset')) {
        return [
          'README.md',
          'config.json',
          'pre.json',
          'feature.md',
          ...context.pending,
        ];
      }
      throw new Error(`Unexpected directory ${directory}`);
    },
    temporaryDirectory: async () =>
      `/retained-release-${context.temporaryDirectories++}`,
    associatedPullRequests: vi.fn(async () => {
      await context.onAssociatedPullRequests?.();
      return structuredClone(context.associatedPullRequests);
    }),
    pullRequest: vi.fn(async () => {
      await context.onPullRequest?.();
      return structuredClone(context.pullRequest);
    }),
    registry: vi.fn(async (name) => {
      await context.onRegistry?.(name);
      return structuredClone(metadata.get(name));
    }),
    run: vi.fn(async (command, args, options = {}) => {
      if (command === 'git') {
        if (args[0] === 'symbolic-ref') return context.branch;
        if (args[0] === 'rev-parse') return context.sha;
        if (args[0] === 'status') return context.dirty;
      }
      if (command === 'pnpm' && args.includes('pack')) {
        const directory = path.basename(options.cwd);
        const name = Object.entries(releasePackages).find(
          ([, candidate]) => candidate === directory
        )[0];
        const manifest = JSON.parse(
          String(files.get(path.join(options.cwd, 'package.json')))
        );
        for (const field of [
          'dependencies',
          'optionalDependencies',
          'peerDependencies',
          'devDependencies',
        ]) {
          for (const [dependency, range] of Object.entries(
            manifest[field] ?? {}
          )) {
            if (range === 'workspace:*') {
              manifest[field][dependency] = manifests.get(dependency).version;
            }
          }
        }
        const tarball = args[args.indexOf('--out') + 1];
        const archive = {
          tarball,
          manifest,
          entries: ['package/package.json', 'package/dist/index.js'],
          type: '-',
          wasm: Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 0]),
        };
        if (name === 'gt-next') {
          archive.entries.push('package/dist/gt_swc_plugin.wasm');
        }
        await context.onPack?.(archive);
        archives.set(tarball, archive);
        files.set(tarball, Buffer.from(JSON.stringify(manifest)));
        await context.afterPack?.(archive);
        return '{}';
      }
      if (command === 'pnpm' && args.includes('status')) {
        const config = JSON.parse(
          String(files.get(path.join(root, '.changeset/config.json')))
        );
        context.observedConfig = config;
        await context.onStatus?.();
        // The installed Changesets CLI joins cwd with --output, even when the
        // latter is absolute. Model that behavior to catch absolute-path regressions.
        setJson(path.join(options.cwd, args.at(-1)), context.versionPlan);
        return '';
      }
      if (command === 'pnpm' && args[0] === 'run') {
        await context.onVersion?.();
        return '';
      }
      if (command === 'tar') {
        const archive = archives.get(args[1]);
        if (args[0] === '-tzf') return archive.entries.join('\n');
        if (args[0] === '-tvzf') {
          return archive.entries
            .map((entry) => `${archive.type}rw-r--r-- 0/0 1 ${entry}`)
            .join('\n');
        }
        if (args[2] === 'package/package.json') {
          return JSON.stringify(archive.manifest);
        }
        return archive.wasm;
      }
      if (command === 'npm' && args[0] === 'publish') {
        const archive = archives.get(args[1]);
        await context.beforePublish?.(archive, args);
        const current = metadata.get(archive.manifest.name);
        current.versions[archive.manifest.version] = {
          ...archive.manifest,
          dist: digest(files.get(args[1])),
        };
        current['dist-tags']['auto-jsx'] = archive.manifest.version;
        await context.afterPublish?.(archive);
        return '';
      }
      throw new Error(`Unexpected command ${command} ${args.join(' ')}`);
    }),
  };
  context.setManifest = (name, update) => {
    const manifest = manifests.get(name);
    update(manifest);
    const directory = releasePackages[name] ?? 'core';
    setJson(path.join(root, 'packages', directory, 'package.json'), manifest);
  };
  context.setPreState = (update) => {
    const file = path.join(root, '.changeset/pre.json');
    const state = JSON.parse(String(files.get(file)));
    update(state);
    setJson(file, state);
  };
  return { root, expectedSha, ops, context };
}
