import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hashSource } from 'generaltranslation/id';
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

  it.each([
    'tests/seeds/t-component/simple/plain-text/plain-text',
    'tests/seeds/t-component/simple/misc/customcomponents',
    'tests/seeds/variable-components/currency/simple/variable',
    'tests/seeds/branching-components/branch/simple/basic',
  ])('matches the existing React runtime oracle for %s', async (seedDir) => {
    const expected = JSON.parse(
      await readFile(resolve(repositoryRoot, seedDir, 'expected.json'), 'utf8')
    );
    const candidate = await captureRuntimeSeeds({
      cwd: repositoryRoot,
      file: resolve(repositoryRoot, seedDir, 'page.tsx'),
    });

    expect(candidate.seeds).toHaveLength(1);
    expect(normalizeSemanticWire(candidate.seeds[0].jsxChildren)).toEqual(
      normalizeSemanticWire(expected)
    );
    expect(candidate.seeds[0].hash).toBe(
      hashSource({ source: expected, dataFormat: 'JSX' })
    );
  });
});

function normalizeSemanticWire(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSemanticWire);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 't' || !('i' in value) || 'k' in value)
      .map(([key, child]) => [key, normalizeSemanticWire(child)])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
