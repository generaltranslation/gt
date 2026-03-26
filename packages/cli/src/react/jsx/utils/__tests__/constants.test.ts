import { describe, it, expect } from 'vitest';
import {
  GT_TRANSLATION_FUNCS,
  VARIABLE_COMPONENTS,
} from '../constants';

describe('GT_TRANSLATION_FUNCS', () => {
  it('should include RelativeTime', () => {
    expect(GT_TRANSLATION_FUNCS).toContain('RelativeTime');
  });

  it('should include all variable components', () => {
    const variableComponents = [
      'Var',
      'DateTime',
      'RelativeTime',
      'Currency',
      'Num',
    ];
    for (const component of variableComponents) {
      expect(GT_TRANSLATION_FUNCS).toContain(component);
    }
  });
});

describe('VARIABLE_COMPONENTS', () => {
  it('should include RelativeTime', () => {
    expect(VARIABLE_COMPONENTS).toContain('RelativeTime');
  });

  it('should include all expected variable components', () => {
    const expected = [
      'Var',
      'DateTime',
      'RelativeTime',
      'Currency',
      'Num',
      'Static',
      'Derive',
    ];
    for (const component of expected) {
      expect(VARIABLE_COMPONENTS).toContain(component);
    }
  });
});
