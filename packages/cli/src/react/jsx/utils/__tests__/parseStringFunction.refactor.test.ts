/**
 * Comprehensive behavioral tests for parseStringFunction.ts
 * Run these tests BEFORE and AFTER refactoring to ensure no behavior changes
 *
 * Usage:
 * 1. Run tests before refactor: npm test parseStringFunction.refactor.test.ts
 * 2. Save the output/snapshots
 * 3. Perform refactor
 * 4. Run tests again and compare - they should pass identically
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'node:fs';
import { parseStrings, resolveVariableAliases, clearParsingCaches } from '../parseStringFunction.js';
import { resolveImportPath } from '../resolveImportPath.js';
import { Updates } from '../../../../types/index.js';
import { ParsingConfigOptions } from '../../../../types/parsing.js';

vi.mock('node:fs');
vi.mock('../resolveImportPath.js');

const mockFs = vi.mocked(fs);
const mockResolveImportPath = vi.mocked(resolveImportPath);

describe('parseStringFunction - Comprehensive Behavioral Tests', () => {
  const FILE_PATH = 'test.tsx';
  let updates: Updates;
  let errors: string[];
  let warnings: Set<string>;
  let parsingOptions: ParsingConfigOptions;

  beforeEach(() => {
    updates = [];
    errors = [];
    warnings = new Set();
    parsingOptions = { conditionNames: ['import', 'require'] };
    vi.clearAllMocks();
    clearParsingCaches();
  });

  describe('msg() Function Calls', () => {
    it('should extract simple msg() string literal', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';
        msg('hello world');
      `, 'msg');

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0]).toMatchObject({
        dataFormat: 'ICU',
        source: 'hello world',
        metadata: expect.objectContaining({ filePaths: [FILE_PATH] }),
      });
    });

    it('should extract msg() with template literal (no expressions)', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';
        msg(\`hello world\`);
      `, 'msg');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('hello world');
    });

    it('should error on msg() with template literal with expressions', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';
        const name = 'John';
        msg(\`hello \${name}\`);
      `, 'msg');

      expect(result.updates).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('non-string literal');
    });

    it('should error on msg() with non-string argument', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';
        const message = 'hello';
        msg(message);
      `, 'msg');

      expect(result.updates).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle multiple msg() calls', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';
        msg('first');
        msg('second');
        msg('third');
      `, 'msg');

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(3);
      expect(result.updates.map(u => u.source)).toEqual(['first', 'second', 'third']);
    });

    it('should handle msg() with metadata options', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';
        msg('hello', { $id: 'greeting', $context: 'page' });
      `, 'msg');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('hello');
      // msg() ignores additional metadata in message-only mode
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should handle msg() in various contexts', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';

        function test() {
          return msg('in function');
        }

        const arrow = () => msg('in arrow');

        const obj = {
          method() { msg('in method'); }
        };

        if (true) {
          msg('in conditional');
        }
      `, 'msg');

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(4);
    });
  });

  describe('useGT() Hook Calls', () => {
    it('should extract simple useGT() translation', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t('hello world');
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0]).toMatchObject({
        dataFormat: 'ICU',
        source: 'hello world',
      });
    });

    it('should extract useGT() with metadata', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t('greeting', { $id: 'hello', $context: 'homepage' });
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0]).toMatchObject({
        dataFormat: 'ICU',
        source: 'greeting',
        metadata: {
          id: 'hello',
          context: 'homepage',
        },
      });
    });

    it('should handle useGT() with $maxChars', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t('short text', { $maxChars: 100 });
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].metadata.maxChars).toBe(100);
    });

    it('should error on invalid $maxChars (string)', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t('text', { $maxChars: 'invalid' });
      `, 'useGT');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('maxChars');
    });

    it('should error on invalid $maxChars (boolean)', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t('text', { $maxChars: true });
      `, 'useGT');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('maxChars');
    });

    it('should handle $maxChars with negative values (converts to positive)', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t('text', { $maxChars: -50 });
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].metadata.maxChars).toBe(50);
    });

    it('should handle $maxChars with zero', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t('text', { $maxChars: 0 });
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].metadata.maxChars).toBe(0);
    });

    it('should error when useGT used in async function', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        async function test() {
          const t = useGT();
          t('hello');
        }
      `, 'useGT');

      expect(result.updates).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('async');
    });

    it('should handle useGT() with template literal (no expressions)', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t(\`hello world\`);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('hello world');
    });

    it('should error on useGT() with template literal with expressions', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        const name = 'John';
        t(\`hello \${name}\`);
      `, 'useGT');

      expect(result.updates).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should error on useGT() with non-string argument', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        const msg = 'hello';
        t(msg);
      `, 'useGT');

      expect(result.updates).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should error on non-static metadata', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        const dynamicId = 'test';
        t('hello', { $id: dynamicId });
      `, 'useGT');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('non-static');
    });
  });

  describe('getGT() Async Hook Calls', () => {
    it('should extract simple getGT() translation in async function', () => {
      const result = parseCode(`
        import { getGT } from 'generaltranslation';
        async function test() {
          const t = await getGT();
          t('hello world');
        }
      `, 'getGT');

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toBe('hello world');
    });

    it('should not extract when getGT used in non-async function', () => {
      const result = parseCode(`
        import { getGT } from 'generaltranslation';
        function test() {
          const t = getGT();
          t('hello');
        }
      `, 'getGT');

      // May not extract or may produce errors, but behavior is captured
      expect(result.updates).toEqual([]);
      // Verify the actual behavior - either errors or just no extraction
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should handle getGT() with all metadata types', () => {
      const result = parseCode(`
        import { getGT } from 'generaltranslation';
        async function test() {
          const t = await getGT();
          t('text', { $id: 'test', $context: 'page', $maxChars: 50 });
        }
      `, 'getGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].metadata).toMatchObject({
        id: 'test',
        context: 'page',
        maxChars: 50,
      });
    });
  });

  describe('useMessages() and getMessages() Hooks', () => {
    it('should extract useMessages() string literal', () => {
      const result = parseCode(`
        import { useMessages } from 'generaltranslation';
        const m = useMessages();
        m('hello world');
      `, 'useMessages');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('hello world');
      // Should ignore metadata
      expect(result.updates[0].metadata).toMatchObject({ filePaths: [FILE_PATH] });
    });

    it('should NOT error on useMessages() with dynamic content (msg() may be passed)', () => {
      const result = parseCode(`
        import { useMessages } from 'generaltranslation';
        const m = useMessages();
        const text = 'hello';
        m(text);
      `, 'useMessages');

      expect(result.updates).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should extract getMessages() in async function', () => {
      const result = parseCode(`
        import { getMessages } from 'generaltranslation';
        async function test() {
          const m = await getMessages();
          m('hello world');
        }
      `, 'getMessages');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('hello world');
    });

    it('should error when useMessages used in async function', () => {
      const result = parseCode(`
        import { useMessages } from 'generaltranslation';
        async function test() {
          const m = useMessages();
          m('hello');
        }
      `, 'useMessages');

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should error when getMessages used in non-async function', () => {
      const result = parseCode(`
        import { getMessages } from 'generaltranslation';
        function test() {
          const m = getMessages();
          m('hello');
        }
      `, 'getMessages');

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Variable Aliases', () => {
    it('should resolve simple alias', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const translate = useGT();
        const t = translate;
        t('hello');
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toBe('hello');
    });

    it('should resolve chained aliases', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const translate = useGT();
        const t = translate;
        const a = t;
        const b = a;
        b('hello');
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('hello');
    });

    it('should handle deeply nested aliases', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t0 = useGT();
        const t1 = t0;
        const t2 = t1;
        const t3 = t2;
        const t4 = t3;
        t4('deep alias');
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('deep alias');
    });

    it('should handle aliases with multiple usages', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const translate = useGT();
        const t = translate;

        translate('first');
        t('second');
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(2);
      expect(result.updates[0].source).toBe('first');
      expect(result.updates[1].source).toBe('second');
    });

    it('should not create infinite loops with circular references', () => {
      const code = `
        import { useGT } from 'generaltranslation';
        let translate = useGT();
        let t = translate;
        let a = t;
        t = a; // Circular reference
        t('test');
      `;

      // This should not hang
      const result = parseCode(code, 'useGT');

      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toBe('test');
    });

    it('should handle aliases passed as function parameters', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';

        function helper(translator) {
          return translator('helper message');
        }

        const translate = useGT();
        const t = translate;

        helper(translate);
        helper(t);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(2);
      expect(result.updates[0].source).toBe('helper message');
      expect(result.updates[1].source).toBe('helper message');
    });
  });

  describe('Prop Drilling (Translation Callback Passing)', () => {
    it('should handle translation callback passed to function declaration', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';

        function getGreeting(t) {
          return t('hello');
        }

        const t = useGT();
        getGreeting(t);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('hello');
    });

    it('should handle translation callback passed to arrow function', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';

        const getGreeting = (t) => t('hello');

        const t = useGT();
        getGreeting(t);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('hello');
    });

    it('should handle nested function calls', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';

        function inner(t) {
          return t('inner');
        }

        function outer(translate) {
          return inner(translate);
        }

        const t = useGT();
        outer(t);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('inner');
    });

    it('should handle translation callback with different parameter positions', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';

        function withParams(a, b, t, c) {
          return t('third param');
        }

        const t = useGT();
        withParams(1, 2, t, 3);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('third param');
    });

    it('should handle translation callback with default parameters', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';

        function withDefault(t = () => {}) {
          return t('default param');
        }

        const t = useGT();
        withDefault(t);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('default param');
    });

    it('should resolve aliases within helper functions', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';

        function helper(translator) {
          const t = translator;
          const a = t;
          return a('aliased in helper');
        }

        const translate = useGT();
        helper(translate);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('aliased in helper');
    });
  });

  describe('Cross-File Function Resolution', () => {
    beforeEach(() => {
      mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path === '/test/utils.ts') {
          return `
            export function getGreeting(t) {
              return t('hello from utils');
            }
          `;
        }
        if (path === '/test/nested.ts') {
          return `
            import { helper } from './utils';
            export function nested(t) {
              return helper(t);
            }
          `;
        }
        throw new Error(`File not found: ${path}`);
      });

      mockResolveImportPath.mockImplementation((_file: string, importPath: string) => {
        if (importPath === './utils') return '/test/utils.ts';
        if (importPath === './nested') return '/test/nested.ts';
        return null;
      });
    });

    it('should resolve imported function', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        import { getGreeting } from './utils';

        const t = useGT();
        getGreeting(t);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('hello from utils');
    });

    it('should cache cross-file resolutions', () => {
      const result1 = parseCode(`
        import { useGT } from 'generaltranslation';
        import { getGreeting } from './utils';

        const t = useGT();
        getGreeting(t);
        getGreeting(t);
      `, 'useGT');

      // Should extract translations successfully
      expect(result1.updates.length).toBeGreaterThanOrEqual(1);
      expect(result1.updates[0].source).toBe('hello from utils');

      // File should only be read once due to caching
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should handle re-exports', () => {
      mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path === '/test/reexport.ts') {
          return `export * from './utils';`;
        }
        if (path === '/test/utils.ts') {
          return `
            export function getGreeting(t) {
              return t('reexported');
            }
          `;
        }
        throw new Error(`File not found: ${path}`);
      });

      mockResolveImportPath.mockImplementation((_file: string, importPath: string) => {
        if (importPath === './reexport') return '/test/reexport.ts';
        if (importPath === './utils') return '/test/utils.ts';
        return null;
      });

      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        import { getGreeting } from './reexport';

        const t = useGT();
        getGreeting(t);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('reexported');
    });

    it('should handle named re-exports', () => {
      mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path === '/test/reexport.ts') {
          return `export { original as renamed } from './utils';`;
        }
        if (path === '/test/utils.ts') {
          return `
            export function original(t) {
              return t('renamed export');
            }
          `;
        }
        throw new Error(`File not found: ${path}`);
      });

      mockResolveImportPath.mockImplementation((_file: string, importPath: string) => {
        if (importPath === './reexport') return '/test/reexport.ts';
        if (importPath === './utils') return '/test/utils.ts';
        return null;
      });

      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        import { renamed } from './reexport';

        const t = useGT();
        renamed(t);
      `, 'useGT');

      expect(result.errors).toEqual([]);
      // Should follow the re-export chain
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should handle circular imports gracefully', () => {
      mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path === '/test/a.ts') {
          return `
            import { funcB } from './b';
            export function funcA(t) {
              return t('from A');
            }
          `;
        }
        if (path === '/test/b.ts') {
          return `
            import { funcA } from './a';
            export function funcB(t) {
              return t('from B');
            }
          `;
        }
        throw new Error(`File not found: ${path}`);
      });

      mockResolveImportPath.mockImplementation((_file: string, importPath: string) => {
        if (importPath === './a') return '/test/a.ts';
        if (importPath === './b') return '/test/b.ts';
        return null;
      });

      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        import { funcA } from './a';

        const t = useGT();
        funcA(t);
      `, 'useGT');

      // Should not hang on circular imports
      expect(result.updates.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle file read errors gracefully', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        import { unknown } from './missing';

        const t = useGT();
        unknown(t);
      `, 'useGT');

      // Should not crash, just skip the unknown function
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('resolveVariableAliases - Unit Tests', () => {
    it('should resolve single alias', () => {
      const code = `
        const a = b;
      `;
      const ast = parse(code, { sourceType: 'module' });
      let scope: any;

      traverse(ast, {
        Program(path) {
          scope = path.scope;
        },
      });

      const aliases = resolveVariableAliases(scope, 'a');
      expect(aliases).toContain('a');
    });

    it('should resolve chain of aliases', () => {
      const code = `
        const translate = useGT();
        const t = translate;
        const a = t;
      `;
      const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
      let scope: any;

      traverse(ast, {
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id) && path.node.id.name === 'translate') {
            scope = path.scope;
          }
        },
      });

      if (scope) {
        const aliases = resolveVariableAliases(scope, 'translate');
        expect(aliases).toContain('translate');
        expect(aliases).toContain('t');
        expect(aliases).toContain('a');
      }
    });

    it('should handle circular references without infinite loop', () => {
      const code = `
        let a = b;
        let b = a;
      `;
      const ast = parse(code, { sourceType: 'module' });
      let scope: any;

      traverse(ast, {
        Program(path) {
          scope = path.scope;
        },
      });

      // Should not hang
      const aliases = resolveVariableAliases(scope, 'a');
      expect(Array.isArray(aliases)).toBe(true);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long strings', () => {
      const longString = 'A'.repeat(10000);
      const result = parseCode(`
        import { msg } from 'gt-next';
        msg('${longString}');
      `, 'msg');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe(longString);
    });

    it('should handle special characters', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';
        msg('Test & < > \\' " \`');
      `, 'msg');

      expect(result.errors).toEqual([]);
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should handle unicode characters', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';
        msg('こんにちは 👋 مرحبا');
      `, 'msg');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('こんにちは 👋 مرحبا');
    });

    it('should handle ICU message format', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t('Hello {name}, you have {count, plural, one {# message} other {# messages}}');
      `, 'useGT');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toContain('{name}');
      expect(result.updates[0].source).toContain('{count, plural,');
    });

    it('should handle empty strings', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';
        msg('');
      `, 'msg');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('');
    });

    it('should handle strings with only whitespace', () => {
      const result = parseCode(`
        import { msg } from 'gt-next';
        msg('   ');
      `, 'msg');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('   ');
    });

    it('should handle multiple translation functions in one scope', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';

        function outer() {
          const t1 = useGT();
          t1('first');

          function inner() {
            const t2 = useGT();
            t2('second');
          }

          inner();
        }
      `, 'useGT');

      // Exact behavior may vary, capture as snapshot
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });
  });

  describe('Output Format Consistency', () => {
    it('should maintain consistent metadata structure', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t('test', { $id: 'id1', $context: 'ctx1' });
        t('test2', { $id: 'id2' });
        t('test3');
      `, 'useGT');

      expect(result.updates).toHaveLength(3);

      // All should have consistent structure
      result.updates.forEach(update => {
        expect(update).toHaveProperty('dataFormat');
        expect(update).toHaveProperty('source');
        expect(update).toHaveProperty('metadata');
        expect(update.dataFormat).toBe('ICU');
      });

      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should maintain filePaths in metadata', () => {
      const result = parseCode(`
        import { useGT } from 'generaltranslation';
        const t = useGT();
        t('test');
      `, 'useGT');

      expect(result.updates[0].metadata.filePaths).toBeDefined();
      expect(Array.isArray(result.updates[0].metadata.filePaths)).toBe(true);
      expect(result.updates[0].metadata.filePaths).toContain(FILE_PATH);
    });
  });

  // Helper function to parse code and extract results
  function parseCode(code: string, hookName: string) {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      ImportSpecifier(path) {
        if (
          t.isIdentifier(path.node.imported) &&
          path.node.imported.name === hookName &&
          t.isIdentifier(path.node.local)
        ) {
          parseStrings(
            path.node.local.name,
            hookName,
            path,
            {
              parsingOptions,
              file: FILE_PATH,
              ignoreAdditionalData: false,
              ignoreDynamicContent: false,
              ignoreInvalidIcu: false,
            },
            { updates, errors, warnings }
          );
        }
      },
    });

    return { updates, errors, warnings };
  }
});
