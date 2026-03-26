import { describe, it, expect } from 'vitest';
import {
  isGTComponent,
  isVariableComponent,
  isDeriveComponent,
  defaultVariableNames,
  getVariableName,
} from '../helpers';
import { GT_COMPONENT_TYPES, MINIFY_CANONICAL_NAME_MAP } from '../constants';

describe('isGTComponent', () => {
  it('should recognize all variable components', () => {
    const variableComponents = [
      'Var',
      'Num',
      'Currency',
      'DateTime',
      'RelativeTime',
      'Static',
      'Derive',
    ];
    for (const name of variableComponents) {
      expect(isGTComponent(name)).toBe(true);
    }
  });

  it('should recognize translation and branch components', () => {
    expect(isGTComponent('T')).toBe(true);
    expect(isGTComponent('Tx')).toBe(true);
    expect(isGTComponent('Branch')).toBe(true);
    expect(isGTComponent('Plural')).toBe(true);
  });

  it('should reject unknown components', () => {
    expect(isGTComponent('Foo')).toBe(false);
    expect(isGTComponent('div')).toBe(false);
  });
});

describe('isVariableComponent', () => {
  it('should recognize all variable components including RelativeTime', () => {
    const expected = [
      'Var',
      'Num',
      'Currency',
      'DateTime',
      'RelativeTime',
      'Static',
      'Derive',
    ];
    for (const name of expected) {
      expect(isVariableComponent(name)).toBe(true);
    }
  });

  it('should reject non-variable components', () => {
    expect(isVariableComponent('T')).toBe(false);
    expect(isVariableComponent('Branch')).toBe(false);
    expect(isVariableComponent('Plural')).toBe(false);
  });
});

describe('isDeriveComponent', () => {
  it('should recognize Derive and Static', () => {
    expect(isDeriveComponent('Derive')).toBe(true);
    expect(isDeriveComponent('Static')).toBe(true);
  });

  it('should reject non-derive components', () => {
    expect(isDeriveComponent('Var')).toBe(false);
    expect(isDeriveComponent('RelativeTime')).toBe(false);
  });
});

describe('GT_COMPONENT_TYPES enum', () => {
  it('should include RelativeTime', () => {
    expect(GT_COMPONENT_TYPES.RelativeTime).toBe('RelativeTime');
  });
});

describe('MINIFY_CANONICAL_NAME_MAP', () => {
  it('should have a minified name for RelativeTime', () => {
    expect(MINIFY_CANONICAL_NAME_MAP[GT_COMPONENT_TYPES.RelativeTime]).toBe(
      'rt'
    );
  });

  it('should have minified names for all variable components', () => {
    expect(MINIFY_CANONICAL_NAME_MAP[GT_COMPONENT_TYPES.Var]).toBe('v');
    expect(MINIFY_CANONICAL_NAME_MAP[GT_COMPONENT_TYPES.Num]).toBe('n');
    expect(MINIFY_CANONICAL_NAME_MAP[GT_COMPONENT_TYPES.Currency]).toBe('c');
    expect(MINIFY_CANONICAL_NAME_MAP[GT_COMPONENT_TYPES.DateTime]).toBe('d');
    expect(MINIFY_CANONICAL_NAME_MAP[GT_COMPONENT_TYPES.RelativeTime]).toBe(
      'rt'
    );
  });
});

describe('defaultVariableNames', () => {
  it('should have a default name for RelativeTime', () => {
    expect(defaultVariableNames[GT_COMPONENT_TYPES.RelativeTime]).toBe('time');
  });
});

describe('getVariableName', () => {
  it('should return default name for RelativeTime when no name provided', () => {
    const result = getVariableName(GT_COMPONENT_TYPES.RelativeTime);
    expect(result).toContain('time');
  });
});
