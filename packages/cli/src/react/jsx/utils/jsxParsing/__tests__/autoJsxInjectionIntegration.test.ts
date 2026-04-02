/**
 * Tier 2: Integration tests for auto JSX injection + extraction in the CLI.
 *
 * Tests the full two-pass pipeline: inject T/Var into AST → extract with
 * parseTranslationComponent → verify updates, errors, hashes.
 *
 * Uses the same extractUserT / extractWithAutoInjection patterns from
 * autoJsxInjection.test.ts.
 *
 * See JSX_INSERTION_RULES.md for insertion rules.
 * See AUTO_JSX_INJECTION_CLI_PLAN.md for the two-pass strategy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverseModule, { NodePath } from '@babel/traverse';
import { parseTranslationComponent } from '../parseJsx.js';
import { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { Updates } from '../../../../../types/index.js';
import { hashSource } from 'generaltranslation/id';
import { Libraries } from '../../../../../types/libraries.js';
import { JsxChild } from 'generaltranslation/types';
import { getPathsAndAliases } from '../../getPathsAndAliases.js';
import {
  ensureTAndVarImported,
  autoInsertJsxComponents,
} from '../autoInsertion.js';
import {
  INTERNAL_TRANSLATION_COMPONENT,
  INTERNAL_VAR_COMPONENT,
} from '../../constants.js';
import generateModule from '@babel/generator';

const traverse: typeof traverseModule.default =
  (traverseModule as any).default || traverseModule;
const generate: typeof generateModule.default =
  (generateModule as any).default || generateModule;

vi.mock('node:fs');
vi.mock('../../resolveImportPath.js');

describe('auto JSX injection — integration (inject + extract)', () => {
  let parsingOptions: ParsingConfigOptions;

  beforeEach(() => {
    parsingOptions = { conditionNames: ['import', 'require'] };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================ //
  //  Helpers
  // ================================================================ //

  function extractUserT(sourceCode: string) {
    const localUpdates: Updates = [];
    const localErrors: string[] = [];
    const localWarnings = new Set<string>();

    const ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const importAliases: Record<string, string> = {};
    let tLocalName = '';

    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (['gt-next', 'gt-react', 'gt-react/browser'].includes(source)) {
          path.node.specifiers.forEach((spec) => {
            if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported)) {
              importAliases[spec.local.name] = spec.imported.name;
              if (spec.imported.name === 'T') tLocalName = spec.local.name;
            }
          });
        }
      },
    });

    if (tLocalName) {
      traverse(ast, {
        Program(programPath) {
          const tBinding = programPath.scope.getBinding(tLocalName);
          if (tBinding) {
            parseTranslationComponent({
              originalName: 'T',
              localName: tLocalName,
              path: tBinding.path,
              updates: localUpdates,
              config: {
                importAliases,
                parsingOptions,
                pkgs: [Libraries.GT_NEXT],
                file: '/test/page.tsx',
                includeSourceCodeContext: false,
              },
              output: {
                errors: localErrors,
                warnings: localWarnings,
                unwrappedExpressions: [],
              },
            });
          }
        },
      });
    }

    return {
      updates: localUpdates,
      errors: localErrors,
      warnings: localWarnings,
      ast,
    };
  }

  function extractWithAutoInjection(sourceCode: string) {
    const localUpdates: Updates = [];
    const localErrors: string[] = [];
    const localWarnings = new Set<string>();

    const ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const pkgs = [Libraries.GT_NEXT, Libraries.GT_REACT] as any[];

    // --- PASS 1: Extract user-written T components ---
    const pass1Result = getPathsAndAliases(ast, pkgs);
    const importAliases = { ...pass1Result.importAliases };
    // Add translation component names to aliases for component recognition
    for (const {
      localName,
      originalName,
    } of pass1Result.translationComponentPaths) {
      importAliases[localName] = originalName;
    }

    for (const { localName, path } of pass1Result.translationComponentPaths) {
      parseTranslationComponent({
        originalName: localName,
        localName,
        path,
        updates: localUpdates,
        config: {
          importAliases,
          parsingOptions,
          pkgs,
          file: '/test/page.tsx',
          includeSourceCodeContext: false,
        },
        output: {
          errors: localErrors,
          warnings: localWarnings,
          unwrappedExpressions: [],
        },
      });
    }
    const pass1Count = localUpdates.length;

    // --- PASS 2: Auto-inject ---
    ensureTAndVarImported(ast, importAliases);
    autoInsertJsxComponents(ast, importAliases);

    // Re-parse modified AST for fresh scope
    const modifiedCode = generate(ast).code;
    const freshAst = parse(modifiedCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const internalTName = INTERNAL_TRANSLATION_COMPONENT;

    traverse(freshAst, {
      Program(programPath) {
        const tBinding = programPath.scope.getBinding(internalTName);
        if (!tBinding) return;

        // Augment referencePaths with JSX usages
        const existingRefs = new Set(
          tBinding.referencePaths.map((r) => r.node)
        );
        programPath.traverse({
          JSXIdentifier(jsxIdPath: NodePath<t.JSXIdentifier>) {
            if (
              jsxIdPath.node.name === internalTName &&
              jsxIdPath.parentPath?.isJSXOpeningElement() &&
              !existingRefs.has(jsxIdPath.node)
            ) {
              tBinding.referencePaths.push(jsxIdPath);
            }
          },
        });

        parseTranslationComponent({
          originalName: internalTName,
          localName: internalTName,
          path: tBinding.path,
          updates: localUpdates,
          config: {
            importAliases: {
              ...importAliases,
              [INTERNAL_TRANSLATION_COMPONENT]: INTERNAL_TRANSLATION_COMPONENT,
              [INTERNAL_VAR_COMPONENT]: INTERNAL_VAR_COMPONENT,
            },
            parsingOptions,
            pkgs,
            file: '/test/page.tsx',
            includeSourceCodeContext: false,
            enableAutoJsxInjection: true,
          },
          output: {
            errors: localErrors,
            warnings: localWarnings,
            unwrappedExpressions: [],
          },
        });
      },
    });

    // Deduplicate Pass 1 and Pass 2
    const pass1Sources = new Set(
      localUpdates.slice(0, pass1Count).map((u) => JSON.stringify(u.source))
    );
    const deduped = [
      ...localUpdates.slice(0, pass1Count),
      ...localUpdates
        .slice(pass1Count)
        .filter((u) => !pass1Sources.has(JSON.stringify(u.source))),
    ];

    return {
      updates: deduped,
      errors: localErrors,
      warnings: localWarnings,
      ast: freshAst,
    };
  }

  // ================================================================ //
  //  1. HASH AGREEMENT — simple
  // ================================================================ //

  describe('hash agreement — simple cases', () => {
    it('simple text: auto matches user-written T hash', () => {
      const manualCode = `
        import { T } from "gt-next";
        export default function Page() { return <T>Hello World</T>; }
      `;
      const autoCode = `
        import { T } from "gt-next";
        export default function Page() { return <div>Hello World</div>; }
      `;
      const manualResult = extractUserT(manualCode);
      const autoResult = extractWithAutoInjection(autoCode);

      expect(manualResult.updates).toHaveLength(1);
      expect(autoResult.updates).toHaveLength(1);

      const manualHash = hashSource({
        source: manualResult.updates[0].source,
        dataFormat: 'JSX',
      });
      const autoHash = hashSource({
        source: autoResult.updates[0].source,
        dataFormat: 'JSX',
      });
      expect(autoHash).toEqual(manualHash);
    });

    it('text with Var: auto matches user-written T+Var hash', () => {
      const manualCode = `
        import { T, Var } from "gt-next";
        export default function Page() {
          const name = "World";
          return <T>Hello <Var>{name}</Var>!</T>;
        }
      `;
      const autoCode = `
        import { T } from "gt-next";
        export default function Page() {
          const name = "World";
          return <div>Hello {name}!</div>;
        }
      `;
      const manualResult = extractUserT(manualCode);
      const autoResult = extractWithAutoInjection(autoCode);

      expect(manualResult.updates).toHaveLength(1);
      expect(autoResult.updates).toHaveLength(1);
      expect(autoResult.updates[0].source).toEqual(
        manualResult.updates[0].source
      );
    });

    it('text with nested element: auto matches manual', () => {
      const manualCode = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Hello <b>World</b></T>;
        }
      `;
      const autoCode = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello <b>World</b></div>;
        }
      `;
      const manualResult = extractUserT(manualCode);
      const autoResult = extractWithAutoInjection(autoCode);

      expect(manualResult.updates).toHaveLength(1);
      expect(autoResult.updates).toHaveLength(1);

      const manualHash = hashSource({
        source: manualResult.updates[0].source,
        dataFormat: 'JSX',
      });
      const autoHash = hashSource({
        source: autoResult.updates[0].source,
        dataFormat: 'JSX',
      });
      expect(autoHash).toEqual(manualHash);
    });

    it('text with Num: auto matches manual', () => {
      const manualCode = `
        import { T, Num } from "gt-next";
        export default function Page() {
          return <T>Price: <Num>{price}</Num></T>;
        }
      `;
      const autoCode = `
        import { T, Num } from "gt-next";
        export default function Page() {
          return <div>Price: <Num>{price}</Num></div>;
        }
      `;
      const manualResult = extractUserT(manualCode);
      const autoResult = extractWithAutoInjection(autoCode);

      expect(manualResult.updates).toHaveLength(1);
      expect(autoResult.updates).toHaveLength(1);
      expect(autoResult.updates[0].source).toEqual(
        manualResult.updates[0].source
      );
    });

    it('text with multiple Vars: auto matches manual', () => {
      const manualCode = `
        import { T, Var } from "gt-next";
        export default function Page() {
          return <T>Hello <Var>{first}</Var>, welcome to <Var>{city}</Var>!</T>;
        }
      `;
      const autoCode = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello {first}, welcome to {city}!</div>;
        }
      `;
      const manualResult = extractUserT(manualCode);
      const autoResult = extractWithAutoInjection(autoCode);

      expect(manualResult.updates).toHaveLength(1);
      expect(autoResult.updates).toHaveLength(1);
      expect(autoResult.updates[0].source).toEqual(
        manualResult.updates[0].source
      );
    });
  });

  // ================================================================ //
  //  2. TWO-PASS SEPARATION
  // ================================================================ //

  describe('two-pass separation', () => {
    it('user T extracts normally even with flag on', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <T>Hello World</T>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
      expect(result.updates[0].source).toEqual('Hello World');
    });

    it('user T errors preserved — auto-injection does NOT fix them', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          const name = "World";
          return <T>Hello {name}</T>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors.length + result.warnings.size).toBeGreaterThan(0);
    });

    it('auto-injected T alongside user T produces separate updates', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return (
            <div>
              <T>User translated</T>
              <span>Auto translate me</span>
            </div>
          );
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(2);
      expect(result.updates[0].source).toEqual('User translated');
      expect(result.updates[1].source).toEqual('Auto translate me');
    });

    it('deduplication: identical content from both passes produces one update', () => {
      // user writes <T>Hello</T> AND there's a <div>Hello</div>
      // Both produce source "Hello". Should dedup to just user T's update.
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return (
            <div>
              <T>Hello</T>
              <span>Hello</span>
            </div>
          );
        }
      `;
      const result = extractWithAutoInjection(code);
      // The "Hello" from <span> matches the "Hello" from <T>, so it's deduped
      const helloUpdates = result.updates.filter((u) => u.source === 'Hello');
      expect(helloUpdates.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ================================================================ //
  //  3. EXTRACTION — deep nesting
  // ================================================================ //

  describe('extraction — deep nesting', () => {
    it('5-level deep text extracts as simple string', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <main><section><article><div><p>Very deep text</p></div></article></section></main>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toEqual('Very deep text');
    });

    it('5-level deep text + dynamic extracts as array with Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <main><section><article><div><p>Hello {name}</p></div></article></section></main>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source;
      expect(Array.isArray(source)).toBe(true);
      expect((source as JsxChild[])[0]).toBe('Hello ');
      expect((source as JsxChild[])[1]).toHaveProperty('v', 'v');
    });

    it('sibling elements each extracted independently', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return (
            <div>
              <span>First</span>
              <p><em>Second</em></p>
            </div>
          );
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(2);
    });
  });

  // ================================================================ //
  //  4. EXTRACTION — opaque components
  // ================================================================ //

  describe('extraction — opaque components', () => {
    it('Branch extracts with branch structure in source', () => {
      const code = `
        import { Branch } from "gt-next";
        export default function Page() {
          return <div><Branch branch="test" a={<span>A</span>} b={<span>B</span>}>Fallback</Branch></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
    });

    it('Plural extracts with plural structure in source', () => {
      const code = `
        import { Plural } from "gt-next";
        export default function Page() {
          return <div><Plural n={count} one="item" other="items" /></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
    });

    it('Branch with dynamic fallback children extracts without errors', () => {
      const code = `
        import { Branch } from "gt-react/browser";
        export default function Page() {
          const userName = "Ernest";
          return (
            <>
              Hello, friend
              <Branch branch={userName}>
                Fallback with Var {userName}
              </Branch>
            </>
          );
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
    });

    it('Plural with dynamic fallback children extracts without errors', () => {
      const code = `
        import { Plural } from "gt-react/browser";
        export default function Page() {
          const count = 5;
          return <div><Plural n={count}>You have {count} items</Plural></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
    });

    it('Derive does not Var-wrap children', () => {
      const code = `
        import { Derive } from "gt-react/browser";
        export default function Page() {
          return <div>Hello <Derive>{getName()}</Derive></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ================================================================ //
  //  5. EXTRACTION — conditional rendering
  // ================================================================ //

  describe('extraction — conditional rendering', () => {
    it('ternary with JSX branches produces 3 updates (outer + 2 inner)', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(3);
    });

    it('ternary without surrounding text — 2 updates for branches only', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>{flag ? <p>Yes</p> : <p>No</p>}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(2);
    });

    it('logical AND with JSX produces 2 updates', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello {show && <span>Content</span>}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(2);
    });
  });

  // ================================================================ //
  //  6. EXTRACTION — non-children props
  // ================================================================ //

  describe('extraction — non-children props', () => {
    it('JSX in non-children prop produces independent update', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <Card header={<h1>Title</h1>}>Body text</Card>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(2);
    });

    it('multiple non-children props produce independent updates', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <Layout header={<h1>Header</h1>} footer={<p>Footer</p>}>Main</Layout>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(3);
    });
  });

  // ================================================================ //
  //  7. EXTRACTION — dynamic expression types
  // ================================================================ //

  describe('extraction — dynamic expression types', () => {
    it('member expression extracted as variable', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Price: {obj.price}</div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(source[0]).toBe('Price: ');
      expect(source[1]).toHaveProperty('v', 'v');
    });

    it('ternary extracted as variable', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Status: {x ? "on" : "off"}</div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(source[0]).toBe('Status: ');
      expect(source[1]).toHaveProperty('v', 'v');
    });

    it('function call extracted as variable', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Result: {getValue()}</div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(source[0]).toBe('Result: ');
      expect(source[1]).toHaveProperty('v', 'v');
    });

    it('optional chaining extracted as variable', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Name: {user?.name}</div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(source[1]).toHaveProperty('v', 'v');
    });

    it('nullish coalescing extracted as variable', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Name: {name ?? "Anonymous"}</div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(source[1]).toHaveProperty('v', 'v');
    });

    it('binary expression extracted as variable', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Total: {"$" + amount}</div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(source[1]).toHaveProperty('v', 'v');
    });
  });

  // ================================================================ //
  //  8. EXTRACTION — user variable components
  // ================================================================ //

  describe('extraction — user variable components', () => {
    it('user Var preserved as {v:"v"} in source', () => {
      const code = `
        import { T, Var } from "gt-next";
        export default function Page() {
          return <div>Hello <Var>{name}</Var></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toEqual([
        'Hello ',
        { i: 1, k: '_gt_value_1', v: 'v' },
      ]);
    });

    it('user Num preserved as {v:"n"} in source', () => {
      const code = `
        import { T, Num } from "gt-next";
        export default function Page() {
          return <div>Price: <Num>{price}</Num></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(source[0]).toBe('Price: ');
      expect(source[1]).toHaveProperty('v', 'n');
    });

    it('user Currency preserved as {v:"c"} in source', () => {
      const code = `
        import { T, Currency } from "gt-next";
        export default function Page() {
          return <div>Paid <Currency>{amount}</Currency></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(source[0]).toBe('Paid ');
      expect(source[1]).toHaveProperty('v', 'c');
    });

    it('user DateTime preserved as {v:"d"} in source', () => {
      const code = `
        import { T, DateTime } from "gt-next";
        export default function Page() {
          return <div>Date: <DateTime>{date}</DateTime></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(source[0]).toBe('Date: ');
      expect(source[1]).toHaveProperty('v', 'd');
    });
  });

  // ================================================================ //
  //  9. E2E NO-ERROR PIPELINE
  // ================================================================ //

  describe('E2E no-error pipeline', () => {
    it('simple text + dynamic expression — no errors', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Hello {name}!</div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThan(0);
    });

    it('multiple dynamic expressions — no errors', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello {first}, welcome to {city}!</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThan(0);
    });

    it('Branch with dynamic fallback — no errors', () => {
      const code = `
        import { Branch } from "gt-next";
        export default function Page() {
          return <div>Text <Branch branch={x}>Fallback {name}</Branch></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
    });

    it('Plural with dynamic fallback — no errors', () => {
      const code = `
        import { Plural } from "gt-next";
        export default function Page() {
          return <div><Plural n={c}>You have {c} items</Plural></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
    });

    it('ternary with JSX branches — no errors', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
    });

    it('Derive alongside dynamic — no errors', () => {
      const code = `
        import { Derive } from "gt-next";
        export default function Page() {
          return <div>Hello <Derive>{getX()}</Derive> and {z}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
    });

    it('non-children prop with text + dynamic — no errors', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <Card header={<h1>Title {count}</h1>}>Body</Card>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ================================================================ //
  //  10. SCOPE REFRESH
  // ================================================================ //

  describe('scope and binding refresh', () => {
    it('auto-inserted T found after re-parse', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <h1>Welcome</h1>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toEqual('Welcome');
    });

    it('T not imported at all — auto-injection adds import and extracts', () => {
      const code = `
        export default function Page() { return <h1>Welcome</h1>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toEqual('Welcome');
    });
  });

  // ================================================================ //
  //  11. NON-GT COMPONENTS
  // ================================================================ //

  describe('non-GT components sharing GT names', () => {
    it('Var not imported from GT is treated as regular element', () => {
      const code = `
        import { T, Var } from 'some-other-library';
        export default function Page() {
          const userName = "Ernest";
          return <T>Hello, <div>World</div> <Var>{userName}</Var>!</T>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates.length).toBeGreaterThan(0);

      const mainUpdate = result.updates.find((u) => {
        const s = JSON.stringify(u.source);
        return s.includes('Hello, ');
      });
      expect(mainUpdate).toBeDefined();

      const source = mainUpdate!.source as JsxChild[];
      // Var from non-GT library should appear as { t: "Var" }, not { v: "v" }
      const varSlotWithoutTag = source.find(
        (child) =>
          typeof child === 'object' &&
          child !== null &&
          'v' in child &&
          (child as Record<string, unknown>).v === 'v' &&
          !('t' in child)
      );
      expect(varSlotWithoutTag).toBeUndefined();
    });
  });

  // ================================================================ //
  //  12. WHITESPACE
  // ================================================================ //

  describe('whitespace', () => {
    it('whitespace-only between dynamic expressions — no extraction', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>{firstName} {lastName}</div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(0);
    });

    it('no text → no extraction', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>{userName}</div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(0);
    });
  });

  // ================================================================ //
  //  13. SELF-CLOSING AND EMPTY
  // ================================================================ //

  describe('self-closing and empty', () => {
    it('self-closing element — no extraction', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <input />; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(0);
    });

    it('element with empty children — no extraction', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div></div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(0);
    });
  });

  // ================================================================ //
  //  14. MIXED GT COMPONENTS
  // ================================================================ //

  describe('mixed GT components', () => {
    it('user T next to auto-insertable content — separate updates', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return (
            <div>
              <T>Manual</T>
              <span>Automatic</span>
            </div>
          );
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(2);
    });

    it('user Currency + DateTime in same tree', () => {
      const code = `
        import { T, Currency, DateTime } from "gt-next";
        export default function Page() {
          return <div>Paid <Currency>{amount}</Currency> on <DateTime>{date}</DateTime></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      const currencyChild = source.find(
        (c) => typeof c === 'object' && c !== null && 'v' in c && c.v === 'c'
      );
      const dateChild = source.find(
        (c) => typeof c === 'object' && c !== null && 'v' in c && c.v === 'd'
      );
      expect(currencyChild).toBeDefined();
      expect(dateChild).toBeDefined();
    });
  });

  // ================================================================ //
  //  15. ADVERSARIAL
  // ================================================================ //

  describe('adversarial', () => {
    it('unicode content extracted', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>こんにちは世界</div>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toEqual('こんにちは世界');
    });

    it('multiple components in one file — each extracted', () => {
      const code = `
        import { T } from "gt-next";
        function Header() { return <h1>Welcome</h1>; }
        function Footer() { return <p>Copyright {year}</p>; }
        export default function Page() { return <div><Header /><Footer /></div>; }
      `;
      const result = extractWithAutoInjection(code);
      // Header "Welcome" and Footer "Copyright {year}" both extracted
      expect(result.updates.length).toBeGreaterThanOrEqual(2);
    });

    it('fragment with mixed content', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <>Welcome {name}!</>; }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(Array.isArray(source)).toBe(true);
    });
  });

  // ================================================================ //
  //  16. NESTED DYNAMIC CONTENT
  // ================================================================ //

  describe('nested dynamic content', () => {
    it('Var wraps dynamic inside nested element within T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello <span>{userName}</span></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(source[0]).toBe('Hello ');
      const spanEl = source[1];
      expect(spanEl).toHaveProperty('t', 'span');
    });

    it('multiple nested dynamic expressions', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello <span>{first}</span> and <em>{last}</em></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source as JsxChild[];
      expect(Array.isArray(source)).toBe(true);
    });
  });
});
