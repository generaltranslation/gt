import { describe, expect, it } from 'vitest';
import {
  authorizeRelease,
  findMergedReleasePullRequest,
  parseAuthorizationArguments,
} from './authorize.mjs';
import {
  expectedSha,
  mergedReleasePullRequest,
  releaseFixture,
} from './fixtures.mjs';
import { publishRelease } from './publish.mjs';

const unauthorizedPullRequests = [
  ['ordinary feature title', (pr) => (pr.title = 'feat: update translations')],
  [
    'old release title',
    (pr) => (pr.title = 'chore: version auto-jsx prerelease'),
  ],
  ['bare release title', (pr) => (pr.title = '[ci] auto-jsx release')],
  ['other prerelease tag', (pr) => (pr.title = '[ci] auto-jsx release (iris)')],
  [
    'arbitrary release suffix',
    (pr) => (pr.title = '[ci] auto-jsx release (approved)'),
  ],
  ['suffix on release title', (pr) => (pr.title += ' (#2251)')],
  ['trailing title newline', (pr) => (pr.title += '\n')],
  ['open PR', (pr) => (pr.state = 'open')],
  ['unmerged PR', (pr) => (pr.merged_at = null)],
  ['invalid merge date', (pr) => (pr.merged_at = 'not a date')],
  ['different merge SHA', (pr) => (pr.merge_commit_sha = 'a'.repeat(40))],
  ['missing merge SHA', (pr) => delete pr.merge_commit_sha],
  ['ordinary source branch', (pr) => (pr.head.ref = 'e/next/some-feature')],
  [
    'old Changesets branch',
    (pr) => (pr.head.ref = 'changeset-release/e/release/auto-jsx-alpha'),
  ],
  ['wrong base branch', (pr) => (pr.base.ref = 'main')],
  ['fork source repository', (pr) => (pr.head.repo.full_name = 'someone/gt')],
  ['other base repository', (pr) => (pr.base.repo.full_name = 'someone/gt')],
  ['missing source repository', (pr) => (pr.head.repo = null)],
  ['missing base repository', (pr) => (pr.base.repo = null)],
  ['string PR number', (pr) => (pr.number = '2251')],
  ['invalid PR number', (pr) => (pr.number = -1)],
];

describe('merged Changesets release authorization', () => {
  it('authorizes the exact merged release PR without requiring OIDC', async () => {
    const fixture = releaseFixture();
    expect(fixture.context.associatedPullRequests[0].title).toBe(
      '[ci] auto-jsx release (auto-jsx)'
    );
    delete fixture.ops.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    delete fixture.ops.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    fixture.context.files.set(
      '/actions/output',
      Buffer.from('earlier=value\n')
    );
    expect(await authorizeRelease(fixture)).toBe(true);
    expect(String(fixture.context.files.get('/actions/output'))).toBe(
      'earlier=value\npublish=true\n'
    );
    expect(fixture.ops.associatedPullRequests).toHaveBeenCalledExactlyOnceWith(
      expectedSha
    );
    expect(fixture.ops.pullRequest).toHaveBeenCalledExactlyOnceWith(2251);
    expect(fixture.ops.run).not.toHaveBeenCalled();
    expect(fixture.context.temporaryDirectories).toBe(0);
  });

  it('returns false on an ordinary direct push', async () => {
    const fixture = releaseFixture();
    fixture.context.associatedPullRequests = [];
    expect(await authorizeRelease(fixture)).toBe(false);
    expect(String(fixture.context.files.get('/actions/output'))).toBe(
      'publish=false\n'
    );
    expect(fixture.ops.pullRequest).not.toHaveBeenCalled();
  });

  it.each(unauthorizedPullRequests)(
    'does not authorize %s',
    async (_label, alter) => {
      const fixture = releaseFixture();
      alter(fixture.context.associatedPullRequests[0]);
      expect(await authorizeRelease(fixture)).toBe(false);
      expect(String(fixture.context.files.get('/actions/output'))).toBe(
        'publish=false\n'
      );
      expect(fixture.ops.pullRequest).not.toHaveBeenCalled();
    }
  );

  it.each(unauthorizedPullRequests)(
    'rechecks %s on the full PR response',
    async (_label, alter) => {
      const fixture = releaseFixture();
      alter(fixture.context.pullRequest);
      expect(await authorizeRelease(fixture)).toBe(false);
      expect(fixture.ops.pullRequest).toHaveBeenCalledExactlyOnceWith(2251);
    }
  );

  it.each([false, undefined, 'true'])(
    'requires definitive merged=true, not %j',
    async (merged) => {
      const fixture = releaseFixture();
      fixture.context.pullRequest.merged = merged;
      expect(await authorizeRelease(fixture)).toBe(false);
    }
  );

  it('requires full details to describe the same associated PR number', async () => {
    const fixture = releaseFixture();
    fixture.context.pullRequest.number = 2252;
    expect(await authorizeRelease(fixture)).toBe(false);
  });

  it('ignores unrelated associations and recognizes the exact release association', async () => {
    const fixture = releaseFixture();
    fixture.context.associatedPullRequests.unshift({
      ...mergedReleasePullRequest(),
      title: 'unrelated',
    });
    expect(await authorizeRelease(fixture)).toBe(true);
    expect(fixture.ops.pullRequest).toHaveBeenCalledOnce();
  });

  it.each([
    ['GITHUB_EVENT_NAME', 'workflow_dispatch'],
    ['GITHUB_EVENT_NAME', 'pull_request'],
    ['GITHUB_REPOSITORY', 'someone/gt'],
    ['GITHUB_REF', 'refs/heads/main'],
    ['GITHUB_REF', 'refs/tags/e/release/auto-jsx-experimental'],
    ['GITHUB_REF', 'refs/heads/e/release/auto-jsx-alpha'],
    ['GITHUB_SHA', 'a'.repeat(40)],
  ])(
    'rejects the wrong event context %s=%s without making API requests',
    async (key, value) => {
      const fixture = releaseFixture();
      fixture.ops.env[key] = value;
      expect(await authorizeRelease(fixture)).toBe(false);
      expect(fixture.ops.associatedPullRequests).not.toHaveBeenCalled();
    }
  );

  it.each(['onAssociatedPullRequests', 'onPullRequest'])(
    'fails closed on %s API errors',
    async (hook) => {
      const fixture = releaseFixture();
      fixture.context[hook] = () => {
        throw new Error('GitHub unavailable');
      };
      await expect(authorizeRelease(fixture)).rejects.toThrow(
        'GitHub unavailable'
      );
      expect(fixture.context.files.has('/actions/output')).toBe(false);
    }
  );

  it('requires an output file for the workflow command', async () => {
    const fixture = releaseFixture();
    delete fixture.ops.env.GITHUB_OUTPUT;
    await expect(authorizeRelease(fixture)).rejects.toThrow('GITHUB_OUTPUT');
    expect(fixture.ops.associatedPullRequests).not.toHaveBeenCalled();
  });

  it('allows the pure authorization recheck without an output file', async () => {
    const fixture = releaseFixture();
    delete fixture.ops.env.GITHUB_OUTPUT;
    expect(await findMergedReleasePullRequest(fixture)).toMatchObject({
      number: 2251,
      merged: true,
    });
    expect(fixture.context.files.has('/actions/output')).toBe(false);
  });

  it('accepts only the exact SHA argument', () => {
    expect(
      parseAuthorizationArguments(['--expected-sha', expectedSha])
    ).toEqual({ expectedSha });
  });

  it.each(
    [
      [],
      ['--expected-sha'],
      ['--expected-sha', 'HEAD'],
      ['--expected-sha', expectedSha.slice(0, 8)],
      ['--expected-sha', `${expectedSha}\n`],
      ['--expected-sha', expectedSha, '--execute'],
      ['--expected-sha', expectedSha, '--expected-sha', expectedSha],
    ].map((args) => [args])
  )('rejects malformed authorization arguments %j', (args) => {
    expect(() => parseAuthorizationArguments(args)).toThrow();
  });
});

describe('publisher independently verifies merged PR authorization', () => {
  it('allows ordinary-push validation without any GitHub PR lookup', async () => {
    const fixture = releaseFixture();
    fixture.context.associatedPullRequests = [];
    delete fixture.ops.env.GH_TOKEN;
    const report = await publishRelease(fixture);
    expect(report.execute).toBe(false);
    expect(report.published).toEqual([]);
    expect(fixture.ops.associatedPullRequests).not.toHaveBeenCalled();
  });

  it.each([
    'direct push',
    'incorrect PR',
    'unmerged full response',
    'GitHub failure',
  ])(
    'rejects %s before creating artifacts or invoking pack/npm',
    async (mode) => {
      const fixture = releaseFixture();
      if (mode === 'direct push') fixture.context.associatedPullRequests = [];
      if (mode === 'incorrect PR')
        fixture.context.associatedPullRequests[0].title = 'a feature PR';
      if (mode === 'unmerged full response')
        fixture.context.pullRequest.merged = false;
      if (mode === 'GitHub failure')
        fixture.context.onAssociatedPullRequests = () => {
          throw new Error('GitHub unavailable');
        };
      await expect(
        publishRelease({ ...fixture, execute: true })
      ).rejects.toThrow();
      expect(fixture.context.temporaryDirectories).toBe(0);
      expect(
        fixture.ops.run.mock.calls.every(([command]) => command === 'git')
      ).toBe(true);
      expect(fixture.ops.registry).not.toHaveBeenCalled();
      expect(fixture.context.files.has('/actions/output')).toBe(false);
    }
  );

  it('does not trust an earlier authorize command when current PR details no longer match', async () => {
    const fixture = releaseFixture();
    expect(await authorizeRelease(fixture)).toBe(true);
    fixture.context.pullRequest.title = 'renamed release';
    await expect(publishRelease({ ...fixture, execute: true })).rejects.toThrow(
      'matching merged Changesets'
    );
    expect(fixture.ops.associatedPullRequests).toHaveBeenCalledTimes(2);
    expect(fixture.ops.pullRequest).toHaveBeenCalledTimes(2);
    expect(fixture.context.temporaryDirectories).toBe(0);
  });
});
