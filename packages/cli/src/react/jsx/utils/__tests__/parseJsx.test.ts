import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import { parseJSXElement } from '../parseJsx.js';
import { Updates } from '../../../../types/index.js';

describe('parseJSXElement', () => {
  const parseCode = (code: string) => {
    return parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  };

  const createMockParams = () => ({
    importAliases: { T: 'T' },
    updates: [] as Updates,
    errors: [] as string[],
    warnings: new Set<string>(),
    file: 'test.tsx',
  });

  it('should skip non-T components', () => {
    const code = `const el = <div>Content</div>;`;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        parseJSXElement(
          params.importAliases,
          path.node,
          params.updates,
          params.errors,
          params.warnings,
          params.file
        );
      },
    });

    expect(params.updates).toHaveLength(0);
  });

  it('should parse T component with string attributes', () => {
    const code = `const el = <T id="test" context="greeting">Hello world</T>;`;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        parseJSXElement(
          params.importAliases,
          path.node,
          params.updates,
          params.errors,
          params.warnings,
          params.file
        );
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0].metadata).toEqual({
      id: 'test',
      context: 'greeting',
    });
  });

  it('should parse T component with static expression attributes', () => {
    const code = `const el = <T id={'static-id'} context={'static-context'}>Content</T>;`;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        parseJSXElement(
          params.importAliases,
          path.node,
          params.updates,
          params.errors,
          params.warnings,
          params.file
        );
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0].metadata).toEqual({
      id: 'static-id',
      context: 'static-context',
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should add errors for non-static GT attribute expressions', () => {
    const code = `const el = <T id={dynamicId} context={dynamicContext}>Content</T>;`;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        parseJSXElement(
          params.importAliases,
          path.node,
          params.updates,
          params.errors,
          params.warnings,
          params.file
        );
      },
    });

    expect(params.errors.length).toBeGreaterThan(0);
    expect(params.updates).toHaveLength(0); // Should not add to updates due to errors
  });

  it('should handle T component with unwrapped expressions in children', () => {
    const code = `const el = <T id="test">Hello {variable}</T>;`;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        parseJSXElement(
          params.importAliases,
          path.node,
          params.updates,
          params.errors,
          params.warnings,
          params.file
        );
      },
    });

    expect(params.errors.length).toBeGreaterThan(0);
    expect(params.updates).toHaveLength(0); // Should not add to updates due to unwrapped expressions
  });

  it('should successfully parse valid T component', () => {
    const code = `const el = <T id="greeting">Hello {'world'}</T>;`;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        parseJSXElement(
          params.importAliases,
          path.node,
          params.updates,
          params.errors,
          params.warnings,
          params.file
        );
      },
    });

    expect(params.errors).toHaveLength(0);
    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'JSX',
      source: expect.any(Object), // The processed JSX tree
      metadata: {
        id: 'greeting',
      },
    });
  });

  it('should handle T component with other attributes', () => {
    const code = `const el = <T id="test" customProp={someVar}>Content</T>;`;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        parseJSXElement(
          params.importAliases,
          path.node,
          params.updates,
          params.errors,
          params.warnings,
          params.file
        );
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0].metadata).toEqual({
      id: 'test',
      customProp: 'someVar',
    });
  });

  describe('HTML content props (title, placeholder, alt, etc.)', () => {
    it('should include static title attribute in translations', () => {
      const code = `const el = <T><input title="Static tooltip" /></T>;`;
      const ast = parseCode(code);
      const params = {
        ...createMockParams(),
        importAliases: { T: 'T' },
      };

      traverse(ast, {
        JSXElement(path: NodePath<t.JSXElement>) {
          parseJSXElement(
            params.importAliases,
            path.node,
            params.updates,
            params.errors,
            params.warnings,
            params.file
          );
        },
      });

      expect(params.errors).toHaveLength(0);
      expect(params.updates).toHaveLength(1);
      // The source should contain the static title in the GTData
      expect(JSON.stringify(params.updates[0].source)).toContain('Static tooltip');
    });

    it('should exclude function call as title attribute from translations', () => {
      const code = `
        const getTooltip = () => 'Dynamic tooltip';
        const el = <T><input title={getTooltip()} /></T>;
      `;
      const ast = parseCode(code);
      const params = {
        ...createMockParams(),
        importAliases: { T: 'T' },
      };

      traverse(ast, {
        JSXElement(path: NodePath<t.JSXElement>) {
          parseJSXElement(
            params.importAliases,
            path.node,
            params.updates,
            params.errors,
            params.warnings,
            params.file
          );
        },
      });

      expect(params.errors).toHaveLength(0);
      expect(params.updates).toHaveLength(1);
      // The source should NOT contain the function call as a title
      expect(JSON.stringify(params.updates[0].source)).not.toContain('getTooltip()');
    });

    it('should exclude variable reference as title attribute from translations', () => {
      const code = `
        const t = getGT();
        const el = <T><input title={t} placeholder={t} /></T>;
      `;
      const ast = parseCode(code);
      const params = {
        ...createMockParams(),
        importAliases: { T: 'T' },
      };

      traverse(ast, {
        JSXElement(path: NodePath<t.JSXElement>) {
          parseJSXElement(
            params.importAliases,
            path.node,
            params.updates,
            params.errors,
            params.warnings,
            params.file
          );
        },
      });

      expect(params.errors).toHaveLength(0);
      expect(params.updates).toHaveLength(1);
      // The source should NOT contain the variable reference as title or placeholder
      const sourceStr = JSON.stringify(params.updates[0].source);
      expect(sourceStr).not.toContain('ti');
      expect(sourceStr).not.toContain('pl');
    });

    it('should include static template literal as title attribute from translations', () => {
      const code = 'const el = <T><input title={`Static template`} /></T>;';
      const ast = parseCode(code);
      const params = {
        ...createMockParams(),
        importAliases: { T: 'T' },
      };

      traverse(ast, {
        JSXElement(path: NodePath<t.JSXElement>) {
          parseJSXElement(
            params.importAliases,
            path.node,
            params.updates,
            params.errors,
            params.warnings,
            params.file
          );
        },
      });

      expect(params.errors).toHaveLength(0);
      expect(params.updates).toHaveLength(1);
      // The source should contain the static template literal in the GTData
      expect(JSON.stringify(params.updates[0].source)).toContain('Static template');
    });
  });

  describe('integration with Plural and Branch components', () => {
    it('should handle template literals in Plural component attributes', () => {
      const code = `const el = <T><Plural count={count} one={\`I have \${count} book\`}>Books</Plural></T>;`;
      const ast = parseCode(code);
      const params = {
        ...createMockParams(),
        importAliases: { T: 'T', Plural: 'Plural' },
      };

      traverse(ast, {
        JSXElement(path: NodePath<t.JSXElement>) {
          parseJSXElement(
            params.importAliases,
            path.node,
            params.updates,
            params.errors,
            params.warnings,
            params.file
          );
        },
      });

      // Should detect non-static template literal in plural form attribute
      expect(params.errors.length).toBeGreaterThan(0);
    });

    it('should handle static template literals in Branch component', () => {
      const code = `const el = <T><Branch branch="test" other="Other text">Branch content</Branch></T>;`;
      const ast = parseCode(code);
      const params = {
        ...createMockParams(),
        importAliases: { T: 'T', Branch: 'Branch' },
      };

      traverse(ast, {
        JSXElement(path: NodePath<t.JSXElement>) {
          parseJSXElement(
            params.importAliases,
            path.node,
            params.updates,
            params.errors,
            params.warnings,
            params.file
          );
        },
      });

      expect(params.errors).toHaveLength(0);
      expect(params.updates).toHaveLength(1);
    });
  });
});
