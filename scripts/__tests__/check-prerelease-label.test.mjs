import { describe, expect, test, vi } from 'vitest';
import {
  decidePrereleaseLabel,
  findPrereleaseBranch,
  MAX_BASE_HOPS,
  preModeLabel,
  run,
} from '../check-prerelease-label.mjs';

const preJson = (mode, tag = 'samsara') => JSON.stringify({ mode, tag });

function fakeRepo(preJsonByRef, headToBase) {
  return {
    readPreJson: vi.fn(async (branch) => preJsonByRef[branch] ?? null),
    findParentBase: vi.fn(async (branch) => headToBase[branch] ?? null),
  };
}

describe('findPrereleaseBranch', () => {
  test.each([
    {
      name: 'stops at a prerelease base without looking for its open promotion pull request',
      baseRef: 'samsara',
      preJsonByRef: { samsara: preJson('pre') },
      headToBase: { samsara: 'main' },
      expected: { chain: ['samsara'], label: 'samsara', stoppedEarly: false },
      parentLookups: 0,
    },
    {
      name: 'stops at an integration branch that inherited pre.json',
      baseRef: 'e/compiler/precompute-base',
      preJsonByRef: { 'e/compiler/precompute-base': preJson('pre') },
      headToBase: {},
      expected: {
        chain: ['e/compiler/precompute-base'],
        label: 'samsara',
        stoppedEarly: false,
      },
      parentLookups: 0,
    },
    {
      name: 'follows open pull requests until a branch is in pre mode',
      baseRef: 'e/b',
      preJsonByRef: { samsara: preJson('pre') },
      headToBase: { 'e/b': 'e/a', 'e/a': 'samsara', samsara: 'main' },
      expected: {
        chain: ['e/b', 'e/a', 'samsara'],
        label: 'samsara',
        stoppedEarly: false,
      },
      parentLookups: 2,
    },
    {
      name: 'finds no prerelease branch on main',
      baseRef: 'main',
      preJsonByRef: {},
      headToBase: {},
      expected: { chain: ['main'], label: null, stoppedEarly: false },
      parentLookups: 1,
    },
    {
      name: 'stops on a cycle',
      baseRef: 'a',
      preJsonByRef: {},
      headToBase: { a: 'b', b: 'a' },
      expected: { chain: ['a', 'b'], label: null, stoppedEarly: true },
      parentLookups: 2,
    },
  ])(
    '$name',
    async ({ baseRef, preJsonByRef, headToBase, expected, parentLookups }) => {
      const repo = fakeRepo(preJsonByRef, headToBase);
      await expect(findPrereleaseBranch(baseRef, repo)).resolves.toEqual(
        expected
      );
      expect(repo.readPreJson).toHaveBeenCalledTimes(expected.chain.length);
      expect(repo.findParentBase).toHaveBeenCalledTimes(parentLookups);
    }
  );

  test('stops after the hop limit', async () => {
    const headToBase = {};
    for (let i = 0; i < MAX_BASE_HOPS + 5; i++)
      headToBase[`b${i}`] = `b${i + 1}`;
    const repo = fakeRepo({}, headToBase);
    const { chain, label, stoppedEarly } = await findPrereleaseBranch(
      'b0',
      repo
    );
    expect({ length: chain.length, label, stoppedEarly }).toEqual({
      length: MAX_BASE_HOPS + 1,
      label: null,
      stoppedEarly: true,
    });
    expect(repo.readPreJson).toHaveBeenCalledTimes(MAX_BASE_HOPS + 1);
    expect(repo.findParentBase).toHaveBeenCalledTimes(MAX_BASE_HOPS);
  });
});

describe('preModeLabel', () => {
  test.each([
    [preJson('pre'), 'samsara'],
    [preJson('exit'), 'samsara'],
    [preJson('pre', 'beta'), 'beta'],
    [JSON.stringify({ mode: 'pre' }), 'e/next'],
    [preJson('pre', ''), 'e/next'],
    [preJson('other'), null],
    ['null', null],
    ['not json', null],
    [null, null],
  ])('%s -> %s', (text, expected) => {
    expect(preModeLabel(text, 'e/next')).toBe(expected);
  });
});

describe('decidePrereleaseLabel', () => {
  test.each([
    {
      chain: ['main'],
      label: null,
      labels: [],
      expected: {
        ok: true,
        requiredLabel: null,
        message:
          'This pull request does not land on a prerelease branch (main), so no label is required.',
      },
    },
    {
      chain: ['e/a', 'samsara'],
      label: 'samsara',
      labels: ['bug', 'samsara'],
      expected: {
        ok: true,
        requiredLabel: 'samsara',
        message:
          'This pull request lands on samsara (e/a -> samsara), which is in samsara pre mode, and has the samsara label.',
      },
    },
    {
      chain: ['e/a', 'samsara'],
      label: 'samsara',
      labels: ['bug'],
      expected: {
        ok: false,
        requiredLabel: 'samsara',
        message:
          'This pull request lands on samsara (e/a -> samsara), which is in samsara pre mode, but is missing the samsara label.',
      },
    },
  ])('$labels on $chain', ({ chain, label, labels, expected }) => {
    expect(decidePrereleaseLabel({ chain, label, labels })).toEqual(expected);
  });
});

describe('run', () => {
  function githubFetch({ pull, openPulls, preJsonByRef }) {
    return vi.fn(async (url) => {
      const { pathname, searchParams } = new URL(url);
      const route = pathname.replace('/repos/org/repo', '');
      let body = null;
      if (route === `/pulls/${pull.number}`) body = pull;
      else if (route === '/pulls') {
        const head = searchParams.get('head').replace('org:', '');
        body = openPulls.filter((p) => p.head.ref === head);
      } else if (route === '/contents/.changeset/pre.json') {
        body = preJsonByRef[searchParams.get('ref')] ?? null;
      }
      if (body === null) return new Response('Not Found', { status: 404 });
      return new Response(
        typeof body === 'string' ? body : JSON.stringify(body)
      );
    });
  }

  const promotionPull = { head: { ref: 'samsara' }, base: { ref: 'main' } };
  const missingLabel = (label, detail) =>
    `::error title=Missing ${label} label::This pull request lands on ${detail}, but is missing the ${label} label. Maintainers can add it with: gh pr edit 3 --add-label ${label}. Without triage access, ask a maintainer in this pull request to add it.`;

  test.each([
    {
      name: 'fails a direct samsara pull request while a samsara -> main pull request is open',
      base: 'samsara',
      labels: [],
      openPulls: [promotionPull],
      preJsonByRef: { samsara: preJson('pre') },
      code: 1,
      error: missingLabel(
        'samsara',
        'samsara (samsara), which is in samsara pre mode'
      ),
    },
    {
      name: 'fails a stack through an integration branch that inherited pre.json',
      base: 'e/compiler/precompute-base',
      labels: [],
      openPulls: [],
      preJsonByRef: {
        samsara: preJson('pre'),
        'e/compiler/precompute-base': preJson('pre'),
      },
      code: 1,
      error: missingLabel(
        'samsara',
        'e/compiler/precompute-base (e/compiler/precompute-base), which is in samsara pre mode'
      ),
    },
    {
      name: 'passes a stack through an integration branch with the samsara label',
      base: 'e/compiler/precompute-base',
      labels: [{ name: 'samsara' }],
      openPulls: [],
      preJsonByRef: { 'e/compiler/precompute-base': preJson('pre') },
      code: 0,
      error: null,
    },
    {
      name: 'fails a stack of open pull requests that lands on samsara',
      base: 'e/a',
      labels: [],
      openPulls: [{ head: { ref: 'e/a' }, base: { ref: 'samsara' } }],
      preJsonByRef: { samsara: preJson('pre') },
      code: 1,
      error: missingLabel(
        'samsara',
        'samsara (e/a -> samsara), which is in samsara pre mode'
      ),
    },
    {
      name: 'requires the branch name when pre.json has no tag',
      base: 'e/next',
      labels: [{ name: 'samsara' }],
      openPulls: [],
      preJsonByRef: { 'e/next': JSON.stringify({ mode: 'pre' }) },
      code: 1,
      error: missingLabel(
        'e/next',
        'e/next (e/next), which is in e/next pre mode'
      ),
    },
    {
      name: 'passes a main pull request with no label',
      base: 'main',
      labels: [],
      openPulls: [promotionPull],
      preJsonByRef: { samsara: preJson('pre') },
      code: 0,
      error: null,
    },
  ])(
    '$name',
    async ({ base, labels, openPulls, preJsonByRef, code, error }) => {
      const logError = vi.fn();
      await expect(
        run({
          token: 't',
          repository: 'org/repo',
          pullNumber: 3,
          fetchImpl: githubFetch({
            pull: { number: 3, base: { ref: base }, labels },
            openPulls,
            preJsonByRef,
          }),
          log: vi.fn(),
          logError,
        })
      ).resolves.toBe(code);
      expect(logError.mock.calls).toEqual(error === null ? [] : [[error]]);
    }
  );
});
