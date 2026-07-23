#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const base = process.argv[2] ?? 'HEAD^';
const head = process.argv[3] ?? 'HEAD';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function parseStableVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match?.slice(1).map(Number);
}

function compareVersions(left, right) {
  const leftParts = parseStableVersion(left);
  const rightParts = parseStableVersion(right);

  if (!leftParts || !rightParts) return undefined;

  for (let index = 0; index < leftParts.length; index++) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

const changedManifests = git(
  'diff',
  '--name-only',
  '--diff-filter=AM',
  base,
  head,
  '--',
  'packages/*/package.json'
)
  .split('\n')
  .filter(Boolean);

const errors = [];

const packageManifests = git(
  'ls-tree',
  '-r',
  '--name-only',
  head,
  '--',
  'packages'
)
  .split('\n')
  .filter((path) => /^packages\/[^/]+\/package\.json$/.test(path))
  .map((path) => ({
    path,
    manifest: JSON.parse(git('show', `${head}:${path}`)),
  }));

const workspacePackages = new Map(
  packageManifests
    .filter(({ manifest }) => manifest.name)
    .map(({ manifest }) => [manifest.name, manifest])
);

for (const { path, manifest } of packageManifests) {
  for (const [peerName, peerRange] of Object.entries(
    manifest.peerDependencies ?? {}
  )) {
    if (!workspacePackages.has(peerName)) continue;

    if (!peerRange.startsWith('workspace:')) {
      errors.push(
        `${manifest.name} declares internal peer ${peerName} with a bare semver range (${peerRange}) in ${path}; use the workspace: protocol so version bumps cannot drift the lockfile or reference an unpublished version`
      );
    }

    const workspaceRange =
      manifest.dependencies?.[peerName] ??
      manifest.devDependencies?.[peerName] ??
      manifest.optionalDependencies?.[peerName];

    if (!workspaceRange?.startsWith('workspace:')) {
      errors.push(
        `${manifest.name} declares internal peer ${peerName} without a workspace dependency in ${path}`
      );
    }
  }
}

for (const manifestPath of changedManifests) {
  const manifest = JSON.parse(git('show', `${head}:${manifestPath}`));
  if (manifest.private || !manifest.name || !manifest.version) continue;

  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(manifest.name)}`;
  const response = await fetch(registryUrl);

  if (response.status === 404) continue;
  if (!response.ok) {
    throw new Error(
      `Failed to read npm metadata for ${manifest.name}: ${response.status}`
    );
  }

  const metadata = await response.json();
  const latest = metadata['dist-tags']?.latest;

  if (metadata.versions?.[manifest.version]) {
    errors.push(`${manifest.name}@${manifest.version} is already published`);
    continue;
  }

  const versionComparison = latest
    ? compareVersions(manifest.version, latest)
    : undefined;
  if (versionComparison !== undefined && versionComparison <= 0) {
    errors.push(
      `${manifest.name}@${manifest.version} does not advance npm latest ${latest}`
    );
  }
}

if (errors.length > 0) {
  console.error('Release version validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

process.stdout.write(
  `Validated ${changedManifests.length} changed package version${changedManifests.length === 1 ? '' : 's'}.\n`
);
