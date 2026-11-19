import { describe, it, expect } from 'vitest';
import {
  isGTComponent,
  isVariableComponent,
  isDeriveComponent,
} from '../helpers';
import { GT_COMPONENT_TYPES, MINIFY_CANONICAL_NAME_MAP } from '../constants';

const VARIABLE_COMPONENTS = [
  'Var',
  'Num',
  'Currency',
  'DateTime',
  'RelativeTime',
];

describe('GT component helpers', () => {
  it('isGTComponent recognizes variable, derive, translation and branch components', () => {
    for (const name of [
      ...VARIABLE_COMPONENTS,
      'Derive',
      'T',
      'Tx',
      'Branch',
      'Plural',
    ]) {
      expect(isGTComponent(name), name).toBe(true);
    }
    for (const name of ['Foo', 'div']) {
      expect(isGTComponent(name), name).toBe(false);
    }
  });

  it('isVariableComponent recognizes only variable components', () => {
    for (const name of VARIABLE_COMPONENTS) {
      expect(isVariableComponent(name), name).toBe(true);
    }
    for (const name of ['T', 'Branch', 'Plural']) {
      expect(isVariableComponent(name), name).toBe(false);
    }
  });

  it('isDeriveComponent recognizes only Derive', () => {
    expect(isDeriveComponent('Derive')).toBe(true);
    expect(isDeriveComponent('Var')).toBe(false);
    expect(isDeriveComponent('RelativeTime')).toBe(false);
  });

  // Minified names are part of the hashed wire format shared with the CLI
  // and the runtime.
  it.each([
    [GT_COMPONENT_TYPES.Var, 'v'],
    [GT_COMPONENT_TYPES.Num, 'n'],
    [GT_COMPONENT_TYPES.Currency, 'c'],
    [GT_COMPONENT_TYPES.DateTime, 'd'],
    [GT_COMPONENT_TYPES.RelativeTime, 'rt'],
  ] as const)('%s minifies to %s', (component, minified) => {
    expect(MINIFY_CANONICAL_NAME_MAP[component]).toBe(minified);
  });
});
