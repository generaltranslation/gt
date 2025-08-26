import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { parseStrings } from '../parseStringFunction.js';
import { Updates } from '../../../../types/index.js';

describe('parseStrings', () => {
  const parseCode = (code: string) => {
    return parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  };

  const createMockParams = () => ({
    updates: [] as Updates,
    errors: [] as string[],
    file: 'test.tsx',
  });

  it('should handle direct msg.encode() calls', () => {
    const code = `
      import { msg } from 'generaltranslation';
      msg.encode('hello world');
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'msg' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'msg',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {},
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle useGT() translation calls', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      const t = useGT();
      t('hello world', { $id: 'greeting' });
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {
        id: 'greeting',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle getGT() translation calls in async functions', () => {
    const code = `
      import { getGT } from 'generaltranslation';
      async function test() {
        const t = await getGT();
        t('hello world', { $context: 'page' });
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'getGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'getGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {
        context: 'page',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle template literals without expressions', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      const t = useGT();
      t(\`hello world\`);
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {},
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should add errors for template literals with expressions', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      const t = useGT();
      const name = 'world';
      t(\`hello \${name}\`);
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(0);
    expect(params.errors.length).toBeGreaterThan(0);
  });

  it('should add errors for non-string arguments', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      const t = useGT();
      const message = 'hello world';
      t(message);
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(0);
    expect(params.errors.length).toBeGreaterThan(0);
  });

  it('should add errors for useGT in async functions', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      async function test() {
        const t = useGT();
        t('hello world');
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(0);
    expect(params.errors.length).toBeGreaterThan(0);
  });

  it('should add errors for getGT in non-async functions', () => {
    const code = `
      import { getGT } from 'generaltranslation';
      function test() {
        const t = getGT();
        t('hello world');
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'getGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'getGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(0);
    expect(params.errors.length).toBeGreaterThan(0);
  });

  it('should handle translation callback passed to other functions', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      
      function getGreeting(t) {
        return t('hello world', { $id: 'greeting' });
      }
      
      const t = useGT();
      getGreeting(t);
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {
        id: 'greeting',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle arrow function with translation callback', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      
      const getGreeting = (t) => {
        return t('hello world', { $context: 'page' });
      };
      
      const t = useGT();
      getGreeting(t);
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {
        context: 'page',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle variable aliases for translation callbacks', () => {
    const code = `
      import { useGT } from 'gt-next';
      
      function test() {
        const translate = useGT();
        const t = translate;
        const a = t;
        const b = a;
        b('hello world', { $id: 'test' });
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {
        id: 'test',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle multiple metadata attributes', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      const t = useGT();
      t('hello world', { $id: 'greeting', $context: 'homepage' });
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {
        id: 'greeting',
        context: 'homepage',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should add errors for non-static metadata expressions', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      const t = useGT();
      const dynamicId = 'test';
      t(\`hello \${dynamicId} world\`, { id: dynamicId });
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(0);
    expect(params.errors.length).toBeGreaterThan(0);
  });

  it('should handle static metadata expressions correctly', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      const t = useGT();
      t('hello world', { id: 'static-id', context: 'static-context' });
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {},
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle deeply nested variable aliases', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      
      function test() {
        const translate = useGT();
        const t = translate;
        const a = t;
        const b = a;
        const c = b;
        c('hello world', { $id: 'deep-alias' });
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {
        id: 'deep-alias',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle aliases in different scopes', () => {
    // TODO: Should theoretically be 2 updates, but we don't support this yet
    const code = `
      import { useGT } from 'generaltranslation';
      
      function outer() {
        const translate = useGT();
        
        function inner() {
          const t = translate;
          t('inner scope', { $id: 'inner' });
        }
        
        translate('outer scope', { $id: 'outer' });
        inner();
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    // TODO: Should theoretically be 2 updates, but we don't support this yet
    expect(params.updates).toHaveLength(1);
    expect(params.updates).toEqual(
      expect.arrayContaining([
        {
          dataFormat: 'ICU',
          source: 'outer scope',
          metadata: {
            id: 'outer',
          },
        },
        // {
        //   dataFormat: 'ICU',
        //   source: 'inner scope',
        //   metadata: {
        //     id: 'inner',
        //   },
        // },
      ])
    );
    expect(params.errors).toHaveLength(0);
  });

  it('should handle mixed translation patterns in one function', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      
      function test() {
        const translate = useGT();
        const t = translate;
        
        // Direct call with original variable
        translate('direct call', { $id: 'direct' });
        
        // Call with alias
        t('aliased call', { $context: 'page' });
        
        // Template literal with alias
        t(\`template literal\`);
        
        // Multiple metadata
        t('multi meta', { $id: 'multi', $context: 'form' });
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(4);
    expect(params.updates).toEqual(
      expect.arrayContaining([
        {
          dataFormat: 'ICU',
          source: 'direct call',
          metadata: {
            id: 'direct',
          },
        },
        {
          dataFormat: 'ICU',
          source: 'aliased call',
          metadata: {
            context: 'page',
          },
        },
        {
          dataFormat: 'ICU',
          source: 'template literal',
          metadata: {},
        },
        {
          dataFormat: 'ICU',
          source: 'multi meta',
          metadata: {
            id: 'multi',
            context: 'form',
          },
        },
      ])
    );
    expect(params.errors).toHaveLength(0);
  });

  it('should handle aliases passed as function parameters', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      
      function helper(translator) {
        return translator('helper message', { $id: 'helper' });
      }
      
      function test() {
        const translate = useGT();
        const t = translate;
        
        // Pass original variable
        helper(translate);
        
        // Pass alias
        helper(t);
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(2);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'helper message',
      metadata: {
        id: 'helper',
      },
    });
    expect(params.updates[1]).toEqual({
      dataFormat: 'ICU',
      source: 'helper message',
      metadata: {
        id: 'helper',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle conditional assignment aliases', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      
      function test(condition) {
        const translate = useGT();
        const t = condition ? translate : null;
        
        if (t) {
          t('conditional message', { $id: 'conditional' });
        }
        
        // Direct usage should still work
        translate('direct usage', { $id: 'direct' });
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'direct usage',
      metadata: {
        id: 'direct',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle destructured assignment patterns', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      
      function test() {
        const translate = useGT();
        const { length } = 'test';
        const t = translate;
        
        t('destructured test', { $id: 'destructured' });
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'destructured test',
      metadata: {
        id: 'destructured',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle await with aliases', () => {
    const code = `
      import { getGT } from 'generaltranslation';
      
      async function test() {
        const translate = await getGT();
        const t = translate;
        const alias = t;
        
        translate('original call', { $id: 'original' });
        t('alias call', { $context: 'page' });
        alias('deep alias call', { $id: 'deep' });
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'getGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'getGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(3);
    expect(params.updates).toEqual(
      expect.arrayContaining([
        {
          dataFormat: 'ICU',
          source: 'original call',
          metadata: {
            id: 'original',
          },
        },
        {
          dataFormat: 'ICU',
          source: 'alias call',
          metadata: {
            context: 'page',
          },
        },
        {
          dataFormat: 'ICU',
          source: 'deep alias call',
          metadata: {
            id: 'deep',
          },
        },
      ])
    );
    expect(params.errors).toHaveLength(0);
  });

  it('should handle errors with aliases', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      
      function test() {
        const translate = useGT();
        const t = translate;
        const name = 'dynamic';
        
        // Error with alias - template literal with expressions
        t(\`hello \${name}\`);
        
        // Error with alias - non-string argument
        t(name);
        
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(0);
    expect(params.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should not create infinite loops with circular references', () => {
    const code = `
      import { useGT } from 'generaltranslation';
      
      function test() {
        const translate = useGT();
        let t = translate;
        let a = t;
        // This would create a circular reference if not handled properly
        t = a;
        
        t('circular test', { $id: 'circular' });
      }
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'useGT' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'useGT',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    // Should complete without hanging and find at least one translation
    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'circular test',
      metadata: {
        id: 'circular',
      },
    });
    expect(params.errors).toHaveLength(0);
  });

  // Additional tests for msg.encode() functionality
  it('should handle msg.encode() with template literals without expressions', () => {
    const code = `
      import { msg } from 'generaltranslation';
      msg.encode(\`hello world\`);
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'msg' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'msg',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'hello world',
      metadata: {},
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should add errors for msg.encode() with template literals with expressions', () => {
    const code = `
      import { msg } from 'generaltranslation';
      const name = 'world';
      msg.encode(\`hello \${name}\`);
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'msg' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'msg',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(0);
    expect(params.errors.length).toBeGreaterThan(0);
  });

  it('should add errors for msg.encode() with non-string arguments', () => {
    const code = `
      import { msg } from 'generaltranslation';
      const message = 'hello world';
      msg.encode(message);
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'msg' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'msg',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(0);
    expect(params.errors.length).toBeGreaterThan(0);
  });

  it('should handle multiple msg.encode() calls', () => {
    const code = `
      import { msg } from 'generaltranslation';
      msg.encode('hello');
      msg.encode('world');
      msg.encode('goodbye');
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'msg' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'msg',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(3);
    expect(params.updates).toEqual([
      { dataFormat: 'ICU', source: 'hello', metadata: {} },
      { dataFormat: 'ICU', source: 'world', metadata: {} },
      { dataFormat: 'ICU', source: 'goodbye', metadata: {} },
    ]);
    expect(params.errors).toHaveLength(0);
  });

  it('should handle msg.encode() calls with different import aliases', () => {
    const code = `
      import { msg as message } from 'generaltranslation';
      message.encode('aliased msg call');
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'msg' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'msg',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'aliased msg call',
      metadata: {},
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should not handle msg.decode() calls (only encode should work)', () => {
    const code = `
      import { msg } from 'generaltranslation';
      msg.decode('should not work');
      msg.encode('should work');
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'msg' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'msg',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates[0]).toEqual({
      dataFormat: 'ICU',
      source: 'should work',
      metadata: {},
    });
    expect(params.errors).toHaveLength(0);
  });

  it('should handle msg.encode() calls in different contexts', () => {
    const code = `
      import { msg } from 'generaltranslation';
      
      function test() {
        const result = msg.encode('function context');
        return result;
      }
      
      const arrow = () => msg.encode('arrow function');
      
      if (true) {
        msg.encode('conditional context');
      }
      
      const obj = {
        method() {
          msg.encode('object method');
        }
      };
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'msg' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'msg',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(4);
    expect(params.updates).toEqual([
      { dataFormat: 'ICU', source: 'function context', metadata: {} },
      { dataFormat: 'ICU', source: 'arrow function', metadata: {} },
      { dataFormat: 'ICU', source: 'conditional context', metadata: {} },
      { dataFormat: 'ICU', source: 'object method', metadata: {} },
    ]);
    expect(params.errors).toHaveLength(0);
  });

  it('should only handle msg.encode() calls', () => {
    const code = `
      import { msg } from 'generaltranslation';
      msg.encode('encode call');
    `;
    const ast = parseCode(code);
    const params = createMockParams();

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === 'msg' &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            'msg',
            path,
            params.updates,
            params.errors,
            params.file
          );
        }
      },
    });

    expect(params.updates).toHaveLength(1);
    expect(params.updates).toEqual([
      { dataFormat: 'ICU', source: 'encode call', metadata: {} },
    ]);
    expect(params.errors).toHaveLength(0);
  });
});
