import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { getTag } from '../getTag';

describe('getTag', () => {
  describe('JSXElement handling', () => {
    it('should return tag name for simple JSX identifier', () => {
      const element = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('div'), []),
        t.jsxClosingElement(t.jsxIdentifier('div')),
        []
      );

      expect(getTag(element)).toBe('div');
    });

    it('should return tag name for component with uppercase', () => {
      const element = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('MyComponent'), []),
        t.jsxClosingElement(t.jsxIdentifier('MyComponent')),
        []
      );

      expect(getTag(element)).toBe('MyComponent');
    });

    it('should handle JSX member expression (single level)', () => {
      const memberExpression = t.jsxMemberExpression(
        t.jsxIdentifier('React'),
        t.jsxIdentifier('Fragment')
      );

      const element = t.jsxElement(
        t.jsxOpeningElement(memberExpression, []),
        t.jsxClosingElement(memberExpression),
        []
      );

      expect(getTag(element)).toBe('React.Fragment');
    });

    it('should handle nested JSX member expression', () => {
      const nestedMemberExpression = t.jsxMemberExpression(
        t.jsxMemberExpression(
          t.jsxIdentifier('MyLibrary'),
          t.jsxIdentifier('Components')
        ),
        t.jsxIdentifier('Button')
      );

      const element = t.jsxElement(
        t.jsxOpeningElement(nestedMemberExpression, []),
        t.jsxClosingElement(nestedMemberExpression),
        []
      );

      expect(getTag(element)).toBe('MyLibrary.Components.Button');
    });

    it('should handle deeply nested JSX member expression', () => {
      const deeplyNestedExpression = t.jsxMemberExpression(
        t.jsxMemberExpression(
          t.jsxMemberExpression(t.jsxIdentifier('A'), t.jsxIdentifier('B')),
          t.jsxIdentifier('C')
        ),
        t.jsxIdentifier('D')
      );

      const element = t.jsxElement(
        t.jsxOpeningElement(deeplyNestedExpression, []),
        t.jsxClosingElement(deeplyNestedExpression),
        []
      );

      expect(getTag(element)).toBe('A.B.C.D');
    });

    it('should throw error for JSXNamespacedName', () => {
      const namespacedName = t.jsxNamespacedName(
        t.jsxIdentifier('svg'),
        t.jsxIdentifier('rect')
      );

      const element = t.jsxElement(
        t.jsxOpeningElement(namespacedName, []),
        t.jsxClosingElement(namespacedName),
        []
      );

      expect(() => getTag(element)).toThrow(
        'JSXNamespacedName is not supported'
      );
    });
  });

  describe('JSXFragment handling', () => {
    it('should return "fragment" for JSXFragment', () => {
      const fragment = t.jsxFragment(
        t.jsxOpeningFragment(),
        t.jsxClosingFragment(),
        []
      );

      expect(getTag(fragment)).toBe('fragment');
    });
  });

  describe('edge cases', () => {
    it('should handle self-closing JSX elements', () => {
      const element = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('input'), [], true),
        null,
        []
      );

      expect(getTag(element)).toBe('input');
    });

    it('should handle JSX elements with attributes', () => {
      const element = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('div'), [
          t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral('test')),
        ]),
        t.jsxClosingElement(t.jsxIdentifier('div')),
        []
      );

      expect(getTag(element)).toBe('div');
    });

    it('should handle JSX elements with children', () => {
      const element = t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('div'), []),
        t.jsxClosingElement(t.jsxIdentifier('div')),
        [t.jsxText('Hello World')]
      );

      expect(getTag(element)).toBe('div');
    });
  });
});
