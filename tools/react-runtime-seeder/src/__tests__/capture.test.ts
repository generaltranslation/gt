import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { captureRuntimeSeeds } from '../capture';

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

  it('captures multiple T components from one file in render order', async () => {
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
