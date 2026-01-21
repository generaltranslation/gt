/**
 * Comprehensive behavioral tests for parseJsx.ts
 * Run these tests BEFORE and AFTER refactoring to ensure no behavior changes
 *
 * Usage:
 * 1. Run tests before refactor: npm test parseJsx.refactor.test.ts
 * 2. Save the output/snapshots
 * 3. Perform refactor
 * 4. Run tests again and compare - they should pass identically
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'node:fs';
import { parseTranslationComponent } from '../parseJsx.js';
import { resolveImportPath } from '../../resolveImportPath.js';
import { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { Updates } from '../../../../../types/index.js';
import { hashSource } from 'generaltranslation/id';

vi.mock('node:fs');
vi.mock('../../resolveImportPath.js');

const mockFs = vi.mocked(fs);
const mockResolveImportPath = vi.mocked(resolveImportPath);

describe('parseJsx - Comprehensive Behavioral Tests', () => {
  let updates: Updates;
  let errors: string[];
  let warnings: Set<string>;
  let parsingOptions: ParsingConfigOptions;

  beforeEach(() => {
    updates = [];
    errors = [];
    warnings = new Set();
    parsingOptions = {
      conditionNames: ['import', 'require'],
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic JSX Element Parsing', () => {
    it('should parse simple text content', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Hello World</T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].dataFormat).toBe('JSX');
      expect(result.updates[0].source).toEqual('Hello World');
    });

    it('should parse text with leading/trailing whitespace correctly', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>  Hello World  </T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      // Check exact whitespace handling
      expect(JSON.stringify(result.updates[0].source)).toBe(JSON.stringify('  Hello World  '));
    });

    it('should parse JSX with nested elements', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Hello <b>World</b></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(Array.isArray(result.updates[0].source)).toBe(true);
      expect(result.updates[0].source).toMatchObject([
        'Hello ',
        { t: 'b', i: expect.any(Number), c: 'World' }
      ]);
    });

    it('should handle empty T components', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      // Verify exact behavior with empty components
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should handle self-closing T components', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T />;
        }
      `;

      const result = parseComponent(code);

      // Verify exact behavior with self-closing
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });
  });

  describe('Static Component Behavior', () => {
    it('should handle Static with simple string literal', () => {
      const code = `
        import { T, Static } from "gt-next";
        export default function Page() {
          return <T>Message: <Static>{"hello"}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toMatchObject([
        'Message: ',
        { t: 'Static', i: 1, c: 'hello' }
      ]);
    });

    it('should handle Static with numeric literal', () => {
      const code = `
        import { T, Static } from "gt-next";
        export default function Page() {
          return <T>Count: <Static>{42}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toMatchObject([
        'Count: ',
        { t: 'Static', i: 1, c: '42' }
      ]);
    });

    it('should handle Static with boolean literal', () => {
      const code = `
        import { T, Static } from "gt-next";
        export default function Page() {
          return <T>Value: <Static>{true}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].dataFormat).toBe('JSX');
      // Boolean true is kept as boolean
      expect(result.updates[0].source).toMatchObject([
        'Value: ',
        { t: 'Static', i: 1, c: true }
      ]);
    });

    it('should handle Static with null', () => {
      const code = `
        import { T, Static } from "gt-next";
        export default function Page() {
          return <T>Value: <Static>{null}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].dataFormat).toBe('JSX');
      // Null doesn't have a 'c' property
      expect(result.updates[0].source).toEqual([
        'Value: ',
        { t: 'Static', i: 1 }
      ]);
    });

    it('should handle Static with negative numbers', () => {
      const code = `
        import { T, Static } from "gt-next";
        export default function Page() {
          return <T>Temp: <Static>{-5}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toMatchObject([
        'Temp: ',
        { t: 'Static', i: 1, c: '-5' }
      ]);
    });

    it('should handle Static with ternary expressions', () => {
      const code = `
        import { T, Static } from "gt-next";
        export default function Page() {
          return <T>Message: <Static>{1 ? "yes" : "no"}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(2); // Should create 2 branches
      expect(result.updates[0].source).toMatchObject([
        'Message: ',
        { t: 'Static', i: 1, c: 'yes' }
      ]);
      expect(result.updates[1].source).toMatchObject([
        'Message: ',
        { t: 'Static', i: 1, c: 'no' }
      ]);
    });

    it('should handle nested ternary expressions in Static', () => {
      const code = `
        import { T, Static } from "gt-next";
        export default function Page() {
          return <T>Value: <Static>{1 ? (2 ? "a" : "b") : (3 ? "c" : "d")}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(4); // Should create 4 branches
      const contents = result.updates.map(u => (u.source[1] as any).c);
      expect(contents).toContain('a');
      expect(contents).toContain('b');
      expect(contents).toContain('c');
      expect(contents).toContain('d');
    });
  });

  describe('Variable Components (Var, Num, Plural, Branch)', () => {
    it('should handle Var component', () => {
      const code = `
        import { T, Var } from "gt-next";
        export default function Page() {
          return <T>Hello <Var name="userName" /></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(1);
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should handle Num component', () => {
      const code = `
        import { T, Num } from "gt-next";
        export default function Page() {
          return <T>Price: <Num value={price} /></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should handle Plural component with all forms', () => {
      const code = `
        import { T, Plural } from "gt-next";
        export default function Page() {
          return (
            <T>
              You have <Plural
                n={count}
                one="one item"
                other="many items"
              />
            </T>
          );
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should handle Branch component', () => {
      const code = `
        import { T, Branch } from "gt-next";
        export default function Page() {
          return (
            <T>
              <Branch branch={gender} male="He" female="She" other="They" /> arrived
            </T>
          );
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });
  });

  describe('Metadata Handling', () => {
    it('should extract id prop', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T id="greeting">Hello</T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates[0].metadata.id).toBe('greeting');
    });

    it('should extract context prop', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T context="homepage">Welcome</T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates[0].metadata.context).toBe('homepage');
    });

    it('should extract multiple metadata props', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T id="welcome" context="homepage">Welcome</T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates[0].metadata.id).toBe('welcome');
      expect(result.updates[0].metadata.context).toBe('homepage');
    });

    it('should include filePaths in metadata', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Test</T>;
        }
      `;

      const result = parseComponent(code, '/test/file.tsx');

      expect(result.errors).toEqual([]);
      expect(result.updates[0].metadata.filePaths).toBeDefined();
      expect(Array.isArray(result.updates[0].metadata.filePaths)).toBe(true);
    });

    it('should set staticId for Static components', () => {
      const code = `
        import { T, Static } from "gt-next";
        export default function Page() {
          return <T><Static>{"test"}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates[0].metadata.staticId).toBeDefined();
      expect(typeof result.updates[0].metadata.staticId).toBe('string');
    });
  });

  describe('Error and Warning Generation', () => {
    it('should error on unwrapped expressions', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          const name = "John";
          return <T>Hello {name}</T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('children that could change at runtime');
    });

    it('should handle nested T components', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Outer <T>Inner</T></T>;
        }
      `;

      const result = parseComponent(code);

      // Nested T components are processed - capture exact behavior
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should error on recursive function calls in Static', () => {
      mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path === '/test/utils.ts') {
          return `
            export function recursive() {
              return recursive();
            }
          `;
        }
        throw new Error(`File not found: ${path}`);
      });

      mockResolveImportPath.mockImplementation((_file: string, importPath: string) => {
        if (importPath === './utils') return '/test/utils.ts';
        return null;
      });

      const code = `
        import { T, Static } from "gt-next";
        import { recursive } from "./utils";
        export default function Page() {
          return <T><Static>{recursive()}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Recursive'))).toBe(true);
    });

    it('should warn when function not found in Static', () => {
      const code = `
        import { T, Static } from "gt-next";
        export default function Page() {
          return <T><Static>{unknownFunc()}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.warnings.size).toBeGreaterThan(0);
      expect(Array.from(result.warnings).some(w => w.includes('definition could not be resolved'))).toBe(true);
    });
  });

  describe('Hash Consistency', () => {
    it('should produce consistent hashes for identical content', () => {
      const code1 = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Hello World</T>;
        }
      `;

      const code2 = `
        import { T } from "gt-next";
        export default function Other() {
          return <T>Hello World</T>;
        }
      `;

      const result1 = parseComponent(code1);
      const result2 = parseComponent(code2);

      const hash1 = hashSource({
        source: result1.updates[0].source,
        dataFormat: result1.updates[0].dataFormat,
      });

      const hash2 = hashSource({
        source: result2.updates[0].source,
        dataFormat: result2.updates[0].dataFormat,
      });

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const code1 = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Hello World</T>;
        }
      `;

      const result1 = parseComponent(code1);

      const hash1 = hashSource({
        source: result1.updates[0].source,
        dataFormat: result1.updates[0].dataFormat,
      });

      // Clear state before second parse to avoid accumulation
      updates = [];
      errors = [];
      warnings = new Set();

      const code2 = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Goodbye World</T>;
        }
      `;

      const result2 = parseComponent(code2);

      const hash2 = hashSource({
        source: result2.updates[0].source,
        dataFormat: result2.updates[0].dataFormat,
      });

      expect(hash1).not.toBe(hash2);
    });

    it('should maintain hash consistency with Static multiplication', () => {
      const code = `
        import { T, Static } from "gt-next";
        export default function Page() {
          return <T>test <Static>{1 ? "a" : "b"}</Static></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.updates).toHaveLength(2);

      const hashes = result.updates.map(u =>
        hashSource({ source: u.source, dataFormat: u.dataFormat })
      );

      // Should produce stable, unique hashes
      expect(hashes[0]).not.toBe(hashes[1]);
      expect(hashes[0]).toHaveLength(16); // Hash should be 16 chars
      expect(hashes[1]).toHaveLength(16);
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle multiple T components in one file', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return (
            <>
              <T>First</T>
              <T>Second</T>
              <T>Third</T>
            </>
          );
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(3);
      expect(result.updates[0].source).toBe('First');
      expect(result.updates[1].source).toBe('Second');
      expect(result.updates[2].source).toBe('Third');
    });

    it('should handle T with mixed content types', () => {
      const code = `
        import { T, Var, Static } from "gt-next";
        export default function Page() {
          return (
            <T>
              Hello <Var name="user" />, you have <Static>{1 ? "5" : "10"}</Static> messages
            </T>
          );
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates).toHaveLength(2); // Due to Static multiplication

      // Verify both updates have correct structure
      expect(result.updates[0].dataFormat).toBe('JSX');
      expect(result.updates[1].dataFormat).toBe('JSX');

      // Check that both variations are present (5 and 10)
      const staticValues = result.updates.map(u => {
        const staticComponent = u.source.find((item: any) => typeof item === 'object' && item.t === 'Static');
        return staticComponent?.c;
      });

      expect(staticValues).toContain('5');
      expect(staticValues).toContain('10');

      // Verify structure contains both text and components
      result.updates.forEach(update => {
        expect(Array.isArray(update.source)).toBe(true);
        expect(update.source.length).toBeGreaterThan(3); // Has text + components

        // Should have some string parts and some object parts
        const hasStrings = update.source.some((item: any) => typeof item === 'string');
        const hasObjects = update.source.some((item: any) => typeof item === 'object');
        expect(hasStrings).toBe(true);
        expect(hasObjects).toBe(true);
      });
    });

    it('should handle deeply nested JSX structures', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return (
            <T>
              <div>
                <span>
                  <b>Nested</b> content
                </span>
              </div>
            </T>
          );
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long text content', () => {
      const longText = 'A'.repeat(10000);
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>${longText}</T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe(longText);
    });

    it('should handle special characters in content', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>{"Test & < > ' \\" \` "}</T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should handle unicode characters', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>こんにちは 👋 مرحبا</T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      expect(result.updates[0].source).toBe('こんにちは 👋 مرحبا');
    });

    it('should handle JSX fragments', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T><>Fragment content</></T>;
        }
      `;

      const result = parseComponent(code);

      expect(result.errors).toEqual([]);
      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });

    it('should handle T with no children but props', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T id="test"></T>;
        }
      `;

      const result = parseComponent(code);

      const snapshot = JSON.stringify(result, null, 2);
      expect(snapshot).toMatchSnapshot();
    });
  });

  // Helper function to parse and extract results
  function parseComponent(code: string, file: string = '/test/page.tsx') {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let tLocalName = '';
    const importAliases: Record<string, string> = {};

    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'gt-next') {
          path.node.specifiers.forEach((spec) => {
            if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported)) {
              tLocalName = spec.imported.name === 'T' ? spec.local.name : tLocalName;
              importAliases[spec.local.name] = spec.imported.name;
            }
          });
        }
      },
    });

    traverse(ast, {
      Program(programPath) {
        const tBinding = programPath.scope.getBinding(tLocalName);
        if (tBinding) {
          parseTranslationComponent({
            originalName: 'T',
            localName: tLocalName,
            path: tBinding.path,
            updates,
            config: {
              importAliases,
              parsingOptions,
              pkgs: ['gt-next'],
              file,
            },
            output: {
              errors,
              warnings,
              unwrappedExpressions: [],
            },
          });
        }
      },
    });

    return { updates, errors, warnings };
  }
});
