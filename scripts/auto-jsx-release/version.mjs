#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { formatDiagnosticErrorDetails } from 'generaltranslation/internal';
import { nativeOperations } from './io.mjs';
import {
  isChannelVersion,
  readJson,
  readPreState,
  readWorkspace,
  releaseBranch,
  releaseError,
  releasePackages,
  requireCondition,
  validateVersions,
} from './shared.mjs';

export function validateVersionPlan(plan, workspace) {
  requireCondition(
    Array.isArray(plan.releases) && Array.isArray(plan.changesets),
    'Changesets did not return a valid release plan'
  );
  for (const changeset of plan.changesets) {
    for (const release of changeset.releases) {
      requireCondition(
        Object.hasOwn(releasePackages, release.name),
        'A pending changeset is outside the auto-jsx release scope',
        `${changeset.id}: ${release.name}`
      );
    }
  }
  for (const release of plan.releases) {
    if (release.type === 'none') continue;
    requireCondition(
      Object.hasOwn(releasePackages, release.name) &&
        workspace.has(release.name) &&
        isChannelVersion(release.newVersion),
      'Changesets would release a package outside the experimental channel',
      `${release.name}@${release.newVersion}`
    );
  }
}

export async function versionPackages({
  root,
  ops = nativeOperations(),
  registerRestore = () => () => {},
}) {
  const branch = String(
    await ops.run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
      cwd: root,
    })
  ).trim();
  requireCondition(
    [releaseBranch, `changeset-release/${releaseBranch}`].includes(branch),
    'Versioning requires the auto-jsx branch or its generated release PR',
    branch
  );
  await readPreState(root, ops);
  const workspace = await readWorkspace(root, ops);
  const configPath = path.join(root, '.changeset/config.json');
  const original = await ops.read(configPath);
  const config = JSON.parse(String(original));
  const directory = await ops.temporaryDirectory();
  await ops.write(
    path.join(directory, 'changeset-config.original.json'),
    original
  );
  ops.log(`Versioning evidence will be retained in ${directory}`);
  const unregister = registerRestore(configPath, original);
  try {
    await ops.write(
      configPath,
      `${JSON.stringify(
        {
          ...config,
          baseBranch: releaseBranch,
          changelog: '@changesets/cli/changelog',
        },
        null,
        2
      )}\n`
    );
    const planPath = path.join(directory, 'version-plan.json');
    await ops.run(
      'pnpm',
      [
        'exec',
        'changeset',
        'status',
        '--output',
        path.relative(root, planPath),
      ],
      { cwd: root }
    );
    validateVersionPlan(await readJson(ops, planPath), workspace);
    await ops.run('pnpm', ['run', 'version-packages'], { cwd: root });
    await readPreState(root, ops);
    const versioned = await readWorkspace(root, ops);
    validateVersions(versioned);
    for (const [name, { manifest }] of workspace) {
      if (Object.hasOwn(releasePackages, name)) continue;
      requireCondition(
        versioned.get(name)?.manifest.version === manifest.version,
        'Versioning changed a package outside the release allowlist',
        name
      );
    }
  } finally {
    try {
      await ops.write(configPath, original);
    } finally {
      unregister();
    }
  }
}

function restoreOnSignal(configPath, original) {
  const handlers = new Map(
    [
      ['SIGINT', 130],
      ['SIGTERM', 143],
      ['SIGHUP', 129],
    ].map(([signal, code]) => {
      const handler = () => {
        fs.writeFileSync(configPath, original);
        process.exit(code);
      };
      process.once(signal, handler);
      return [signal, handler];
    })
  );
  return () => {
    for (const [signal, handler] of handlers) {
      process.removeListener(signal, handler);
    }
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  try {
    requireCondition(
      process.argv.length === 2,
      'The version wrapper does not accept arguments'
    );
    await versionPackages({ root, registerRestore: restoreOnSignal });
  } catch (error) {
    console.error(
      releaseError(
        'Experimental versioning stopped',
        formatDiagnosticErrorDetails(error)
      ).message
    );
    process.exitCode = 1;
  }
}
