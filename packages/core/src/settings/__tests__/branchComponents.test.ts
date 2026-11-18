import { describe, expect, it } from 'vitest';
import {
  branchComponentTransformations,
  isBranchComponentName,
  isPluralComponentName,
} from '../branchComponents';

describe('branch components', () => {
  it.each([
    ['Branch', true, false, 'b'],
    ['Plural', true, true, 'p'],
    ['Ordinal', true, true, 'o'],
  ] as const)('%s is stored as %s', (name, branch, plural, stored) => {
    expect(isBranchComponentName(name)).toBe(branch);
    expect(isPluralComponentName(name)).toBe(plural);
    expect(branchComponentTransformations[name]).toBe(stored);
  });

  // A name Object.prototype also has is no component.
  it.each(['Num', 'constructor', 'toString', '', null, undefined])(
    '%s is no branch component',
    (name) => {
      expect(isBranchComponentName(name)).toBe(false);
      expect(isPluralComponentName(name)).toBe(false);
    }
  );
});
