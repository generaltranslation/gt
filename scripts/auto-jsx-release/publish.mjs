#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { formatDiagnosticErrorDetails } from 'generaltranslation/internal';
import { inspectArtifact } from './artifact.mjs';
import { findMergedReleasePullRequest } from './authorize.mjs';
import { nativeOperations } from './io.mjs';
import {
  channel,
  dependencyFields,
  digest,
  protectedTags,
  readPreState,
  readWorkspace,
  registryUrl,
  releaseBranch,
  releaseError,
  releasePackages,
  requireCondition,
  requireExecutionContext,
  validateVersions,
  verifyCheckout,
  verifyRegistryArtifact,
} from './shared.mjs';

export function parseArguments(args) {
  const options = { execute: false };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--execute' && !options.execute) {
      options.execute = true;
    } else if (args[index] === '--expected-sha' && !options.expectedSha) {
      options.expectedSha = args[++index];
    } else {
      throw releaseError('Unknown or duplicate release argument', args[index]);
    }
  }
  requireCondition(
    options.expectedSha?.length === 40 &&
      /^[a-f0-9]{40}$/.test(options.expectedSha),
    'Pass --expected-sha with the exact reviewed commit SHA'
  );
  return options;
}

async function unchangedArtifacts(root, ops, expectedSha, candidates) {
  await verifyCheckout(root, ops, expectedSha);
  for (const candidate of candidates) {
    requireCondition(
      digest(await ops.read(candidate.tarball)).integrity ===
        candidate.integrity,
      'A validated tarball changed before publication',
      candidate.name
    );
  }
}

function unchangedTags(candidate, metadata) {
  requireCondition(
    JSON.stringify(protectedTags(metadata)) ===
      JSON.stringify(candidate.protectedTags),
    'A stable registry tag changed during the experimental release',
    candidate.name
  );
}

export async function publishRelease({
  root,
  expectedSha,
  execute = false,
  ops = nativeOperations(),
}) {
  await verifyCheckout(root, ops, expectedSha);
  if (execute) {
    requireExecutionContext(ops.env, expectedSha);
    requireCondition(
      await findMergedReleasePullRequest({ expectedSha, ops }),
      'Publishing requires the matching merged Changesets release pull request'
    );
  }
  await readPreState(root, ops, { consumed: true });
  const workspace = await readWorkspace(root, ops);
  validateVersions(workspace);
  const directory = await ops.temporaryDirectory();
  ops.log(`Release artifacts will be retained in ${directory}`);
  const candidates = [];

  // Complete the entire pack/manifest preflight before any registry writes.
  for (const [name, packageDirectory] of Object.entries(releasePackages)) {
    const tarball = path.join(directory, `${packageDirectory}.tgz`);
    await ops.run(
      'pnpm',
      ['--config.ignore-scripts=true', 'pack', '--out', tarball, '--json'],
      { cwd: path.join(root, 'packages', packageDirectory) }
    );
    candidates.push(
      await inspectArtifact(
        ops,
        tarball,
        workspace.get(name).manifest,
        workspace
      )
    );
  }

  const metadata = new Map();
  const registry = async (name) => {
    if (!metadata.has(name)) metadata.set(name, await ops.registry(name));
    return metadata.get(name);
  };
  for (const candidate of candidates) {
    const current = await registry(candidate.name);
    candidate.protectedTags = protectedTags(current);
    candidate.alreadyPublished = verifyRegistryArtifact(candidate, current);
    for (const field of dependencyFields.filter(
      (field) => field !== 'devDependencies'
    )) {
      for (const name of Object.keys(candidate.manifest[field] ?? {})) {
        if (!workspace.has(name) || Object.hasOwn(releasePackages, name)) {
          continue;
        }
        const version = workspace.get(name).manifest.version;
        requireCondition(
          (await registry(name))?.versions?.[version],
          'A required stable workspace dependency is not published',
          `${candidate.name}: ${name}@${version}`
        );
      }
    }
  }

  await unchangedArtifacts(root, ops, expectedSha, candidates);
  const report = {
    branch: releaseBranch,
    tag: channel,
    expectedSha,
    execute,
    directory,
    candidates: candidates.map(
      ({ manifest: _manifest, ...candidate }) => candidate
    ),
    published: [],
  };
  const reportPath = path.join(directory, 'release-plan.json');
  await ops.write(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!execute) {
    ops.log(`Validated ${candidates.length} packages; nothing was published`);
    return report;
  }

  for (const candidate of candidates) {
    // Recheck the branch and every artifact after each previous registry write.
    await unchangedArtifacts(root, ops, expectedSha, candidates);
    const current = await ops.registry(candidate.name);
    unchangedTags(candidate, current);
    if (verifyRegistryArtifact(candidate, current)) {
      ops.log(`Already published: ${candidate.name}@${candidate.version}`);
      continue;
    }
    try {
      await ops.run(
        'npm',
        [
          'publish',
          candidate.tarball,
          '--tag',
          channel,
          '--access',
          'public',
          `--registry=${registryUrl}`,
          '--ignore-scripts',
          '--provenance',
        ],
        { cwd: directory }
      );
    } catch (error) {
      // npm may report a transport error after accepting the immutable version.
      // Never retry or retag blindly; a later run also takes this same skip path.
      const afterError = await ops.registry(candidate.name);
      unchangedTags(candidate, afterError);
      if (!verifyRegistryArtifact(candidate, afterError)) throw error;
    }
    const published = await ops.registry(candidate.name);
    unchangedTags(candidate, published);
    requireCondition(
      verifyRegistryArtifact(candidate, published),
      'The registry did not confirm the published artifact',
      `${candidate.name}@${candidate.version}`
    );
    report.published.push({ name: candidate.name, version: candidate.version });
    await ops.write(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    ops.log(`Published: ${candidate.name}@${candidate.version}`);
  }
  // Also check already-published packages, which deliberately receive no tag writes.
  for (const candidate of candidates) {
    unchangedTags(candidate, await ops.registry(candidate.name));
  }
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  try {
    await publishRelease({ root, ...parseArguments(process.argv.slice(2)) });
  } catch (error) {
    console.error(
      releaseError(
        'The experimental release stopped',
        formatDiagnosticErrorDetails(error)
      ).message
    );
    process.exitCode = 1;
  }
}
