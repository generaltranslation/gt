#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { formatDiagnosticErrorDetails } from 'generaltranslation/internal';
import { nativeOperations } from './io.mjs';
import {
  isReleasePush,
  mergedReleaseTitle,
  releaseBranch,
  releaseError,
  releaseRepository,
  requireCondition,
  versionBranch,
} from './shared.mjs';

function requireExpectedSha(expectedSha) {
  requireCondition(
    typeof expectedSha === 'string' &&
      expectedSha.length === 40 &&
      /^[a-f0-9]{40}$/.test(expectedSha),
    'Pass --expected-sha with the exact pushed commit SHA'
  );
}

export function parseAuthorizationArguments(args) {
  requireCondition(
    args.length === 2 && args[0] === '--expected-sha',
    'Release authorization accepts only --expected-sha and its commit SHA'
  );
  requireExpectedSha(args[1]);
  return { expectedSha: args[1] };
}

function matchesMergedVersionPullRequest(pullRequest, expectedSha) {
  return (
    pullRequest &&
    Number.isSafeInteger(pullRequest.number) &&
    pullRequest.number > 0 &&
    pullRequest.title === mergedReleaseTitle &&
    pullRequest.state === 'closed' &&
    typeof pullRequest.merged_at === 'string' &&
    Number.isFinite(Date.parse(pullRequest.merged_at)) &&
    pullRequest.merge_commit_sha === expectedSha &&
    pullRequest.head?.ref === versionBranch &&
    pullRequest.base?.ref === releaseBranch &&
    pullRequest.head?.repo?.full_name === releaseRepository &&
    pullRequest.base?.repo?.full_name === releaseRepository
  );
}

export async function findMergedReleasePullRequest({
  expectedSha,
  ops = nativeOperations(),
}) {
  requireExpectedSha(expectedSha);
  if (!isReleasePush(ops.env, expectedSha)) return undefined;
  const associated = await ops.associatedPullRequests(expectedSha);
  requireCondition(
    Array.isArray(associated),
    'GitHub returned an invalid associated pull request list'
  );
  for (const candidate of associated) {
    if (!matchesMergedVersionPullRequest(candidate, expectedSha)) continue;
    // The associated-commit endpoint does not expose the definitive merged
    // boolean. Re-read the matching PR and verify its current full metadata.
    const pullRequest = await ops.pullRequest(candidate.number);
    if (
      pullRequest?.number === candidate.number &&
      pullRequest.merged === true &&
      matchesMergedVersionPullRequest(pullRequest, expectedSha)
    ) {
      return pullRequest;
    }
  }
  return undefined;
}

export async function authorizeRelease({
  expectedSha,
  ops = nativeOperations(),
}) {
  requireCondition(
    typeof ops.env.GITHUB_OUTPUT === 'string' &&
      ops.env.GITHUB_OUTPUT.length > 0,
    'GITHUB_OUTPUT is required to report release authorization'
  );
  const pullRequest = await findMergedReleasePullRequest({ expectedSha, ops });
  const publish = Boolean(pullRequest);
  await ops.append(ops.env.GITHUB_OUTPUT, `publish=${publish}\n`);
  ops.log(
    publish
      ? `Merged Changesets release PR #${pullRequest.number} authorizes this release`
      : 'This push does not merge a matching Changesets release PR; publication is skipped'
  );
  return publish;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    await authorizeRelease(parseAuthorizationArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(
      releaseError(
        'Release authorization stopped',
        formatDiagnosticErrorDetails(error)
      ).message
    );
    process.exitCode = 1;
  }
}
