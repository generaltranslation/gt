import { describe, expect, it } from 'vitest';
import { getDefaultOutputName } from '../output';
import type { RuntimeSeedCandidate } from '../types';

describe('getDefaultOutputName', () => {
  it('distinguishes complete candidates while keeping exact reruns stable', () => {
    const candidate = createCandidate('first/page.tsx', ['same first seed']);
    const sameBasename = createCandidate('second/page.tsx', [
      'same first seed',
    ]);
    const changedLaterSeed = createCandidate('first/page.tsx', [
      'same first seed',
      'new second seed',
    ]);

    expect(getDefaultOutputName(candidate)).toBe(
      getDefaultOutputName(structuredClone(candidate))
    );
    expect(getDefaultOutputName(candidate)).not.toBe(
      getDefaultOutputName(sameBasename)
    );
    expect(getDefaultOutputName(candidate)).not.toBe(
      getDefaultOutputName(changedLaterSeed)
    );
  });
});

function createCandidate(
  input: string,
  jsxChildren: string[]
): RuntimeSeedCandidate {
  return {
    schemaVersion: 1,
    input,
    seeds: jsxChildren.map((children, index) => ({
      source: { file: input, line: index + 1, column: 1 },
      hash: 'same-runtime-hash',
      jsxChildren: children,
    })),
  };
}
