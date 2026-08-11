import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { captureRuntimeSeeds } from '../capture';
import type { RuntimeSeed } from '../types';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');

describe('captureRuntimeSeeds', () => {
  it('captures inline JSX through the real T runtime', async () => {
    const candidate = await captureRuntimeSeeds({
      cwd: repositoryRoot,
      code: '<T $context="greeting">Hello <Var name="person">Ada</Var></T>',
    });

    expect(candidate.input).toBe('<inline>');
    expect(candidate.seeds).toHaveLength(1);
    expect(candidate.seeds[0]).toMatchObject({
      source: { file: '<inline>', line: 1, column: 1 },
      hash: expect.stringMatching(/^[a-f0-9]{16}$/),
      metadata: { context: 'greeting' },
      jsxChildren: ['Hello ', { i: 1, k: 'person', v: 'v' }],
    });
  });

  it('captures multiple T components from one file in source order', async () => {
    const candidate = await captureRuntimeSeeds({
      cwd: repositoryRoot,
      code: '<><T>First</T><T>Second <Var name="value">value</Var></T></>',
    });

    expect(candidate.seeds).toHaveLength(2);
    expect(
      candidate.seeds.map(({ source, hash, jsxChildren }) => ({
        source,
        hash,
        jsxChildren,
      }))
    ).toEqual([
      {
        source: { file: '<inline>', line: 1, column: 3 },
        hash: expect.stringMatching(/^[a-f0-9]{16}$/),
        jsxChildren: 'First',
      },
      {
        source: { file: '<inline>', line: 1, column: 15 },
        hash: expect.stringMatching(/^[a-f0-9]{16}$/),
        jsxChildren: ['Second ', { i: 1, k: 'value', v: 'v' }],
      },
    ]);
  });

  it('keeps async sibling captures in deterministic source order', async () => {
    const candidate = await captureRuntimeSeeds({
      cwd: repositoryRoot,
      file: resolve(import.meta.dirname, 'fixtures/asyncSibling.jsx'),
    });

    expect(candidate.seeds.map((seed) => seed.jsxChildren)).toEqual([
      'Slow',
      'Fast',
    ]);
  });

  it('exits after capture when rendered code leaves an active handle', async () => {
    const candidate = await captureRuntimeSeeds({
      cwd: repositoryRoot,
      code: `<T>{(() => {
        setInterval(() => undefined, 1_000);
        return 'Timer';
      })()}</T>`,
    });

    expect(candidate.seeds[0].jsxChildren).toBe('Timer');
  });

  it('terminates descendant processes after capture', async () => {
    const marker = resolve(
      tmpdir(),
      `gt-react-runtime-seed-descendant-${randomUUID()}`
    );
    const descendant = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'survived'), 300)`;

    try {
      const candidate = await captureRuntimeSeeds({
        cwd: repositoryRoot,
        code: `<T>{(() => {
          process.getBuiltinModule('node:child_process').spawn(
            process.execPath,
            ['-e', ${JSON.stringify(descendant)}],
            { detached: true, stdio: 'ignore' }
          );
          return 'Child process';
        })()}</T>`,
      });
      expect(candidate.seeds[0].jsxChildren).toBe('Child process');
      await delay(500);
      expect(existsSync(marker)).toBe(false);
    } finally {
      await rm(marker, { force: true });
    }
  });

  it('preserves the exact message used to calculate formatter hashes', async () => {
    const candidate = await captureRuntimeSeeds({
      cwd: repositoryRoot,
      code: '<T>Due <RelativeTime name="offset" value={3} unit="day" />.</T>',
    });

    expect(candidate.seeds[0].jsxChildren).toEqual([
      'Due ',
      { i: 1, k: 'offset', v: 'rt' },
      '.',
    ]);
    expectSeedHash(candidate.seeds[0]);
  });

  it('rejects an empty file path through the programmatic API', async () => {
    await expect(captureRuntimeSeeds({ file: '  ' })).rejects.toThrow(
      'The React seed file path is empty'
    );
  });

  it('supports seed modules that use top-level await', async () => {
    const candidate = await captureRuntimeSeeds({
      cwd: repositoryRoot,
      file: resolve(import.meta.dirname, 'fixtures/topLevelAwait.jsx'),
    });

    expect(candidate.seeds).toHaveLength(1);
    expect(candidate.seeds[0].jsxChildren).toBe('Top-level await');
  });

  it('captures multiple seeds from an async server component', async () => {
    const expected = JSON.parse(
      await readFile(
        resolve(import.meta.dirname, 'fixtures/productionProof.candidate.json'),
        'utf8'
      )
    );
    const candidate = await captureRuntimeSeeds({
      cwd: repositoryRoot,
      file: resolve(import.meta.dirname, 'fixtures/productionProof.jsx'),
    });

    expect(candidate).toEqual(expected);
    candidate.seeds.forEach(expectSeedHash);
  });

  it('reports render failures from the async static renderer', async () => {
    await expect(
      captureRuntimeSeeds({
        cwd: repositoryRoot,
        code: `<T>{(() => {
          throw new Error('proof render failure');
        })()}</T>`,
      })
    ).rejects.toThrow('proof render failure');
  });
});

function expectSeedHash(seed: RuntimeSeed): void {
  const context = seed.metadata?.context;
  const maxChars = seed.metadata?.maxChars;
  const requiresReview = seed.metadata?.requiresReview;
  expect(seed.hash).toBe(
    hashSource({
      source: seed.jsxChildren,
      dataFormat: 'JSX',
      ...(context && { context }),
      ...(maxChars != null && { maxChars: Math.abs(maxChars) }),
      ...(requiresReview === true && { requiresReview: true }),
    })
  );
}
