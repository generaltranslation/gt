import { describe, expect, test, vi } from 'vitest';
import {
  decidePrereleaseLabel,
  isPrereleasePreJson,
  MAX_BASE_HOPS,
  resolveBaseChain,
  run,
} from '../check-prerelease-label.mjs';

const preJson = (mode) => JSON.stringify({ mode, tag: 'samsara' });

function parentLookup(headToBase) {
  return async (branch) => headToBase[branch] ?? null;
}

describe('resolveBaseChain', () => {
  test('stops at a base that is not another pull request head', async () => {
    await expect(
      resolveBaseChain('samsara', parentLookup({}))
    ).resolves.toEqual({ chain: ['samsara'], stoppedEarly: false });
  });

  test('follows a stack down to the branch it lands on', async () => {
    const lookup = parentLookup({ 'e/b': 'e/a', 'e/a': 'samsara' });
    await expect(resolveBaseChain('e/b', lookup)).resolves.toEqual({
      chain: ['e/b', 'e/a', 'samsara'],
      stoppedEarly: false,
    });
  });

  test('stops after the hop limit', async () => {
    const headToBase = {};
    for (let i = 0; i < MAX_BASE_HOPS + 5; i++)
      headToBase[`b${i}`] = `b${i + 1}`;
    const { chain, stoppedEarly } = await resolveBaseChain(
      'b0',
      parentLookup(headToBase)
    );
    expect(stoppedEarly).toBe(true);
    expect(chain).toHaveLength(MAX_BASE_HOPS + 1);
  });

  test('stops on a cycle', async () => {
    const lookup = parentLookup({ a: 'b', b: 'a' });
    await expect(resolveBaseChain('a', lookup)).resolves.toEqual({
      chain: ['a', 'b'],
      stoppedEarly: true,
    });
  });
});

describe('isPrereleasePreJson', () => {
  test.each([
    [preJson('pre'), true],
    [preJson('exit'), true],
    [preJson('other'), false],
    ['not json', false],
    [null, false],
  ])('%s -> %s', (text, expected) => {
    expect(isPrereleasePreJson(text)).toBe(expected);
  });
});

describe('decidePrereleaseLabel', () => {
  test('requires nothing off a prerelease branch', () => {
    expect(
      decidePrereleaseLabel({
        chain: ['main'],
        isPrerelease: false,
        labels: [],
      })
    ).toMatchObject({ ok: true, requiredLabel: null });
  });

  test('passes a prerelease pull request that has the branch label', () => {
    expect(
      decidePrereleaseLabel({
        chain: ['e/a', 'samsara'],
        isPrerelease: true,
        labels: ['bug', 'samsara'],
      })
    ).toMatchObject({ ok: true, requiredLabel: 'samsara' });
  });

  test('fails a prerelease pull request without the branch label', () => {
    const decision = decidePrereleaseLabel({
      chain: ['e/a', 'samsara'],
      isPrerelease: true,
      labels: ['bug'],
    });
    expect(decision).toMatchObject({ ok: false, requiredLabel: 'samsara' });
    expect(decision.message).toContain('e/a -> samsara');
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

  const stackedPull = {
    number: 3,
    base: { ref: 'e/a' },
    labels: [],
  };
  const openPulls = [{ head: { ref: 'e/a' }, base: { ref: 'samsara' } }];

  test('fails a stacked pull request that lands on samsara without the label', async () => {
    const logError = vi.fn();
    const code = await run({
      token: 't',
      repository: 'org/repo',
      pullNumber: 3,
      fetchImpl: githubFetch({
        pull: stackedPull,
        openPulls,
        preJsonByRef: { samsara: preJson('pre') },
      }),
      log: vi.fn(),
      logError,
    });
    expect(code).toBe(1);
    expect(logError.mock.calls[0][0]).toContain(
      'gh pr edit 3 --add-label samsara'
    );
  });

  test('passes once the label is added', async () => {
    const code = await run({
      token: 't',
      repository: 'org/repo',
      pullNumber: 3,
      fetchImpl: githubFetch({
        pull: { ...stackedPull, labels: [{ name: 'samsara' }] },
        openPulls,
        preJsonByRef: { samsara: preJson('pre') },
      }),
      log: vi.fn(),
      logError: vi.fn(),
    });
    expect(code).toBe(0);
  });

  test('passes a pull request that lands on a branch without pre.json', async () => {
    const code = await run({
      token: 't',
      repository: 'org/repo',
      pullNumber: 3,
      fetchImpl: githubFetch({
        pull: { ...stackedPull, base: { ref: 'main' } },
        openPulls,
        preJsonByRef: {},
      }),
      log: vi.fn(),
      logError: vi.fn(),
    });
    expect(code).toBe(0);
  });
});
