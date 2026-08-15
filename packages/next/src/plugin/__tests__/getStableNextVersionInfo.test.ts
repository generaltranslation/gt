import { describe, expect, it } from 'vitest';
import { getRootParamStability } from '../getStableNextVersionInfo';

describe('getRootParamStability', () => {
  it.each([
    ['14.2.0', 'unsupported'],
    ['15.2.0', 'unstable'],
    ['15.4.9', 'unstable'],
    ['15.5.0', 'experimental'],
    ['16.2.9', 'experimental'],
    ['16.3.0', 'stable'],
    ['17.0.0', 'stable'],
  ] as const)('classifies Next.js %s as %s', (nextVersion, expected) => {
    expect(getRootParamStability(nextVersion)).toBe(expected);
  });
});
