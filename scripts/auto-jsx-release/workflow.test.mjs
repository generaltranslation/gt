import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  channel,
  mergedReleaseTitle,
  releaseBranch,
  releasePackages,
  releaseTitle,
  versionBranch,
} from './shared.mjs';
import { authorizeRelease } from './authorize.mjs';
import { releaseFixture } from './fixtures.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workflow = parse(
  fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8')
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8')
);
const preFile = path.join(root, '.changeset/pre.json');
const pre = fs.existsSync(preFile)
  ? JSON.parse(fs.readFileSync(preFile, 'utf8'))
  : undefined;
const expectedReleaseCommand = pre
  ? 'node scripts/auto-jsx-release/publish.mjs'
  : 'changeset publish';
const ci = parse(
  fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
);
const changesets = JSON.parse(
  fs.readFileSync(path.join(root, '.changeset/config.json'), 'utf8')
);
const version = workflow.jobs['auto-jsx-version'];
const publish = workflow.jobs['auto-jsx-publish'];
const experimentalRef = `refs/heads/${releaseBranch}`;
const compact = (text) => text.trim().replace(/\s+/g, ' ');
const commands = (job) => job.steps.filter((step) => step.run);
const uses = (job, action) =>
  job.steps.find((step) => step.uses?.startsWith(`${action}@`));
const expectedPackages = [
  '@generaltranslation/compiler',
  '@generaltranslation/react-core',
  'gt-react',
  'gt-react-native',
  'gt-tanstack-start',
  'gt-next',
  'gt',
  'gtx-cli',
  'locadex',
];

// Interpret only the exact equality/conjunction subset used by these release
// gates. Unsupported expressions fail the test instead of silently evaluating
// differently from Actions or introducing a second general expression engine.
function jobEnabled(
  job,
  eventName,
  ref,
  authorization = 'false',
  upstreamResult = 'success'
) {
  if (job.needs) {
    expect(job.needs).toBe('auto-jsx-version');
    // Actions implicitly requires successful needs unless a status function
    // overrides it; the restricted expressions below forbid that bypass.
    if (upstreamResult !== 'success') return false;
  }
  const github = {
    event_name: eventName,
    ref,
    ref_name: ref.replace(/^refs\/(?:heads|tags)\//, ''),
  };
  return job.if.split(/\s*&&\s*/).every((clause) => {
    const match = clause.match(
      /^(github\.(?:event_name|ref|ref_name)|needs\.auto-jsx-version\.outputs\.publish)\s*==\s*'([^']+)'$/
    );
    expect(match, `Unsupported release gate: ${clause}`).not.toBeNull();
    // Actions string equality is case-insensitive.
    const actual = match[1].startsWith('github.')
      ? github[match[1].slice('github.'.length)]
      : authorization;
    return actual.toLowerCase() === match[2].toLowerCase();
  });
}

function runnableJobs(
  eventName,
  ref,
  authorization = 'false',
  upstreamResult = 'success'
) {
  if (!Object.hasOwn(workflow.on, eventName)) return [];
  if (
    eventName === 'push' &&
    (!ref.startsWith('refs/heads/') ||
      !workflow.on.push.branches.includes(ref.slice('refs/heads/'.length)))
  )
    return [];
  return Object.entries(workflow.jobs)
    .filter(([, job]) =>
      jobEnabled(job, eventName, ref, authorization, upstreamResult)
    )
    .map(([name]) => name);
}

describe('experimental release events and permissions', () => {
  it('retains the registered release workflow and only the intended triggers', () => {
    expect(workflow.name).toBe('Release');
    expect(Object.keys(workflow.on)).toEqual(['push']);
    expect(workflow.on.push).toEqual({ branches: ['main', releaseBranch] });
    expect(Object.keys(workflow.jobs).sort()).toEqual(
      [
        'release',
        'auto-jsx-version',
        'auto-jsx-publish',
        'odysseus-release',
      ].sort()
    );
    expect(workflow.on.workflow_dispatch).toBeUndefined();
  });

  it.each([
    ['push', 'refs/heads/main', ['release']],
    ['push', experimentalRef, ['auto-jsx-version']],
    ['push', 'refs/heads/feature/other', []],
    ['push', 'refs/heads/odysseus', []],
    ['push', `refs/tags/${releaseBranch}`, []],
    ['workflow_dispatch', experimentalRef, []],
    ['workflow_dispatch', 'refs/heads/main', []],
    ['workflow_dispatch', 'refs/heads/odysseus', []],
    ['workflow_dispatch', 'refs/heads/feature/other', []],
    ['workflow_dispatch', `refs/tags/${releaseBranch}`, []],
    ['workflow_dispatch', 'refs/tags/main', []],
    ['pull_request', experimentalRef, []],
    ['pull_request_target', experimentalRef, []],
    ['workflow_run', experimentalRef, []],
    ['repository_dispatch', experimentalRef, []],
    ['schedule', experimentalRef, []],
  ])('runs only the expected jobs for %s on %s', (event, ref, expected) => {
    expect(runnableJobs(event, ref)).toEqual(expected);
  });

  it.each(['false', '', 'undefined'])(
    'does not publish without the verified true output (%s)',
    (output) => {
      expect(runnableJobs('push', experimentalRef, output)).toEqual([
        'auto-jsx-version',
      ]);
    }
  );

  it.each(['failure', 'cancelled', 'skipped'])(
    'does not publish when preparation %s even with an earlier true output',
    (result) => {
      expect(runnableJobs('push', experimentalRef, 'true', result)).toEqual([
        'auto-jsx-version',
      ]);
    }
  );

  it('enables publication when the real authorizer verifies the generated prerelease PR', async () => {
    const fixture = releaseFixture();
    // Pinned changesets/action appends the prerelease tag to its configured title.
    const generatedTitle = `${uses(version, 'changesets/action').with.title} (${channel})`;
    expect(generatedTitle).toBe(mergedReleaseTitle);
    fixture.context.associatedPullRequests[0].title = generatedTitle;
    fixture.context.pullRequest.title = generatedTitle;
    const authorized = await authorizeRelease(fixture);
    expect(authorized).toBe(true);
    expect(runnableJobs('push', experimentalRef, String(authorized))).toEqual([
      'auto-jsx-version',
      'auto-jsx-publish',
    ]);
  });

  it.each(['source PR', 'direct push', 'wrong Changesets branch'])(
    'does not publish a %s through the real authorizer and workflow gate',
    async (kind) => {
      const fixture = releaseFixture();
      if (kind === 'direct push') fixture.context.associatedPullRequests = [];
      else {
        fixture.context.associatedPullRequests[0].head.ref =
          kind === 'source PR'
            ? 'e/next/auto-jsx-injection'
            : 'changeset-release/main';
      }
      const authorized = await authorizeRelease(fixture);
      expect(authorized).toBe(false);
      expect(runnableJobs('push', experimentalRef, String(authorized))).toEqual(
        ['auto-jsx-version']
      );
    }
  );

  it('wires publication only to the merged-PR authorization step output', () => {
    const authorization = version.steps.find(
      (step) => step.id === 'release_authorization'
    );
    expect(authorization.run).toBe(
      'node scripts/auto-jsx-release/authorize.mjs --expected-sha "$EXPECTED_SHA"'
    );
    expect(authorization.env).toEqual({
      EXPECTED_SHA: '${{ github.sha }}',
      GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
    });
    expect(authorization.if).toBeUndefined();
    expect(version.outputs).toEqual({
      publish: '${{ steps.release_authorization.outputs.publish }}',
    });
    expect(publish.needs).toBe('auto-jsx-version');
    expect(publish.if).toContain(
      "needs.auto-jsx-version.outputs.publish == 'true'"
    );
    expect(publish.if).not.toMatch(/head_commit|message|title|hasChangesets/);
    expect(version.steps.indexOf(authorization)).toBeLessThan(
      version.steps.indexOf(uses(version, 'changesets/action'))
    );
  });

  it('does not grant publishing credentials to the version PR job', () => {
    // Explicit job permissions override the broad legacy workflow permissions;
    // omitted permissions become none, including id-token and packages.
    expect(version.permissions).toEqual({
      contents: 'write',
      'pull-requests': 'write',
    });
    expect(version.environment).toBeUndefined();
    expect(publish.permissions).toEqual({
      contents: 'read',
      'pull-requests': 'read',
      'id-token': 'write',
    });
    expect(publish.environment).toEqual({ name: 'release' });
    expect(uses(publish, 'actions/checkout').with['persist-credentials']).toBe(
      false
    );
  });

  it('serializes branch validation and merged-PR publication', () => {
    const concurrency = workflow.concurrency;
    expect(
      typeof concurrency === 'string' ? concurrency : concurrency.group
    ).toBe('${{ github.workflow }}-${{ github.ref }}');
    if (typeof concurrency === 'object')
      expect(concurrency['cancel-in-progress']).not.toBe(true);
  });
});

describe('experimental release commands', () => {
  it('preserves stable main release behavior and guards the prerelease command only in pre mode', () => {
    expect(workflow.jobs.release.if).toBe("github.ref_name == 'main'");
    expect(workflow.jobs.release.environment).toEqual({ name: 'release' });
    const stable = uses(workflow.jobs.release, 'changesets/action');
    expect(stable.with.version).toBe('pnpm run version-packages');
    expect(stable.with.publish).toBe('pnpm run release');
    expect(manifest.scripts.release).toBe(expectedReleaseCommand);
    expect(manifest.scripts['version-packages']).toBe(
      'changeset version && oxfmt packages/*/CHANGELOG.md'
    );
  });
  it('uses Changesets to prepare the normal release PR against the experimental branch', () => {
    const action = uses(version, 'changesets/action');
    expect(action.uses).toBe(
      'changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d'
    );
    expect(action.with.branch).toBe(releaseBranch);
    expect(action.with.version).toBe('pnpm run version-packages:auto-jsx');
    expect(action.with.prDraft).toBeUndefined();
    expect(action.with.title).toBe(releaseTitle);
    expect(action.with.commit).toBe(releaseTitle);
    expect(versionBranch).toBe(`changeset-release/${releaseBranch}`);
    expect(action.with.publish).toBeUndefined();
    expect(action.env).toEqual({ GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' });
    expect(uses(publish, 'changesets/action')).toBeUndefined();
    expect(manifest.scripts['version-packages:auto-jsx']).toBe(
      'node scripts/auto-jsx-release/version.mjs'
    );
  });

  it.each(['auto-jsx-version', 'auto-jsx-publish'])(
    '%s validates the pushed checkout before setup, commands, or release actions',
    (name) => {
      const job = workflow.jobs[name];
      const checkout = uses(job, 'actions/checkout');
      expect(checkout.with.ref).toBe(releaseBranch);
      expect(job.steps.indexOf(checkout)).toBe(0);
      const guard = job.steps.find((step) =>
        step.run?.includes('git rev-parse HEAD')
      );
      expect(compact(guard.run)).toBe(
        'test "$EXPECTED_SHA" = "$(git rev-parse HEAD)" && test "$EXPECTED_SHA" = "$GITHUB_SHA"'
      );
      expect(guard.env).toEqual({ EXPECTED_SHA: '${{ github.sha }}' });
      expect(guard.if).toBeUndefined();
      const guardIndex = job.steps.indexOf(guard);
      expect(guardIndex).toBe(job.steps.indexOf(checkout) + 1);
      for (const step of commands(job).filter((step) => step !== guard))
        expect(job.steps.indexOf(step)).toBeGreaterThan(guardIndex);
    }
  );

  it('keeps the preparation job read-only and publication behind verified authorization', () => {
    const dryRun = commands(version).find((step) =>
      step.run.startsWith('pnpm run release:auto-jsx ')
    );
    expect(compact(dryRun.run)).toBe(
      'pnpm run release:auto-jsx --expected-sha "$EXPECTED_SHA"'
    );
    expect(dryRun.env).toEqual({ EXPECTED_SHA: '${{ github.sha }}' });
    expect(dryRun.if).toBe("steps.versions.outputs.hasChangesets == 'false'");
    const execute = commands(publish).filter((step) =>
      step.run.includes('--execute')
    );
    expect(execute).toHaveLength(1);
    expect(compact(execute[0].run)).toBe(
      'pnpm run release:auto-jsx --expected-sha "$EXPECTED_SHA" --execute'
    );
    expect(execute[0].env).toEqual({
      EXPECTED_SHA: '${{ github.sha }}',
      GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
    });
    expect(commands(publish).at(-1)).toBe(execute[0]);
    expect(manifest.scripts['release:auto-jsx']).toBe(
      'node scripts/auto-jsx-release/publish.mjs'
    );
    expect(manifest.scripts.release).toBe(expectedReleaseCommand);
  });

  it.each(['auto-jsx-version', 'auto-jsx-publish'])(
    '%s restores the SWC artifact after transpilation and before packing',
    (name) => {
      const job = workflow.jobs[name];
      const build = commands(job).find((step) =>
        step.run.includes('turbo run')
      );
      const restore = commands(job).find(
        (step) => step.run === 'pnpm --filter gt-next run build:swc-plugin'
      );
      const pack = commands(job).find((step) =>
        step.run.startsWith('pnpm run release:auto-jsx ')
      );
      expect(restore).toBeDefined();
      expect(job.steps.indexOf(restore)).toBeGreaterThan(
        job.steps.indexOf(build)
      );
      expect(job.steps.indexOf(restore)).toBeLessThan(job.steps.indexOf(pack));
      expect(restore.if).toBe(build.if);
      expect(restore.if).toBe(pack.if);
    }
  );

  it.each(['auto-jsx-version', 'auto-jsx-publish'])(
    '%s cannot call stable, binary, R2 or PyPI publishing paths',
    (name) => {
      const job = workflow.jobs[name];
      for (const step of job.steps) {
        if (step.uses)
          expect(step.uses).toMatch(
            /^(?:actions\/(?:checkout|upload-artifact)|dtolnay\/rust-toolchain|jdx\/mise-action|changesets\/action)@[a-f0-9]{40}$/
          );
        if (step.run) {
          expect(step.run).not.toMatch(
            /(?:npm|pnpm|yarn)\s+publish|changeset\s+publish|pnpm\s+(?:run\s+)?release(?:\s|$)|release:(?:bin|gt-bin|gtx-cli-bin)|bin:prep|build:bin|\bdist-tag\b|\btwine\b|build_platform_wheels|\baws\s|\bwrangler\s|\bcurl\s|\bwget\s/
          );
          expect(step.run).not.toMatch(/\$\{\{\s*inputs\./);
        }
        expect(JSON.stringify(step)).not.toMatch(
          /R2_|cli\/latest|gtx-cli\/latest|PYPI_API_TOKEN|TWINE_PASSWORD|NPM_TOKEN|NODE_AUTH_TOKEN|--tag\s+(?:latest|bin)/
        );
      }
    }
  );

  it.each(['auto-jsx-version', 'auto-jsx-publish'])(
    '%s builds only the allowlist and runs isolation tests',
    (name) => {
      const job = workflow.jobs[name];
      expect(job['continue-on-error']).not.toBe(true);
      for (const step of job.steps)
        expect(step['continue-on-error']).not.toBe(true);
      const build = commands(job).find((step) =>
        step.run.includes('turbo run')
      );
      const tokens = compact(build.run).split(' ');
      expect(tokens.slice(0, 5)).toEqual([
        'pnpm',
        'exec',
        'turbo',
        'run',
        'build:release',
      ]);
      expect(tokens.slice(5).sort()).toEqual(
        expectedPackages.map((pkg) => `--filter=${pkg}`).sort()
      );
      expect(
        commands(job).some(
          (step) => step.run === 'pnpm install --frozen-lockfile'
        )
      ).toBe(true);
      expect(
        commands(job).some(
          (step) => step.run === 'pnpm run test:release:auto-jsx'
        )
      ).toBe(true);
      const test = commands(job).find(
        (step) => step.run === 'pnpm run test:release:auto-jsx'
      );
      expect(test.if).toBeUndefined();
      const release =
        name === 'auto-jsx-version'
          ? uses(job, 'changesets/action')
          : commands(job).find((step) => step.run.includes('--execute'));
      expect(job.steps.indexOf(test)).toBeLessThan(job.steps.indexOf(release));
      expect(uses(job, 'dtolnay/rust-toolchain').with.targets).toBe(
        'wasm32-wasip1'
      );
    }
  );

  it.each(['auto-jsx-version', 'auto-jsx-publish'])(
    '%s retains only its reviewed release artifacts, including on failure',
    (name) => {
      const artifact = uses(workflow.jobs[name], 'actions/upload-artifact');
      expect(artifact.if).toBe('always()');
      expect(artifact.with['retention-days']).toBe(14);
      expect(artifact.with.name).toContain('${{ github.sha }}');
      expect(artifact.with.path.trim().split('\n')).toEqual([
        '/tmp/gt-auto-jsx-release-*/*.tgz',
        '/tmp/gt-auto-jsx-release-*/release-plan.json',
        ...(name === 'auto-jsx-version'
          ? ['/tmp/gt-auto-jsx-release-*/version-plan.json']
          : []),
      ]);
    }
  );
});

it('runs release guard tests in ordinary PR CI before infrastructure enters pre mode', () => {
  expect(ci.on.pull_request).toBeDefined();
  const tests = ci.jobs.tests;
  const build = commands(tests).find(
    (step) =>
      step.run ===
      "pnpm --filter 'generaltranslation...' -r exec tsdown --no-clean"
  );
  const guard = commands(tests).find(
    (step) => step.run === 'pnpm run test:release:auto-jsx'
  );
  expect(build).toBeDefined();
  expect(guard).toBeDefined();
  expect(tests.steps.indexOf(build)).toBeLessThan(tests.steps.indexOf(guard));
  expect(guard.if).toBeUndefined();
  expect(guard['continue-on-error']).not.toBe(true);
  expect(manifest.scripts['test:release:auto-jsx']).toBe(
    'vitest run --config scripts/auto-jsx-release/vitest.config.mjs'
  );
  expect(
    fs.readFileSync(
      path.join(root, 'scripts/auto-jsx-release/vitest.config.mjs'),
      'utf8'
    )
  ).toContain('scripts/auto-jsx-release/*.test.mjs');
});

describe('Changesets experimental scope', () => {
  it('pins the channel and includes both complete fixed groups', () => {
    expect(channel).toBe('auto-jsx');
    expect(releaseBranch).toBe('e/release/auto-jsx-experimental');
    expect(Object.keys(releasePackages).sort()).toEqual(
      expectedPackages.slice().sort()
    );
    // Infrastructure lands on main before the separate feature PR enters pre mode.
    if (pre) {
      expect(pre.mode).toBe('pre');
      expect(pre.tag).toBe(channel);
    }
    for (const group of changesets.fixed)
      if (group.some((name) => Object.hasOwn(releasePackages, name)))
        for (const name of group) expect(releasePackages).toHaveProperty(name);
  });

  it('includes every public runtime dependent of an experimental package', () => {
    for (const directory of fs.readdirSync(path.join(root, 'packages'))) {
      const file = path.join(root, 'packages', directory, 'package.json');
      if (!fs.existsSync(file)) continue;
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (pkg.private || Object.hasOwn(releasePackages, pkg.name)) continue;
      // Development-only dependents do not need an experimental public release.
      const runtime = {
        ...pkg.dependencies,
        ...pkg.optionalDependencies,
        ...pkg.peerDependencies,
      };
      expect(
        Object.keys(runtime).filter((name) =>
          Object.hasOwn(releasePackages, name)
        ),
        `Missing prerelease dependent: ${pkg.name}`
      ).toEqual([]);
    }
  });
});
