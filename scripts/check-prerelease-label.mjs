#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_BASE_HOPS = 10;
const PRE_JSON_PATH = '.changeset/pre.json';

export async function findPrereleaseBranch(
  baseRef,
  { readPreJson, findParentBase },
  maxHops = MAX_BASE_HOPS
) {
  const chain = [baseRef];
  for (;;) {
    const branch = chain[chain.length - 1];
    const label = preModeLabel(await readPreJson(branch), branch);
    if (label !== null) return { chain, label, stoppedEarly: false };
    if (chain.length > maxHops) return { chain, label, stoppedEarly: true };
    const parentBase = await findParentBase(branch);
    if (parentBase === null) return { chain, label, stoppedEarly: false };
    if (chain.includes(parentBase)) return { chain, label, stoppedEarly: true };
    chain.push(parentBase);
  }
}

export function preModeLabel(preJsonText, branch) {
  if (preJsonText === null) return null;
  let preJson;
  try {
    preJson = JSON.parse(preJsonText);
  } catch {
    return null;
  }
  // `changeset pre exit` keeps pre.json with mode "exit" until the final release deletes it.
  if (preJson?.mode !== 'pre' && preJson?.mode !== 'exit') return null;
  return typeof preJson.tag === 'string' && preJson.tag !== ''
    ? preJson.tag
    : branch;
}

export function decidePrereleaseLabel({ chain, label, labels }) {
  const landingBranch = chain[chain.length - 1];
  const route = chain.join(' -> ');
  if (label === null) {
    return {
      ok: true,
      requiredLabel: null,
      message: `This pull request does not land on a prerelease branch (${route}), so no label is required.`,
    };
  }
  const where = `This pull request lands on ${landingBranch} (${route}), which is in ${label} pre mode`;
  if (labels.includes(label)) {
    return {
      ok: true,
      requiredLabel: label,
      message: `${where}, and has the ${label} label.`,
    };
  }
  return {
    ok: false,
    requiredLabel: label,
    message: `${where}, but is missing the ${label} label.`,
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

  const readPreJson = (branch) =>
    request(
      `/contents/${PRE_JSON_PATH}?ref=${encodeURIComponent(branch)}`,
      'application/vnd.github.raw+json'
    );
  const findParentBase = async (branch) => {
    const parents = await request(
      `/pulls?state=open&sort=created&direction=asc&head=${encodeURIComponent(`${owner}:${branch}`)}`
    );
    return parents?.[0]?.base.ref ?? null;
  };
  const { chain, label, stoppedEarly } = await findPrereleaseBranch(
    pull.base.ref,
    { readPreJson, findParentBase }
  );
  if (stoppedEarly) {
    log(
      `::warning title=Base chain cut short::Stopped following stacked pull requests after ${chain.join(' -> ')} (cycle or more than ${MAX_BASE_HOPS} hops) without reaching a prerelease branch.`
    );
  }

  const decision = decidePrereleaseLabel({ chain, label, labels });

  if (decision.ok) {
    log(decision.message);
    return 0;
  }
  logError(
    `::error title=Missing ${decision.requiredLabel} label::${decision.message} Maintainers can add it with: gh pr edit ${pullNumber} --add-label ${decision.requiredLabel}. Without triage access, ask a maintainer in this pull request to add it.`
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
