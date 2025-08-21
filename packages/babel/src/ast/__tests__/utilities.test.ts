import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import {
  jsNumberToString,
  getTagName,
  getVariableType,
  extractHtmlContentProps,
  filterJsxChildren,
  buildSanitizedTextContent,
} from '../utilities';
import { VariableType } from '../../hash';

describe('ast/utilities', () => {
  describe('jsNumberToString', () => {
    it('should handle positive zero', () => {
      expect(jsNumberToString(0)).toBe('0');
    });

    it('should handle negative zero', () => {
      expect(jsNumberToString(-0)).toBe('-0');
    });

    it('should handle integers', () => {
      expect(jsNumberToString(42)).toBe('42');
      expect(jsNumberToString(-42)).toBe('-42');
    });

    it('should handle decimals', () => {
      expect(jsNumberToString(3.14)).toBe('3.14');
      expect(jsNumberToString(-3.14)).toBe('-3.14');
    });

    it('should handle very small numbers', () => {
      const result = jsNumberToString(1e-7);
      expect(result).toContain('e-');
    });

    it('should handle very large numbers', () => {
      const result = jsNumberToString(1e22);
      expect(result).toContain('e+');
    });

    it('should handle boundary cases for exponential notation', () => {
      expect(jsNumberToString(1e-6)).toBe('0.000001');
      expect(jsNumberToString(1e-7)).toContain('e-');
      expect(jsNumberToString(1e20)).toBe('100000000000000000000');
      expect(jsNumberToString(1e21)).toContain('e+');
    });

    it('should format exponential notation correctly', () => {
      const smallResult = jsNumberToString(1.23e-8);
      expect(smallResult).toMatch(/e-/);

      const largeResult = jsNumberToString(1.23e25);
      expect(largeResult).toMatch(/e\+/);
    });
  });

  describe('getTagName', () => {
    it('should extract simple identifier', () => {
      const ident = t.jsxIdentifier('div');
      expect(getTagName(ident)).toBe('div');
    });

    it('should extract member expression', () => {
      const memberExpr = t.jsxMemberExpression(
        t.jsxIdentifier('React'),
        t.jsxIdentifier('Fragment')
      );
      expect(getTagName(memberExpr)).toBe('React.Fragment');
    });

    it('should handle complex member expressions', () => {
      const memberExpr = t.jsxMemberExpression(
        t.jsxIdentifier('Material'),
        t.jsxIdentifier('Button')
      );
      expect(getTagName(memberExpr)).toBe('Material.Button');
    });

    it('should return null for unsupported patterns', () => {
      const namespacedName = t.jsxNamespacedName(
        t.jsxIdentifier('xml'),
        t.jsxIdentifier('lang')
      );
      expect(getTagName(namespacedName)).toBeNull();
    });
  });

  describe('getVariableType', () => {
    it('should identify number variable', () => {
      expect(getVariableType('Num')).toBe(VariableType.Number);
    });

    it('should identify currency variable', () => {
      expect(getVariableType('Currency')).toBe(VariableType.Currency);
    });

    it('should identify datetime variable', () => {
      expect(getVariableType('DateTime')).toBe(VariableType.Date);
    });

    it('should default to variable', () => {
      expect(getVariableType('Unknown')).toBe(VariableType.Variable);
      expect(getVariableType('')).toBe(VariableType.Variable);
      expect(getVariableType('SomeCustomComponent')).toBe(
        VariableType.Variable
      );
      expect(getVariableType('Var')).toBe(VariableType.Variable);
    });
  });

  describe('extractHtmlContentProps', () => {
    function createStringAttr(name: string, value: string): t.JSXAttribute {
      return t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value));
    }

    it('should handle empty attributes', () => {
      const attrs: t.JSXAttribute[] = [];
      const props = extractHtmlContentProps(attrs);
      expect(props.pl).toBeUndefined();
      expect(props.ti).toBeUndefined();
      expect(props.alt).toBeUndefined();
      expect(props.arl).toBeUndefined();
      expect(props.arb).toBeUndefined();
      expect(props.ard).toBeUndefined();
    });

    it('should extract placeholder', () => {
      const attrs = [createStringAttr('placeholder', 'Enter text')];
      const props = extractHtmlContentProps(attrs);
      expect(props.pl).toBe('Enter text');
    });

    it('should extract title', () => {
      const attrs = [createStringAttr('title', 'Tooltip text')];
      const props = extractHtmlContentProps(attrs);
      expect(props.ti).toBe('Tooltip text');
    });

    it('should extract alt', () => {
      const attrs = [createStringAttr('alt', 'Image description')];
      const props = extractHtmlContentProps(attrs);
      expect(props.alt).toBe('Image description');
    });

    it('should extract aria attributes', () => {
      const attrs = [
        createStringAttr('aria-label', 'Button label'),
        createStringAttr('aria-labelledby', 'label-id'),
        createStringAttr('aria-describedby', 'desc-id'),
      ];
      const props = extractHtmlContentProps(attrs);
      expect(props.arl).toBe('Button label');
      expect(props.arb).toBe('label-id');
      expect(props.ard).toBe('desc-id');
    });

    it('should ignore unknown attributes', () => {
      const attrs = [createStringAttr('className', 'my-class')];
      const props = extractHtmlContentProps(attrs);
      expect(props.pl).toBeUndefined();
      expect(props.ti).toBeUndefined();
      expect(props.alt).toBeUndefined();
    });

    it('should handle non-string attribute values', () => {
      const attrWithExpr = t.jsxAttribute(
        t.jsxIdentifier('placeholder'),
        t.jsxExpressionContainer(t.identifier('placeholder'))
      );
      const props = extractHtmlContentProps([attrWithExpr]);
      expect(props.pl).toBeUndefined();
    });

    it('should handle spread attributes', () => {
      const spreadAttr = t.jsxSpreadAttribute(t.identifier('props'));
      const stringAttr = createStringAttr('title', 'Test title');
      const props = extractHtmlContentProps([spreadAttr, stringAttr]);
      expect(props.ti).toBe('Test title');
    });
  });

  describe('filterJsxChildren', () => {
    function createJsxText(content: string): t.JSXText {
      return t.jsxText(content);
    }

    function createJsxEmptyExpr(): t.JSXExpressionContainer {
      return t.jsxExpressionContainer(t.jsxEmptyExpression());
    }

    function createJsxElement(): t.JSXElement {
      return t.jsxElement(
        t.jsxOpeningElement(t.jsxIdentifier('div'), []),
        t.jsxClosingElement(t.jsxIdentifier('div')),
        [t.jsxText('content')]
      );
    }

    it('should remove leading and trailing whitespace', () => {
      const children = [
        createJsxText('\n  '),
        createJsxText('content'),
        createJsxText('  \n'),
      ];
      const filtered = filterJsxChildren(children);
      expect(filtered.length).toBe(1);
      expect(t.isJSXText(filtered[0])).toBe(true);
      if (t.isJSXText(filtered[0])) {
        expect(filtered[0].value).toBe('content');
      }
    });

    it('should remove empty expressions', () => {
      const children = [
        createJsxText('before'),
        createJsxEmptyExpr(),
        createJsxText('after'),
      ];
      const filtered = filterJsxChildren(children);
      expect(filtered.length).toBe(2);
      expect(t.isJSXText(filtered[0])).toBe(true);
      expect(t.isJSXText(filtered[1])).toBe(true);
    });

    it('should preserve significant whitespace', () => {
      const children = [
        createJsxText('\u00A0'), // Non-breaking space
      ];
      const filtered = filterJsxChildren(children);
      expect(filtered.length).toBe(1);
    });

    it('should handle empty input', () => {
      const children: t.JSXText[] = [];
      const filtered = filterJsxChildren(children);
      expect(filtered.length).toBe(0);
    });

    it('should preserve JSX elements', () => {
      const children = [
        createJsxText('\n  '),
        createJsxElement(),
        createJsxText('  \n'),
      ];
      const filtered = filterJsxChildren(children);
      expect(filtered.length).toBe(1);
      expect(t.isJSXElement(filtered[0])).toBe(true);
    });

    it('should handle mixed content correctly', () => {
      const children = [
        createJsxText('  '),
        createJsxText('hello'),
        createJsxEmptyExpr(),
        createJsxElement(),
        createJsxText('world'),
        createJsxText('\n  '),
      ];
      const filtered = filterJsxChildren(children);
      expect(filtered.length).toBe(4); // ' ', 'hello', element, 'world'
    });

    it('should handle single child with surrounding whitespace', () => {
      const children = [
        createJsxText('\n  '),
        createJsxText('content'),
        createJsxText('  \n'),
      ];
      const filtered = filterJsxChildren(children);
      expect(filtered.length).toBe(1);
    });

    it('should preserve whitespace without newlines', () => {
      const children = [
        createJsxText('   '), // Spaces without newlines
      ];
      const filtered = filterJsxChildren(children);
      expect(filtered.length).toBe(1);
    });
  });

  describe('buildSanitizedTextContent', () => {
    function createJsxText(content: string): t.JSXText {
      return t.jsxText(content);
    }

    it('should handle simple text', () => {
      const text = createJsxText('hello world');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('hello world');
    });

    it('should handle empty text', () => {
      const text = createJsxText('');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('');
    });

    it('should handle whitespace-only with newlines', () => {
      const text = createJsxText('  \n  ');
      const result = buildSanitizedTextContent(text);
      expect(result).toBeNull();
    });

    it('should handle whitespace-only without newlines', () => {
      const text = createJsxText('   ');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('   ');
    });

    it('should normalize multiple newlines', () => {
      const text = createJsxText('hello\n\n\nworld');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('hello world');
    });

    it('should preserve significant whitespace', () => {
      const text = createJsxText('hello\u00A0world');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('hello\u00A0world');
    });

    it('should handle mixed whitespace', () => {
      const text = createJsxText('  hello   world  ');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('  hello   world  ');
    });

    it('should handle newlines at boundaries', () => {
      const text = createJsxText('\n  hello  \n');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('hello');
    });

    it('should handle complex whitespace scenarios', () => {
      const text = createJsxText('  hello\n  world  ');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('  hello world  ');
    });

    it('should handle text with only newlines', () => {
      const text = createJsxText('\n\n\n');
      const result = buildSanitizedTextContent(text);
      expect(result).toBeNull();
    });

    it('should handle single newline', () => {
      const text = createJsxText('\n');
      const result = buildSanitizedTextContent(text);
      expect(result).toBeNull();
    });

    it('should handle tabs and spaces', () => {
      const text = createJsxText('\t hello \t world \t');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('\t hello \t world \t');
    });

    it('should handle mixed significant and normal whitespace', () => {
      const text = createJsxText('  hello\u00A0\u202F world  ');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('  hello\u00A0\u202F world  ');
    });

    it('should handle newlines in the middle of significant whitespace', () => {
      const text = createJsxText('\u00A0hello\n\nworld\u202F');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('\u00A0hello world\u202F');
    });

    it('should handle single character', () => {
      const text = createJsxText('x');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('x');
    });

    it('should handle single significant whitespace character', () => {
      const text = createJsxText('\u00A0');
      const result = buildSanitizedTextContent(text);
      expect(result).toBe('\u00A0');
    });
  });

  describe('edge cases and integration', () => {
    it('should handle empty inputs consistently', () => {
      expect(jsNumberToString(0)).toBe('0');
      expect(getTagName(t.jsxIdentifier(''))).toBe('');
      expect(getVariableType('')).toBe(VariableType.Variable);
      expect(extractHtmlContentProps([])).toEqual({});
      expect(filterJsxChildren([])).toEqual([]);
      expect(buildSanitizedTextContent(t.jsxText(''))).toBe('');
    });

    it('should handle special Unicode scenarios', () => {
      const unicodeText = t.jsxText('Hello\u2000\u3000World');
      const result = buildSanitizedTextContent(unicodeText);
      expect(result).toBe('Hello\u2000\u3000World');
    });

    it('should maintain consistency with whitespace utilities', () => {
      const textWithSignificantWhitespace = t.jsxText('\u00A0content\u202F');
      const result = buildSanitizedTextContent(textWithSignificantWhitespace);
      expect(result).toBe('\u00A0content\u202F');
    });
  });
});
