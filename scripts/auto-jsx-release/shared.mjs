import { createHash } from 'node:crypto';
import path from 'node:path';
import { createDiagnosticMessage } from 'generaltranslation/internal';

export const channel = 'auto-jsx';
export const releaseBranch = 'e/release/auto-jsx-experimental';
export const releaseRepository = 'generaltranslation/gt';
export const releaseTitle = '[ci] auto-jsx release';
// The pinned Changesets action appends the prerelease tag to its configured title.
export const mergedReleaseTitle = `${releaseTitle} (${channel})`;
export const versionBranch = `changeset-release/${releaseBranch}`;
export const registryUrl = 'https://registry.npmjs.org';
// Keep existing Changesets fixed groups and the CLI's dependent package together.
export const releasePackages = Object.freeze({
  '@generaltranslation/compiler': 'compiler',
  '@generaltranslation/react-core': 'react-core',
  'gt-react': 'react',
  'gt-react-native': 'react-native',
  'gt-tanstack-start': 'tanstack-start',
  'gt-next': 'next',
  gt: 'cli',
  'gtx-cli': 'gtx-cli',
  locadex: 'locadex',
});
export const dependencyFields = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'devDependencies',
];

export function releaseError(whatHappened, details) {
  return new Error(
    createDiagnosticMessage({
      source: 'gt-libraries (auto JSX release)',
      severity: 'Error',
      whatHappened,
      details,
    })
  );
}

export function requireCondition(condition, whatHappened, details) {
  if (!condition) throw releaseError(whatHappened, details);
}

export function isChannelVersion(version) {
  return (
    typeof version === 'string' &&
    version.trim() === version &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-auto-jsx\.(0|[1-9]\d*)$/.test(
      version
    )
  );
}

export async function readJson(ops, file) {
  try {
    return JSON.parse(String(await ops.read(file)));
  } catch (error) {
    throw releaseError('A release metadata file could not be read', [
      file,
      error.message,
    ]);
  }
}

export async function readWorkspace(root, ops) {
  const packages = new Map();
  for (const directory of await ops.list(path.join(root, 'packages'))) {
    const manifestPath = path.join(root, 'packages', directory, 'package.json');
    if (!(await ops.exists(manifestPath))) continue;
    const manifest = await readJson(ops, manifestPath);
    requireCondition(
      typeof manifest.name === 'string' && !packages.has(manifest.name),
      'Workspace package names must be present and unique',
      manifestPath
    );
    packages.set(manifest.name, { directory, manifest });
  }
  return packages;
}

export function validateVersions(packages) {
  for (const [name, directory] of Object.entries(releasePackages)) {
    const entry = packages.get(name);
    requireCondition(
      entry?.directory === directory &&
        !entry.manifest.private &&
        isChannelVersion(entry.manifest.version),
      'Every allowlisted package must have an auto-jsx prerelease version',
      name
    );
  }
  for (const [name, { manifest }] of packages) {
    requireCondition(
      Object.hasOwn(releasePackages, name) ||
        !String(manifest.version).includes('-'),
      'A package outside the release allowlist has a prerelease version',
      name
    );
  }
  for (const group of [
    ['gt', 'gtx-cli'],
    [
      '@generaltranslation/react-core',
      'gt-next',
      'gt-react',
      'gt-react-native',
      'gt-tanstack-start',
    ],
  ]) {
    requireCondition(
      new Set(group.map((name) => packages.get(name).manifest.version)).size ===
        1,
      'A Changesets fixed group has inconsistent versions',
      group
    );
  }
}

export async function readPreState(root, ops, { consumed = false } = {}) {
  const state = await readJson(ops, path.join(root, '.changeset/pre.json'));
  requireCondition(
    state &&
      state.mode === 'pre' &&
      state.tag === channel &&
      Array.isArray(state.changesets) &&
      state.changesets.every((id) => typeof id === 'string') &&
      state.initialVersions &&
      typeof state.initialVersions === 'object' &&
      !Array.isArray(state.initialVersions),
    'The branch must remain in auto-jsx prerelease mode'
  );
  if (consumed) {
    const used = new Set(state.changesets);
    const pending = (await ops.list(path.join(root, '.changeset'))).filter(
      (file) =>
        !['README.md', 'config.json', 'pre.json'].includes(file) &&
        !(file.endsWith('.md') && used.has(file.slice(0, -3)))
    );
    requireCondition(
      pending.length === 0,
      'Unconsumed changesets must be versioned before publishing',
      pending
    );
  }
  return state;
}

export async function verifyCheckout(root, ops, expectedSha) {
  requireCondition(
    typeof expectedSha === 'string' &&
      expectedSha.length === 40 &&
      /^[a-f0-9]{40}$/.test(expectedSha),
    'An exact 40-character expected Git SHA is required'
  );
  const branch = String(
    await ops.run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
      cwd: root,
    })
  ).trim();
  requireCondition(
    branch === releaseBranch,
    'Publishing requires the dedicated auto-jsx branch',
    branch
  );
  const sha = String(
    await ops.run('git', ['rev-parse', 'HEAD'], { cwd: root })
  ).trim();
  requireCondition(
    sha === expectedSha,
    'The checkout does not match the expected release SHA',
    [expectedSha, sha]
  );
  const status = String(
    await ops.run('git', ['status', '--porcelain=v1', '--untracked-files=no'], {
      cwd: root,
    })
  ).trim();
  requireCondition(
    !status,
    'Tracked files must be clean before releasing',
    status
  );
}

export function isReleasePush(env, expectedSha) {
  return (
    env.GITHUB_REPOSITORY === releaseRepository &&
    env.GITHUB_EVENT_NAME === 'push' &&
    env.GITHUB_REF === `refs/heads/${releaseBranch}` &&
    env.GITHUB_SHA === expectedSha
  );
}

export function requireExecutionContext(env, expectedSha) {
  requireCondition(
    isReleasePush(env, expectedSha) &&
      env.ACTIONS_ID_TOKEN_REQUEST_TOKEN &&
      env.ACTIONS_ID_TOKEN_REQUEST_URL,
    'Publishing requires an experimental branch push with matching SHA and OIDC'
  );
}

export function digest(bytes) {
  return {
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    shasum: createHash('sha1').update(bytes).digest('hex'),
  };
}

export function protectedTags(metadata) {
  return {
    latest: metadata?.['dist-tags']?.latest ?? null,
    bin: metadata?.['dist-tags']?.bin ?? null,
  };
}

export function verifyRegistryArtifact(candidate, metadata) {
  const published = metadata?.versions?.[candidate.version];
  if (!published) return false;
  requireCondition(
    published.name === candidate.name &&
      published.version === candidate.version &&
      (published.dist?.integrity
        ? published.dist.integrity === candidate.integrity
        : published.dist?.shasum === candidate.shasum),
    'The existing registry version does not match the verified tarball',
    `${candidate.name}@${candidate.version}`
  );
  return true;
}
