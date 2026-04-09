import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { handleDerivation } from '../handleDerivation.js';
import { nodeToStrings } from '../../../parseString.js';

// Handle CommonJS/ESM interop
const traverse = (traverseModule as any).default || traverseModule;

const FILE_PATH = 'test.tsx';
const PARSING_OPTIONS = { conditionNames: [] };

/**
 * Parses the given code, finds the first expression of the specified type,
 * and runs handleDerivation on it.
 */
function runHandleDerivation(
  code: string,
  runtimeInterpolation: boolean = false
): { result: ReturnType<typeof handleDerivation>; errors: string[] } {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let result: ReturnType<typeof handleDerivation> = null;
  const errors: string[] = [];

  traverse(ast, {
    ExpressionStatement(path: NodePath<t.ExpressionStatement>) {
      const expr = path.node.expression;
      if (!t.isExpression(expr)) return;
      result = handleDerivation({
        expr,
        tPath: path,
        file: FILE_PATH,
        parsingOptions: PARSING_OPTIONS,
        errors,
        warnings: new Set(),
        runtimeInterpolationState: runtimeInterpolation
          ? { index: 0 }
          : undefined,
        skipDeriveInvocation: false,
      });
      path.stop();
    },
  });

  return { result, errors };
}

/**
 * Runs handleDerivation via a tagged template expression, mimicking how
 * the real entry point processes `t`...`` expressions.
 * Each interpolated expression in the template is processed by handleDerivation.
 */
function runTaggedTemplate(
  code: string,
  runtimeInterpolation: boolean = false
): { strings: string[]; errors: string[] } {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let result: ReturnType<typeof handleDerivation> = null;
  const errors: string[] = [];

  traverse(ast, {
    TaggedTemplateExpression(path: NodePath<t.TaggedTemplateExpression>) {
      if (t.isIdentifier(path.node.tag) && path.node.tag.name === 't') {
        const templateLiteral = path.node.quasi;
        result = handleDerivation({
          expr: templateLiteral,
          tPath: path,
          file: FILE_PATH,
          parsingOptions: PARSING_OPTIONS,
          errors,
          warnings: new Set(),
          runtimeInterpolationState: runtimeInterpolation
            ? { index: 0 }
            : undefined,
          skipDeriveInvocation: false,
        });
        path.stop();
      }
    },
  });

  return { strings: result ? nodeToStrings(result) : [], errors };
}

describe('handleDerivation', () => {
  describe('static expressions (no runtime interpolation)', () => {
    it('should handle string literals', () => {
      // Wrap in parens so Babel parses as ExpressionStatement, not Directive
      const { result, errors } = runHandleDerivation('("hello")');
      expect(result).toEqual({ type: 'text', text: 'hello' });
      expect(errors).toHaveLength(0);
    });

    it('should handle numeric literals', () => {
      const { result, errors } = runHandleDerivation('42');
      expect(result).toEqual({ type: 'text', text: '42' });
      expect(errors).toHaveLength(0);
    });

    it('should handle boolean literals', () => {
      const { result } = runHandleDerivation('true');
      expect(result).toEqual({ type: 'text', text: 'true' });
    });

    it('should handle null literal', () => {
      const { result } = runHandleDerivation('null');
      expect(result).toEqual({ type: 'text', text: 'null' });
    });

    it('should handle string concatenation', () => {
      const { result, errors } = runHandleDerivation('"A" + "B"');
      expect(result).toEqual({
        type: 'sequence',
        nodes: [
          { type: 'text', text: 'A' },
          { type: 'text', text: 'B' },
        ],
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('dynamic expressions WITHOUT runtime interpolation', () => {
    it('should return null and error for identifier', () => {
      const { result, errors } = runHandleDerivation('name');
      expect(result).toBeNull();
      expect(errors).toHaveLength(0); // identifiers fall through to catch-all
    });

    it('should return null and error for non-derive call expression', () => {
      const { result, errors } = runHandleDerivation('foo()');
      expect(result).toBeNull();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('foo');
    });

    it('should return null for binary expression with dynamic part', () => {
      const { result } = runHandleDerivation('"A" + name');
      expect(result).toBeNull();
    });
  });

  describe('dynamic expressions WITH runtime interpolation', () => {
    it('should produce {0} placeholder for identifier', () => {
      const { result, errors } = runHandleDerivation('name', true);
      expect(result).toEqual({ type: 'text', text: '{0}' });
      expect(errors).toHaveLength(0);
    });

    it('should produce {0} placeholder for non-derive call expression', () => {
      const { result, errors } = runHandleDerivation('foo()', true);
      expect(result).toEqual({ type: 'text', text: '{0}' });
      expect(errors).toHaveLength(0);
    });

    it('should produce {0} placeholder for member expression', () => {
      const { result, errors } = runHandleDerivation('user.name', true);
      expect(result).toEqual({ type: 'text', text: '{0}' });
      expect(errors).toHaveLength(0);
    });

    it('should inline static part and produce {0} for dynamic part in binary expression', () => {
      const { result, errors } = runHandleDerivation('"A" + name', true);
      expect(result).toEqual({
        type: 'sequence',
        nodes: [
          { type: 'text', text: 'A' },
          { type: 'text', text: '{0}' },
        ],
      });
      expect(errors).toHaveLength(0);
    });

    it('should assign consistent indices across binary expression', () => {
      const { result, errors } = runHandleDerivation('a + b', true);
      expect(result).toEqual({
        type: 'sequence',
        nodes: [
          { type: 'text', text: '{0}' },
          { type: 'text', text: '{1}' },
        ],
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('tagged template with runtime interpolation', () => {
    it('should produce {0} for single dynamic expression', () => {
      const { strings, errors } = runTaggedTemplate('t`Hello, ${name}`', true);
      expect(strings).toEqual(['Hello, {0}']);
      expect(errors).toHaveLength(0);
    });

    it('should produce sequential indices for multiple expressions', () => {
      const { strings, errors } = runTaggedTemplate(
        't`${greeting}, ${name}!`',
        true
      );
      expect(strings).toEqual(['{0}, {1}!']);
      expect(errors).toHaveLength(0);
    });

    it('should produce {0} for call expression in template', () => {
      const { strings, errors } = runTaggedTemplate(
        't`result: ${foo()}`',
        true
      );
      expect(strings).toEqual(['result: {0}']);
      expect(errors).toHaveLength(0);
    });

    it('should inline static concat and assign {n} to dynamic parts', () => {
      const { strings, errors } = runTaggedTemplate('t`A${"B" + name}C`', true);
      expect(strings).toEqual(['AB{0}C']);
      expect(errors).toHaveLength(0);
    });

    it('should handle nested template with static + dynamic concat', () => {
      const { strings, errors } = runTaggedTemplate('t`X${name + "Y"}Z`', true);
      expect(strings).toEqual(['X{0}YZ']);
      expect(errors).toHaveLength(0);
    });

    it('should handle multiple dynamic expressions with correct indices', () => {
      const { strings, errors } = runTaggedTemplate('t`${a}${b}${c}`', true);
      expect(strings).toEqual(['{0}{1}{2}']);
      expect(errors).toHaveLength(0);
    });

    it('should handle member expression in template', () => {
      const { strings, errors } = runTaggedTemplate(
        't`Hello, ${user.name}`',
        true
      );
      expect(strings).toEqual(['Hello, {0}']);
      expect(errors).toHaveLength(0);
    });
  });

  describe('autoderive (skipDeriveInvocation: true)', () => {
    /**
     * Runs handleDerivation with skipDeriveInvocation: true.
     */
    function runHandleDerivationAutoDerive(
      code: string,
      runtimeInterpolation: boolean = false
    ): { result: ReturnType<typeof handleDerivation>; errors: string[] } {
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let result: ReturnType<typeof handleDerivation> = null;
      const errors: string[] = [];

      traverse(ast, {
        ExpressionStatement(path: NodePath<t.ExpressionStatement>) {
          const expr = path.node.expression;
          if (!t.isExpression(expr)) return;
          result = handleDerivation({
            expr,
            tPath: path,
            file: FILE_PATH,
            parsingOptions: PARSING_OPTIONS,
            errors,
            warnings: new Set(),
            runtimeInterpolationState: runtimeInterpolation
              ? { index: 0 }
              : undefined,
            skipDeriveInvocation: true,
          });
          path.stop();
        },
      });

      return { result, errors };
    }

    it('should resolve identifier via scope when variable is defined', () => {
      const { result, errors } = runHandleDerivationAutoDerive(
        'const greeting = "hello";\ngreeting'
      );
      // resolveCallStringVariants -> parseStringExpression resolves the const binding
      expect(result).toEqual({
        type: 'choice',
        nodes: [{ type: 'text', text: 'hello' }],
      });
      expect(errors).toHaveLength(0);
    });

    it('should error for non-resolvable identifier', () => {
      const { result, errors } = runHandleDerivationAutoDerive('unknown');
      // No binding in scope -> parseStringExpression returns null -> error
      expect(result).toBeNull();
      expect(errors).toHaveLength(1);
    });

    it('should still return static text for string literals', () => {
      const { result, errors } = runHandleDerivationAutoDerive('("hello")');
      // Static string literals are handled before the skipDeriveInvocation fallback
      expect(result).toEqual({ type: 'text', text: 'hello' });
      expect(errors).toHaveLength(0);
    });

    it('should still handle binary expression with static parts', () => {
      const { result, errors } = runHandleDerivationAutoDerive('"A" + "B"');
      expect(result).toEqual({
        type: 'sequence',
        nodes: [
          { type: 'text', text: 'A' },
          { type: 'text', text: 'B' },
        ],
      });
      expect(errors).toHaveLength(0);
    });

    it('should still error for non-derive call expression', () => {
      const { result, errors } = runHandleDerivationAutoDerive('foo()');
      // Call expressions are handled at the top of handleDerivation, not by skipDeriveInvocation
      expect(result).toBeNull();
      expect(errors).toHaveLength(1);
    });

    it('should resolve identifier inside template literal via skipDeriveInvocation', () => {
      const code = 'const name = "world";\n`Hello ${name}`';
      const { result, errors } = runHandleDerivationAutoDerive(code);
      // Template literal handler recurses with skipDeriveInvocation for non-derive expressions
      // The identifier 'name' hits the skipDeriveInvocation fallback and resolves
      expect(result).toEqual({
        type: 'sequence',
        nodes: [
          { type: 'text', text: 'Hello ' },
          {
            type: 'choice',
            nodes: [{ type: 'text', text: 'world' }],
          },
        ],
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('tagged template WITHOUT runtime interpolation', () => {
    it('should return null for dynamic expression in template', () => {
      const { strings } = runTaggedTemplate('t`Hello, ${name}`', false);
      // handleDerivation returns null for identifiers without runtime interpolation,
      // causing the template to bail out with no result
      expect(strings).toEqual([]);
    });

    it('should still resolve static expressions in template', () => {
      const { strings, errors } = runTaggedTemplate(
        't`Hello, ${"world"}`',
        false
      );
      expect(strings).toEqual(['Hello, world']);
      expect(errors).toHaveLength(0);
    });
  });
});
