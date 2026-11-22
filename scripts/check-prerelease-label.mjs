#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_BASE_HOPS = 10;
const PRE_JSON_PATH = '.changeset/pre.json';

export async function resolveBaseChain(
  baseRef,
  findParentBase,
  maxHops = MAX_BASE_HOPS
) {
  const chain = [baseRef];
  while (chain.length <= maxHops) {
    const parentBase = await findParentBase(chain[chain.length - 1]);
    if (parentBase === null) return { chain, stoppedEarly: false };
    if (chain.includes(parentBase)) return { chain, stoppedEarly: true };
    chain.push(parentBase);
  }
  return { chain, stoppedEarly: true };
}

export function isPrereleasePreJson(preJsonText) {
  if (preJsonText === null) return false;
  try {
    const { mode } = JSON.parse(preJsonText);
    // `changeset pre exit` keeps pre.json with mode "exit" until the final release deletes it.
    return mode === 'pre' || mode === 'exit';
  } catch {
    return false;
  }
}

export function decidePrereleaseLabel({ chain, isPrerelease, labels }) {
  const landingBranch = chain[chain.length - 1];
  const route = chain.join(' -> ');
  if (!isPrerelease) {
    return {
      ok: true,
      requiredLabel: null,
      message: `This pull request lands on ${landingBranch} (${route}), which is not a prerelease branch, so no label is required.`,
    };
  }
  if (labels.includes(landingBranch)) {
    return {
      ok: true,
      requiredLabel: landingBranch,
      message: `This pull request lands on the ${landingBranch} prerelease branch (${route}) and has the ${landingBranch} label.`,
    };
  }
  return {
    ok: false,
    requiredLabel: landingBranch,
    message: `This pull request lands on the ${landingBranch} prerelease branch (${route}) but is missing the ${landingBranch} label.`,
  };
}

function createGitHubClient({ token, repository, fetchImpl = fetch }) {
  const apiUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  return async function request(route, accept = 'application/vnd.github+json') {
    const response = await fetchImpl(`${apiUrl}/repos/${repository}${route}`, {
      headers: {
        Accept: accept,
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(
        `GitHub API ${route} responded ${response.status}: ${await response.text()}`
      );
    }
    return accept.endsWith('raw+json') ? response.text() : response.json();
  };
}

export async function run({
  token,
  repository,
  pullNumber,
  fetchImpl = fetch,
  log = (line) => process.stdout.write(`${line}\n`),
  logError = console.error,
}) {
  const request = createGitHubClient({ token, repository, fetchImpl });
  const owner = repository.split('/')[0];

  const pull = await request(`/pulls/${pullNumber}`);
  const labels = pull.labels.map((label) => label.name);

  const findParentBase = async (branch) => {
    const parents = await request(
      `/pulls?state=open&sort=created&direction=asc&head=${encodeURIComponent(`${owner}:${branch}`)}`
    );
    return parents?.[0]?.base.ref ?? null;
  };
  const { chain, stoppedEarly } = await resolveBaseChain(
    pull.base.ref,
    findParentBase
  );
  if (stoppedEarly) {
    log(
      `::warning title=Base chain cut short::Stopped following stacked pull requests after ${chain.join(' -> ')} (cycle or more than ${MAX_BASE_HOPS} hops); checking ${chain[chain.length - 1]}.`
    );
  }

  const landingBranch = chain[chain.length - 1];
  const preJsonText = await request(
    `/contents/${PRE_JSON_PATH}?ref=${encodeURIComponent(landingBranch)}`,
    'application/vnd.github.raw+json'
  );
  const decision = decidePrereleaseLabel({
    chain,
    isPrerelease: isPrereleasePreJson(preJsonText),
    labels,
  });

  if (decision.ok) {
    log(decision.message);
    return 0;
  }
  logError(
    `::error title=Missing ${decision.requiredLabel} label::${decision.message} Add it with: gh pr edit ${pullNumber} --add-label ${decision.requiredLabel}`
  );
  return 1;
}

const executedFile = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (executedFile === import.meta.url) {
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, 'utf8')
  );
  process.exitCode = await run({
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    pullNumber: event.pull_request.number,
  });
}
