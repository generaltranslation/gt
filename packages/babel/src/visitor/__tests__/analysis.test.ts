import { describe, it, expect } from 'vitest';
import {
  isTranslationComponent,
  isVariableComponent,
  isBranchComponent,
  isTranslationFunction,
  isTranslationFunctionCallback,
} from '../analysis';

describe('analysis', () => {
  describe('isTranslationComponent', () => {
    it('recognizes T component', () => {
      expect(isTranslationComponent('T')).toBe(true);
    });

    it('rejects non-translation components', () => {
      const components = ['Div', 'Span', 'T2', 't', 'Translation', 'Var', 'Branch'];
      for (const component of components) {
        expect(isTranslationComponent(component)).toBe(false);
      }
    });

    it('handles empty string', () => {
      expect(isTranslationComponent('')).toBe(false);
    });
  });

  describe('isVariableComponent', () => {
    it('recognizes all variable components', () => {
      const validComponents = ['Var', 'Num', 'Currency', 'DateTime'];
      for (const component of validComponents) {
        expect(isVariableComponent(component)).toBe(true);
      }
    });

    it('rejects non-variable components', () => {
      const components = ['T', 'Branch', 'Plural', 'div', 'var', 'num', 'Variable'];
      for (const component of components) {
        expect(isVariableComponent(component)).toBe(false);
      }
    });

    it('handles empty string', () => {
      expect(isVariableComponent('')).toBe(false);
    });
  });

  describe('isBranchComponent', () => {
    it('recognizes branch components', () => {
      const branchComponents = ['Branch', 'Plural'];
      for (const component of branchComponents) {
        expect(isBranchComponent(component)).toBe(true);
      }
    });

    it('rejects non-branch components', () => {
      const components = [
        'T',
        'Var', 
        'div',
        'branch',
        'plural',
        'Branches',
        'PluralForm',
      ];
      for (const component of components) {
        expect(isBranchComponent(component)).toBe(false);
      }
    });

    it('handles empty string', () => {
      expect(isBranchComponent('')).toBe(false);
    });
  });

  describe('isTranslationFunction', () => {
    it('recognizes translation functions', () => {
      const functions = ['useGT', 'getGT'];
      for (const func of functions) {
        expect(isTranslationFunction(func)).toBe(true);
      }
    });

    it('rejects non-translation functions', () => {
      const functions = [
        'useT',
        'getT',
        'useTranslation',
        't',
        'translate',
        'USEGT',
        'usegt',
      ];
      for (const func of functions) {
        expect(isTranslationFunction(func)).toBe(false);
      }
    });

    it('handles empty string', () => {
      expect(isTranslationFunction('')).toBe(false);
    });
  });

  describe('comprehensive validation', () => {
    it('no overlap between categories', () => {
      const allNames = [
        'T', 'Var', 'Num', 'Currency', 'DateTime', 'Branch', 'Plural', 'useGT', 'getGT',
      ];

      for (const name of allNames) {
        const isTranslation = isTranslationComponent(name);
        const isVariable = isVariableComponent(name);
        const isBranch = isBranchComponent(name);
        const isFunction = isTranslationFunction(name);

        // Each name should only match one category
        const matches = [isTranslation, isVariable, isBranch, isFunction];
        const matchCount = matches.filter(x => x).length;

        expect(matchCount).toBe(1);
      }
    });
  });
});