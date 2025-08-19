import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import {
  isMeaningful,
  isStaticExpression,
  isStaticValue,
} from '../evaluateJsx.js';

describe('isMeaningful', () => {
  describe('string literals', () => {
    it('should return true for string literals with meaningful content', () => {
      const node = t.stringLiteral('Hello world');
      expect(isMeaningful(node)).toBe(true);
    });

    it('should return false for string literals with only whitespace', () => {
      const node = t.stringLiteral('   \n\t   ');
      expect(isMeaningful(node)).toBe(false);
    });

    it('should return true for string literals with mixed content', () => {
      const node = t.stringLiteral('  Hello  ');
      expect(isMeaningful(node)).toBe(true);
    });

    it('should return false for empty string literals', () => {
      const node = t.stringLiteral('');
      expect(isMeaningful(node)).toBe(false);
    });
  });

  describe('JSX text nodes', () => {
    it('should return true for JSX text with meaningful content', () => {
      const node = t.jsxText('Hello world');
      expect(isMeaningful(node)).toBe(true);
    });

    it('should return false for JSX text with only whitespace', () => {
      const node = t.jsxText('   \n\t   ');
      expect(isMeaningful(node)).toBe(false);
    });

    it('should return true for JSX text with numbers', () => {
      const node = t.jsxText('123');
      expect(isMeaningful(node)).toBe(true);
    });

    it('should return false for empty JSX text', () => {
      const node = t.jsxText('');
      expect(isMeaningful(node)).toBe(false);
    });
  });

  describe('template literals', () => {
    it('should return true for template literals without expressions and meaningful content', () => {
      const node = t.templateLiteral(
        [
          t.templateElement(
            { raw: 'Hello world', cooked: 'Hello world' },
            true
          ),
        ],
        []
      );
      expect(isMeaningful(node)).toBe(true);
    });

    it('should return false for template literals without expressions and only whitespace', () => {
      const node = t.templateLiteral(
        [t.templateElement({ raw: '   \n\t   ', cooked: '   \n\t   ' }, true)],
        []
      );
      expect(isMeaningful(node)).toBe(false);
    });

    it('should return false for template literals with expressions', () => {
      const node = t.templateLiteral(
        [
          t.templateElement({ raw: 'Hello ', cooked: 'Hello ' }, false),
          t.templateElement({ raw: '!', cooked: '!' }, true),
        ],
        [t.identifier('name')]
      );
      expect(isMeaningful(node)).toBe(false);
    });
  });

  describe('JSX expression containers', () => {
    it('should return true for JSX expression containers with static meaningful expressions', () => {
      const stringLiteral = t.stringLiteral('Hello world');
      const node = t.jsxExpressionContainer(stringLiteral);
      expect(isMeaningful(node)).toBe(true);
    });

    it('should return false for JSX expression containers with static non-meaningful expressions', () => {
      const stringLiteral = t.stringLiteral('   ');
      const node = t.jsxExpressionContainer(stringLiteral);
      expect(isMeaningful(node)).toBe(false);
    });

    it('should return false for JSX expression containers with non-static expressions', () => {
      const identifier = t.identifier('variable');
      const node = t.jsxExpressionContainer(identifier);
      expect(isMeaningful(node)).toBe(false);
    });
  });

  describe('binary expressions', () => {
    it('should return true for binary + expressions where left side is meaningful', () => {
      const left = t.stringLiteral('Hello');
      const right = t.stringLiteral('   ');
      const node = t.binaryExpression('+', left, right);
      expect(isMeaningful(node)).toBe(true);
    });

    it('should return true for binary + expressions where right side is meaningful', () => {
      const left = t.stringLiteral('   ');
      const right = t.stringLiteral('world');
      const node = t.binaryExpression('+', left, right);
      expect(isMeaningful(node)).toBe(true);
    });

    it('should return false for binary + expressions where neither side is meaningful', () => {
      const left = t.stringLiteral('   ');
      const right = t.stringLiteral('\t\n');
      const node = t.binaryExpression('+', left, right);
      expect(isMeaningful(node)).toBe(false);
    });

    it('should return false for non-addition binary expressions', () => {
      const left = t.stringLiteral('Hello');
      const right = t.stringLiteral('world');
      const node = t.binaryExpression('-', left, right);
      expect(isMeaningful(node)).toBe(false);
    });
  });

  describe('other node types', () => {
    it('should return false for identifier nodes', () => {
      const node = t.identifier('variable');
      expect(isMeaningful(node)).toBe(false);
    });

    it('should return false for numeric literals', () => {
      const node = t.numericLiteral(42);
      expect(isMeaningful(node)).toBe(false);
    });

    it('should return false for boolean literals', () => {
      const node = t.booleanLiteral(true);
      expect(isMeaningful(node)).toBe(false);
    });
  });
});

describe('isStaticExpression', () => {
  describe('JSX empty expressions', () => {
    it('should return static true with empty string for JSX empty expressions', () => {
      const expr = t.jsxEmptyExpression();
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: '' });
    });
  });

  describe('string literals', () => {
    it('should return static true with value for string literals', () => {
      const expr = t.stringLiteral('Hello world');
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: 'Hello world' });
    });

    it('should handle empty string literals', () => {
      const expr = t.stringLiteral('');
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: '' });
    });
  });

  describe('template literals', () => {
    it('should return static true for template literals without expressions', () => {
      const expr = t.templateLiteral(
        [
          t.templateElement(
            { raw: 'Hello world', cooked: 'Hello world' },
            true
          ),
        ],
        []
      );
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: 'Hello world' });
    });

    it('should return static false for template literals with expressions', () => {
      const expr = t.templateLiteral(
        [
          t.templateElement({ raw: 'Hello ', cooked: 'Hello ' }, false),
          t.templateElement({ raw: '!', cooked: '!' }, true),
        ],
        [t.identifier('name')]
      );
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: false });
    });
  });

  describe('binary expressions', () => {
    it('should handle string concatenation with static values', () => {
      const left = t.stringLiteral('Hello ');
      const right = t.stringLiteral('world');
      const expr = t.binaryExpression('+', left, right);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: false });
    });

    it('should handle mixed type concatenation', () => {
      const left = t.stringLiteral('Number: ');
      const right = t.numericLiteral(42);
      const expr = t.binaryExpression('+', left, right);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: false });
    });

    it('should return static false for non-addition operators', () => {
      const left = t.stringLiteral('Hello');
      const right = t.stringLiteral('world');
      const expr = t.binaryExpression('-', left, right);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: false });
    });

    it('should return static false when left operand is not static', () => {
      const left = t.identifier('variable');
      const right = t.stringLiteral('world');
      const expr = t.binaryExpression('+', left, right);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: false });
    });

    it('should return static false when right operand is not static', () => {
      const left = t.stringLiteral('Hello ');
      const right = t.identifier('variable');
      const expr = t.binaryExpression('+', left, right);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: false });
    });
  });

  describe('parenthesized expressions', () => {
    it('should unwrap parenthesized expressions', () => {
      const inner = t.stringLiteral('Hello world');
      const expr = t.parenthesizedExpression(inner);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: 'Hello world' });
    });

    it('should handle nested parentheses', () => {
      const inner = t.stringLiteral('Hello');
      const wrapped = t.parenthesizedExpression(inner);
      const expr = t.parenthesizedExpression(wrapped);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: 'Hello' });
    });
  });

  describe('numeric literals', () => {
    it('should convert numeric literals to strings', () => {
      const expr = t.numericLiteral(42);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: '42' });
    });

    it('should handle decimal numbers', () => {
      const expr = t.numericLiteral(3.14);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: '3.14' });
    });

    it('should handle zero', () => {
      const expr = t.numericLiteral(0);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: '0' });
    });
  });

  describe('boolean literals', () => {
    it('should convert true to string', () => {
      const expr = t.booleanLiteral(true);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: 'true' });
    });

    it('should convert false to string', () => {
      const expr = t.booleanLiteral(false);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: 'false' });
    });
  });

  describe('null literals', () => {
    it('should convert null to string', () => {
      const expr = t.nullLiteral();
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: true, value: 'null' });
    });
  });

  describe('non-static expressions', () => {
    it('should return static false for identifier expressions', () => {
      const expr = t.identifier('variable');
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: false });
    });

    it('should return static false for function calls', () => {
      const expr = t.callExpression(t.identifier('func'), []);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: false });
    });

    it('should return static false for object expressions', () => {
      const expr = t.objectExpression([]);
      const result = isStaticExpression(expr);
      expect(result).toEqual({ isStatic: false });
    });
  });
});

describe('isStaticValue', () => {
  describe('string literals', () => {
    it('should return true for string literals', () => {
      const expr = t.stringLiteral('Hello world');
      expect(isStaticValue(expr)).toBe(true);
    });

    it('should return true for empty string literals', () => {
      const expr = t.stringLiteral('');
      expect(isStaticValue(expr)).toBe(true);
    });
  });

  describe('numeric literals', () => {
    it('should return true for numeric literals', () => {
      const expr = t.numericLiteral(42);
      expect(isStaticValue(expr)).toBe(true);
    });

    it('should return true for zero', () => {
      const expr = t.numericLiteral(0);
      expect(isStaticValue(expr)).toBe(true);
    });

    it('should return true for decimal numbers', () => {
      const expr = t.numericLiteral(3.14);
      expect(isStaticValue(expr)).toBe(true);
    });
  });

  describe('template literals', () => {
    it('should return true for template literals (regardless of expressions)', () => {
      const expr = t.templateLiteral(
        [
          t.templateElement(
            { raw: 'Hello world', cooked: 'Hello world' },
            true
          ),
        ],
        []
      );
      expect(isStaticValue(expr)).toBe(true);
    });

    it('should return true for template literals with expressions', () => {
      const expr = t.templateLiteral(
        [
          t.templateElement({ raw: 'Hello ', cooked: 'Hello ' }, false),
          t.templateElement({ raw: '!', cooked: '!' }, true),
        ],
        [t.identifier('name')]
      );
      expect(isStaticValue(expr)).toBe(true);
    });
  });

  describe('non-static values', () => {
    it('should return false for boolean literals', () => {
      const expr = t.booleanLiteral(true);
      expect(isStaticValue(expr)).toBe(false);
    });

    it('should return false for null literals', () => {
      const expr = t.nullLiteral();
      expect(isStaticValue(expr)).toBe(false);
    });

    it('should return false for identifier expressions', () => {
      const expr = t.identifier('variable');
      expect(isStaticValue(expr)).toBe(false);
    });

    it('should return false for binary expressions', () => {
      const left = t.stringLiteral('Hello ');
      const right = t.stringLiteral('world');
      const expr = t.binaryExpression('+', left, right);
      expect(isStaticValue(expr)).toBe(false);
    });

    it('should return false for function calls', () => {
      const expr = t.callExpression(t.identifier('func'), []);
      expect(isStaticValue(expr)).toBe(false);
    });
  });
});

describe('Integration tests with parsed AST', () => {
  const parseCode = (code: string) => {
    return parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  };

  describe('isMeaningful with parsed JSX', () => {
    it('should identify meaningful JSX text content', () => {
      const code = `const el = <div>Hello world</div>;`;
      const ast = parseCode(code);
      const results: boolean[] = [];

      traverse(ast, {
        JSXText(path: NodePath<t.JSXText>) {
          results.push(isMeaningful(path.node));
        },
      });

      expect(results).toEqual([true]);
    });

    it('should identify non-meaningful whitespace JSX text', () => {
      const code = `const el = <div>   \n\t   </div>;`;
      const ast = parseCode(code);
      const results: boolean[] = [];

      traverse(ast, {
        JSXText(path: NodePath<t.JSXText>) {
          results.push(isMeaningful(path.node));
        },
      });

      expect(results).toEqual([false]);
    });

    it('should identify meaningful JSX expression containers with static content', () => {
      const code = `const el = <div>{'Hello world'}</div>;`;
      const ast = parseCode(code);
      const results: boolean[] = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          results.push(isMeaningful(path.node));
        },
      });

      expect(results).toEqual([true]);
    });

    it('should identify non-meaningful JSX expression containers with variables', () => {
      const code = `const el = <div>{variable}</div>;`;
      const ast = parseCode(code);
      const results: boolean[] = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          results.push(isMeaningful(path.node));
        },
      });

      expect(results).toEqual([false]);
    });

    it('should handle template literals in JSX expressions', () => {
      const code = `const el = <div>{\`Hello world\`}</div>;`;
      const ast = parseCode(code);
      const results: boolean[] = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          results.push(isMeaningful(path.node));
        },
      });

      expect(results).toEqual([true]);
    });
  });

  describe('isStaticExpression with parsed expressions', () => {
    it('should handle string literals in JSX expressions', () => {
      const code = `const el = <div>{'Hello world'}</div>;`;
      const ast = parseCode(code);
      const results: Array<{ isStatic: boolean; value?: string }> = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          if (t.isExpression(path.node.expression)) {
            results.push(isStaticExpression(path.node.expression));
          }
        },
      });

      expect(results).toEqual([{ isStatic: true, value: 'Hello world' }]);
    });

    it('should handle binary expressions in JSX', () => {
      const code = `const el = <div>{'Hello ' + 'world'}</div>;`;
      const ast = parseCode(code);
      const results: Array<{ isStatic: boolean; value?: string }> = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          if (t.isExpression(path.node.expression)) {
            results.push(isStaticExpression(path.node.expression));
          }
        },
      });

      expect(results).toEqual([{ isStatic: false }]);
    });

    it('should handle numeric literals in JSX expressions', () => {
      const code = `const el = <div>{42}</div>;`;
      const ast = parseCode(code);
      const results: Array<{ isStatic: boolean; value?: string }> = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          if (t.isExpression(path.node.expression)) {
            results.push(isStaticExpression(path.node.expression));
          }
        },
      });

      expect(results).toEqual([{ isStatic: true, value: '42' }]);
    });

    it('should handle variables in JSX expressions', () => {
      const code = `const el = <div>{variable}</div>;`;
      const ast = parseCode(code);
      const results: Array<{ isStatic: boolean; value?: string }> = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          if (t.isExpression(path.node.expression)) {
            results.push(isStaticExpression(path.node.expression));
          }
        },
      });

      expect(results).toEqual([{ isStatic: false }]);
    });

    it('should handle template literals with expressions', () => {
      const code = `const el = <div>{\`Hello \${name}!\`}</div>;`;
      const ast = parseCode(code);
      const results: Array<{ isStatic: boolean; value?: string }> = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          if (t.isExpression(path.node.expression)) {
            results.push(isStaticExpression(path.node.expression));
          }
        },
      });

      expect(results).toEqual([{ isStatic: false }]);
    });

    it('should handle parenthesized expressions', () => {
      const code = `const el = <div>{('Hello world')}</div>;`;
      const ast = parseCode(code);
      const results: Array<{ isStatic: boolean; value?: string }> = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          if (t.isExpression(path.node.expression)) {
            results.push(isStaticExpression(path.node.expression));
          }
        },
      });

      expect(results).toEqual([{ isStatic: true, value: 'Hello world' }]);
    });
  });

  describe('isStaticValue with parsed expressions', () => {
    it('should identify static values in JSX expressions', () => {
      const code = `
        const el = (
          <div>
            {'Hello'}
            {42}
            {\`template\`}
            {true}
            {variable}
          </div>
        );
      `;
      const ast = parseCode(code);
      const results: boolean[] = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          if (t.isExpression(path.node.expression)) {
            results.push(isStaticValue(path.node.expression));
          }
        },
      });

      expect(results).toEqual([true, true, true, false, false]);
    });

    it('should handle complex expressions', () => {
      const code = `
        const el = (
          <div>
            {'Hello' + 'World'}
            {func()}
            {obj.prop}
          </div>
        );
      `;
      const ast = parseCode(code);
      const results: boolean[] = [];

      traverse(ast, {
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          if (t.isExpression(path.node.expression)) {
            results.push(isStaticValue(path.node.expression));
          }
        },
      });

      expect(results).toEqual([false, false, false]);
    });
  });

  describe('Mixed content analysis', () => {
    it('should handle JSX with mixed text and expressions', () => {
      const code = `
        const el = (
          <div>
            Hello world
            {'Static string'}
            {variable}
               
            {42 + 24}
          </div>
        );
      `;
      const ast = parseCode(code);
      const meaningfulNodes: boolean[] = [];
      const staticExpressions: Array<{ isStatic: boolean; value?: string }> =
        [];
      const jsxTextValues: string[] = [];
      const expressionValues: string[] = [];

      traverse(ast, {
        JSXText(path: NodePath<t.JSXText>) {
          jsxTextValues.push(JSON.stringify(path.node.value));
          meaningfulNodes.push(isMeaningful(path.node));
        },
        JSXExpressionContainer(path: NodePath<t.JSXExpressionContainer>) {
          if (t.isExpression(path.node.expression)) {
            expressionValues.push(path.node.expression.type);
          }
          meaningfulNodes.push(isMeaningful(path.node));
          if (t.isExpression(path.node.expression)) {
            staticExpressions.push(isStaticExpression(path.node.expression));
          }
        },
      });

      // Based on the debug output:
      // JSXText nodes: "\n            Hello world\n            " (true), "\n            " (false), "\n               \n            " (false), "\n          " (false)
      // JSXExpressionContainer nodes: 'Static string' (true), variable (false), 42 + 24 (false, but evaluates to "4224" as string concat)
      expect(meaningfulNodes).toEqual([
        true,
        true,
        false,
        false,
        false,
        false,
        false,
      ]);
      expect(staticExpressions).toEqual([
        { isStatic: true, value: 'Static string' },
        { isStatic: false },
        { isStatic: false }, // Binary + operation treats both numbers as strings
      ]);
    });
  });
});
