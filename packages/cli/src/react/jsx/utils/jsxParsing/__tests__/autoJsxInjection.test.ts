/**
 * Tests for auto JSX injection simulation in the CLI extraction pipeline.
 *
 * When enableAutoJsxInjection is true, the CLI runs two extraction passes:
 *   Pass 1: Extract user-written <T> components (unchanged behavior)
 *   Pass 2: Auto-inject <T> and <Var> into the AST, then extract from the new <T> only
 *
 * The hashes produced must agree with the compiler plugin's output.
 *
 * See AUTO_JSX_INJECTION_CLI_PLAN.md for the full strategy.
 * See JSX_INSERTION_RULES.md (compiler package) for insertion rules.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
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
const generate =
  (generateModule as { default?: typeof generateModule }).default ||
  generateModule;

vi.mock('node:fs');
vi.mock('../../resolveImportPath.js');

describe('auto JSX injection simulation', () => {
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

  // ================================================================ //
  //  Helper: simulates the two-pass extraction from createInlineUpdates
  // ================================================================ //

  /**
   * Pass 1 only: extract user-written T components (existing behavior).
   * This is the baseline — should work identically with flag on or off.
   */
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

  /**
   * Full two-pass extraction: Pass 1 (user T) + Pass 2 (auto-injected T).
   */
  function extractWithAutoInjection(sourceCode: string) {
    const localUpdates: Updates = [];
    const localErrors: string[] = [];
    const localWarnings = new Set<string>();

    const ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const pkgs = [Libraries.GT_NEXT, Libraries.GT_REACT];

    // --- PASS 1: Extract user-written T components ---
    const pass1Result = getPathsAndAliases(ast, pkgs);
    const importAliases = { ...pass1Result.importAliases };

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

    // --- PASS 2: Auto-inject using GtInternalTranslateJsx/GtInternalVar ---
    // Distinct from user T/Var so there's no ambiguity
    ensureTAndVarImported(ast, importAliases);
    autoInsertJsxComponents(ast, importAliases);

    // Re-parse the modified AST to get fresh scope/bindings
    const modifiedCode = generate(ast).code;
    const freshAst = parse(modifiedCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Find GtInternalTranslateJsx references in the fresh AST
    const internalTName = INTERNAL_TRANSLATION_COMPONENT;

    traverse(freshAst, {
      Program(programPath) {
        const tBinding = programPath.scope.getBinding(internalTName);
        if (!tBinding) return;

        // Augment referencePaths with any JSX usages not captured by scope
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

    // Remove Pass 1 duplicates (Pass 2 re-extracts everything)
    // Keep only unique updates by source content
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
  //  1. TWO-PASS SEPARATION: user T vs auto T never double-extract
  // ================================================================ //

  describe('two-pass separation', () => {
    it('Pass 1: user-written <T> extracts normally even with flag on', () => {
      // SOURCE:
      //   <T>Hello World</T>
      //
      // PASS 1 extracts: "Hello World"
      // PASS 2 may re-extract user T (duplicates removed by dedupeUpdates in pipeline)
      //
      // EXPECTED: at least 1 update with source "Hello World", no errors
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Hello World</T>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
      expect(result.updates[0].source).toEqual('Hello World');
    });

    it('Pass 1 errors on user <T> are preserved — auto-injection does NOT fix them', () => {
      // SOURCE:
      //   <T>Hello {name}</T>
      //
      // The user wrote <T> with an unwrapped expression — that's an error.
      // Auto-injection must NOT suppress this by inserting <Var>.
      // Pass 1 should produce the error. Pass 2 should not touch user T content.
      //
      // EXPECTED: error for unwrapped expression in user <T>
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

    it('auto-injected <T> alongside user <T> produces separate updates', () => {
      // SOURCE:
      //   <div>
      //     <T>User translated</T>
      //     <span>Auto translate me</span>
      //   </div>
      //
      // PASS 1 extracts: "User translated" from user <T>
      // PASS 2 extracts: "Auto translate me" from auto-inserted <T> inside <span>
      //
      // EXPECTED: 2 updates total, one from each pass
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
  });

  // ================================================================ //
  //  2. HASH AGREEMENT: auto-injected must match user-written hashes
  // ================================================================ //

  describe('hash agreement', () => {
    it('auto-injected <T> for simple text produces same hash as user <T>', () => {
      // The entire point of this system: if a user writes <T>Hello</T>,
      // and the compiler auto-inserts <_T>Hello</_T>, the hashes must match.
      //
      // MANUAL:  <T>Hello World</T>        → source: "Hello World" → hash X
      // AUTO:    <div>Hello World</div>     → source: "Hello World" → hash X
      //
      // EXPECTED: both hashes are identical
      const manualCode = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Hello World</T>;
        }
      `;
      const autoCode = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello World</div>;
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

    it('auto-injected <T> with <Var> produces same hash as user <T> with <Var>', () => {
      // MANUAL:  <T>Hello <Var>{name}</Var>!</T>
      // AUTO:    <div>Hello {name}!</div>
      //
      // Both should produce: ["Hello ", { i:1, k:"_gt_value_1", v:"v" }, "!"]
      // And therefore the same hash.
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
  });

  // ================================================================ //
  //  3. INSERTION RULES: where T and Var get placed
  // ================================================================ //

  describe('insertion rules', () => {
    it('text at deepest level — T wraps inside innermost element', () => {
      // SOURCE:
      //   <div><section><p>Deep text</p></section></div>
      //
      // SIMULATED:
      //   <div><section><p><T>Deep text</T></p></section></div>
      //
      // The <p> has text, div and section do not → T inside p
      //
      // EXPECTED: 1 update, source: "Deep text"
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div><section><p>Deep text</p></section></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toEqual('Deep text');
    });

    it('parent with text claims subtree — no T on nested children', () => {
      // SOURCE:
      //   <div>Hello <b>World</b> today</div>
      //
      // SIMULATED:
      //   <div><T>Hello <b>World</b> today</T></div>
      //
      // div has direct text "Hello " → T at div, <b> is part of the unit
      //
      // EXPECTED: 1 update (not 2), source includes the <b> as a nested element
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello <b>World</b> today</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      // Source should be: ["Hello ", { t: "b", i: 1, c: "World" }, " today"]
      expect(Array.isArray(result.updates[0].source)).toBe(true);
    });

    it('no text → no extraction', () => {
      // SOURCE:
      //   <div>{userName}</div>
      //
      // No string content in children → no T inserted → no extraction
      //
      // EXPECTED: 0 updates (no errors either — just nothing to translate)
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>{userName}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(0);
    });

    it('whitespace-only between dynamic expressions → no extraction', () => {
      // SOURCE:
      //   <div>{firstName} {lastName}</div>
      //
      // Only whitespace string content — not translatable
      //
      // EXPECTED: 0 updates
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>{firstName} {lastName}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(0);
    });

    it('sibling elements get independent T insertions', () => {
      // SOURCE:
      //   <div>
      //     <span>First</span>
      //     <p><em>Second</em></p>
      //   </div>
      //
      // SIMULATED:
      //   <div>
      //     <span><T>First</T></span>
      //     <p><em><T>Second</T></em></p>
      //   </div>
      //
      // div has no text, each child path gets its own T
      //
      // EXPECTED: 2 updates: "First" and "Second"
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
  //  4. SCOPE REFRESH: auto-inserted T must be discoverable
  // ================================================================ //

  describe('scope and binding refresh', () => {
    it('auto-inserted T is found by parseTranslationComponent after scope.crawl()', () => {
      // This test verifies that after we insert <T> into the AST and
      // call scope.crawl(), the new T reference shows up in
      // binding.referencePaths so parseTranslationComponent finds it.
      //
      // SOURCE (no user T):
      //   <h1>Welcome</h1>
      //
      // SIMULATED:
      //   <h1><T>Welcome</T></h1>
      //
      // If scope refresh fails, parseTranslationComponent won't find the
      // new T reference → 0 updates (test fails).
      //
      // EXPECTED: 1 update, source: "Welcome"
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <h1>Welcome</h1>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toEqual('Welcome');
    });

    it('T not imported at all — auto-injection adds the import and extracts', () => {
      // SOURCE (T is NOT imported):
      //   export default function Page() {
      //     return <h1>Welcome</h1>;
      //   }
      //
      // ensureTAndVarImported() should add: import { T, Var } from "gt-react/browser"
      // Then auto-insertion wraps: <h1><T>Welcome</T></h1>
      // scope.crawl() picks up the new binding
      //
      // EXPECTED: 1 update, source: "Welcome"
      const code = `
        export default function Page() {
          return <h1>Welcome</h1>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toEqual('Welcome');
    });
  });

  // ================================================================ //
  //  5. DERIVE CROSS-FILE: auto T ignored, auto Var preserved
  // ================================================================ //

  describe('derive cross-file handling', () => {
    it('auto-inserted T inside Derive return is ignored (matches runtime removal)', () => {
      // SOURCE:
      //   function getName() {
      //     return <div>John</div>;
      //   }
      //   <div><Derive>{getName()}</Derive></div>
      //
      // The compiler would insert T in getName's return:
      //   function getName() { return <div><_T>John</_T></div>; }
      //
      // But removeInjectedT strips it at runtime. So the CLI must
      // also ignore it — the effective source for hashing is just "John"
      // inside the Derive, NOT wrapped in T.
      //
      // EXPECTED: Derive extraction produces source with "John" as a
      //           static derive value, NOT as a nested T component.
      const code = `
        import { T, Derive } from "gt-next";
        function getName() {
          return <div>John</div>;
        }
        export default function Page() {
          return <div><Derive>{getName()}</Derive></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      // Should have update(s) from the outer T (wrapping Derive)
      // The Derive's inner content should NOT have a nested T structure
      expect(result.updates.length).toBeGreaterThan(0);
      for (const update of result.updates) {
        // Verify no nested T component appears in the source tree
        const sourceStr = JSON.stringify(update.source);
        expect(sourceStr).not.toContain('"t":"T"');
        expect(sourceStr).not.toContain('"t":"GtInternalTranslateJsx"');
      }
    });

    it('auto-inserted Var inside Derive return IS preserved', () => {
      // SOURCE:
      //   function getGreeting(name) {
      //     return <div>Hello {name}</div>;
      //   }
      //   <div><Derive>{getGreeting("World")}</Derive></div>
      //
      // The compiler inserts T + Var:
      //   function getGreeting(name) { return <div><_T>Hello <_Var>{name}</_Var></_T></div>; }
      //
      // Runtime removes the T (inside Derive) but the Var structure remains
      // because it defines the variable slot in the translation.
      //
      // EXPECTED: Derive source includes a Var-like variable entry for {name}
      const code = `
        import { T, Derive } from "gt-next";
        function getGreeting(name: string) {
          return <span>Hello {name}</span>;
        }
        export default function Page() {
          return <div><Derive>{getGreeting("World")}</Derive></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates.length).toBeGreaterThan(0);
      // At least one update should contain a variable entry (v: "v")
      const hasVar = result.updates.some((u) => {
        const s = JSON.stringify(u.source);
        return s.includes('"v":"v"');
      });
      expect(hasVar).toBe(true);
    });
  });

  // ================================================================ //
  //  6. USER COMPONENTS: hands-off behavior
  // ================================================================ //

  describe('user component hands-off', () => {
    it('user <Var> inside auto-injected T is preserved as-is', () => {
      // SOURCE:
      //   <div>Hello <Var>{name}</Var></div>
      //
      // SIMULATED:
      //   <div><T>Hello <Var>{name}</Var></T></div>
      //
      // The user Var is NOT replaced with auto Var. It's used directly.
      //
      // EXPECTED: source has the user Var structure, not auto Var
      const code = `
        import { T, Var } from "gt-next";
        export default function Page() {
          return <div>Hello <Var>{name}</Var></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      // User Var should produce: ["Hello ", { i: 1, k: "_gt_value_1", v: "v" }]
      expect(result.updates[0].source).toEqual([
        'Hello ',
        { i: 1, k: '_gt_value_1', v: 'v' },
      ]);
    });

    it('content inside user <T> is not touched by auto-injection', () => {
      // SOURCE:
      //   <T>Hello <span>{name}</span></T>
      //
      // This is a user T with an unwrapped expression inside a span.
      // The existing extraction should handle this (likely error or warning).
      // Auto-injection must NOT insert Var inside the user's T.
      //
      // EXPECTED: same behavior as without the flag — error/warning for {name}
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Hello <span>{name}</span></T>;
        }
      `;
      const withFlag = extractWithAutoInjection(code);

      // Reset for second run
      updates = [];
      errors = [];
      warnings = new Set();

      const withoutFlag = extractUserT(code);

      // Both should produce errors/warnings — auto-injection doesn't suppress user errors
      // The exact count may differ (Pass 2 re-extraction can produce additional entries)
      // but every error from flag-off should also appear in flag-on
      for (const err of withoutFlag.errors) {
        expect(withFlag.errors).toContainEqual(err);
      }
    });
  });

  // ================================================================ //
  //  7. DYNAMIC EXPRESSION TYPES (Rule 4)
  // ================================================================ //

  describe('dynamic expression types', () => {
    it('wraps member expression in Var', () => {
      // SOURCE:   <div>Price: {obj.price}</div>
      // INJECTED: <div><T>Price: <Var>{obj.price}</Var></T></div>
      // EXPECTED: 1 update: ["Price: ", { i: 1, k: "_gt_value_1", v: "v" }]
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Price: {obj.price}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source;
      expect(Array.isArray(source)).toBe(true);
      expect((source as JsxChild[])[0]).toBe('Price: ');
      expect((source as JsxChild[])[1]).toHaveProperty('v', 'v');
    });

    it('wraps ternary in Var', () => {
      // SOURCE:   <div>Status: {isActive ? "on" : "off"}</div>
      // INJECTED: <div><T>Status: <Var>{isActive ? "on" : "off"}</Var></T></div>
      // EXPECTED: 1 update with Var
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Status: {isActive ? "on" : "off"}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source;
      expect(Array.isArray(source)).toBe(true);
      expect((source as JsxChild[])[0]).toBe('Status: ');
      expect((source as JsxChild[])[1]).toHaveProperty('v', 'v');
    });

    it('wraps function call in Var', () => {
      // SOURCE:   <div>Result: {getValue()}</div>
      // INJECTED: <div><T>Result: <Var>{getValue()}</Var></T></div>
      // EXPECTED: 1 update with Var
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Result: {getValue()}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source;
      expect(Array.isArray(source)).toBe(true);
      expect((source as JsxChild[])[0]).toBe('Result: ');
      expect((source as JsxChild[])[1]).toHaveProperty('v', 'v');
    });
  });

  // ================================================================ //
  //  8. BRANCH/PLURAL OPAQUE (Rule 8)
  // ================================================================ //

  describe('Branch/Plural opaque', () => {
    it('Branch triggers T at parent, content is opaque', () => {
      // SOURCE:   <div><Branch branch="test">Fallback</Branch></div>
      // INJECTED: <div><T><Branch branch="test">Fallback</Branch></T></div>
      // EXPECTED: 1 update with Branch structure
      const code = `
        import { T, Branch } from "gt-next";
        export default function Page() {
          return <div><Branch branch="test">Fallback</Branch></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
    });

    it('Plural triggers T at parent', () => {
      // SOURCE:   <div><Plural n={count} one="item" other="items" /></div>
      // INJECTED: <div><T><Plural n={count} one="item" other="items" /></T></div>
      // EXPECTED: update(s) with Plural structure
      const code = `
        import { T } from "gt-next";
        import { Plural } from "gt-next";
        export default function Page() {
          return <div><Plural n={count} one="item" other="items" /></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ================================================================ //
  //  8b. OPAQUE COMPONENT CHILDREN (fallback) — Var-wrapping
  // ================================================================ //

  describe('opaque component children (fallback) processing', () => {
    it('Var-wraps dynamic content inside Branch children without losing text', () => {
      // SOURCE:
      //   <>
      //     Hello, my good friend
      //     <Branch branch={userName}>Fallback with Var {userName}</Branch>
      //   </>
      //
      // INJECTED:
      //   <>
      //     <_T>
      //       Hello, my good friend
      //       <Branch branch={userName}>Fallback with Var <_Var>{userName}</_Var></Branch>
      //     </_T>
      //   </>
      //
      // Branch children is ["Fallback with Var ", {userName}] — must be processed
      // element-by-element. The {userName} inside children gets Var-wrapped.
      // EXPECTED: no errors, Branch children in jsxChildren contains text + variable
      const code = `
        import { Branch } from "gt-react/browser";
        export default function Page() {
          const userName = "Ernest";
          return (
            <>
              Hello, my good friend
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
      const source = result.updates[0].source as JsxChild[];
      expect(Array.isArray(source)).toBe(true);
      // Should contain text + Branch element
      const branchEl = source.find(
        (child) =>
          typeof child === 'object' &&
          child !== null &&
          't' in child &&
          child.t === 'Branch'
      ) as any;
      expect(branchEl).toBeDefined();
      // Branch children should preserve "Fallback with Var" text
      // (not be a single variable with text lost)
      const branchChildren = branchEl.c;
      expect(Array.isArray(branchChildren)).toBe(true);
    });

    it('Var-wraps dynamic content inside Plural children without losing text', () => {
      // SOURCE:   <div><Plural n={count}>You have {count} items</Plural></div>
      // INJECTED: <div><_T><Plural n={count}>You have <_Var>{count}</_Var> items</Plural></_T></div>
      // EXPECTED: no errors, Plural children contains text + variable
      const code = `
        import { Plural } from "gt-react/browser";
        export default function Page() {
          const count = 5;
          return (
            <div>
              <Plural n={count}>
                You have {count} items
              </Plural>
            </div>
          );
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
    });

    it('Var-wraps dynamic content inside Branch content prop JSX', () => {
      // SOURCE:
      //   <div>
      //     <Branch branch="mode" Ernest={<>Hello {userName}</>}>Fallback</Branch>
      //   </div>
      //
      // INJECTED:
      //   <div>
      //     <_T>
      //       <Branch branch="mode" Ernest={<>Hello <_Var>{userName}</_Var></>}>Fallback</Branch>
      //     </_T>
      //   </div>
      //
      // Ernest prop is a content prop with JSX containing dynamic content.
      // {userName} inside Ernest's fragment should get Var-wrapped.
      // EXPECTED: no errors
      const code = `
        import { Branch } from "gt-react/browser";
        export default function Page() {
          const userName = "Ernest";
          return (
            <div>
              <Branch branch="mode" Ernest={<>Hello {userName}</>}>
                Fallback
              </Branch>
            </div>
          );
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
    });

    it('does NOT Var-wrap Derive children (opaque content)', () => {
      // SOURCE:   <div>Hello <Derive>{getName()}</Derive></div>
      // INJECTED: <div><_T>Hello <Derive>{getName()}</Derive></_T></div>
      // Derive children are fully opaque — no Var wrapping, no errors
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
  //  9. NESTED DYNAMIC CONTENT (Rule 12)
  // ================================================================ //

  describe('nested dynamic content', () => {
    it('Var wraps dynamic expression inside nested element within T', () => {
      // SOURCE:   <div>Hello <span>{userName}</span></div>
      // INJECTED: <div><T>Hello <span><Var>{userName}</Var></span></T></div>
      //
      // Parent has text "Hello " → T at div. {userName} inside span → Var.
      // EXPECTED: 1 update, source contains span element with Var child
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello <span>{userName}</span></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source;
      expect(Array.isArray(source)).toBe(true);
      // First element: "Hello "
      expect((source as JsxChild[])[0]).toBe('Hello ');
      // Second element: span with Var child
      const spanEl = (source as JsxChild[])[1];
      expect(spanEl).toHaveProperty('t', 'span');
    });
  });

  // ================================================================ //
  //  10. FRAGMENTS (Rule 13)
  // ================================================================ //

  describe('fragments', () => {
    it('extracts text inside fragments', () => {
      // SOURCE:   <>Hello World</>
      // INJECTED: <><T>Hello World</T></>
      // EXPECTED: 1 update, source: "Hello World"
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <>Hello World</>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toEqual('Hello World');
    });

    it('extracts fragment with dynamic content', () => {
      // SOURCE:   <>Welcome {name}!</>
      // INJECTED: <><T>Welcome <Var>{name}</Var>!</T></>
      // EXPECTED: 1 update with Var
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <>Welcome {name}!</>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source;
      expect(Array.isArray(source)).toBe(true);
    });
  });

  // ================================================================ //
  //  11. NON-CHILDREN PROPS INDEPENDENT (Rule 10)
  // ================================================================ //

  describe('non-children props', () => {
    it('extracts JSX in non-children prop independently', () => {
      // SOURCE:   <Card header={<h1>Title</h1>}>Body text</Card>
      // INJECTED: <Card header={<h1><T>Title</T></h1>}><T>Body text</T></Card>
      // EXPECTED: 2 updates: "Title" and "Body text"
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <Card header={<h1>Title</h1>}>Body text</Card>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(2);
    });
  });

  // ================================================================ //
  //  12. USER NUM/CURRENCY/DATETIME (Rule 7)
  // ================================================================ //

  describe('user Num/Currency/DateTime/RelativeTime', () => {
    it('user RelativeTime is preserved as variable component', () => {
      // SOURCE:   <div>Updated: <RelativeTime>{date}</RelativeTime></div>
      // INJECTED: <div><T>Updated: <RelativeTime>{date}</RelativeTime></T></div>
      // User RelativeTime untouched — appears as v:"rt" in extraction
      // EXPECTED: 1 update with RelativeTime variable entry
      const code = `
        import { T, RelativeTime } from "gt-next";
        export default function Page() {
          return <div>Updated: <RelativeTime>{date}</RelativeTime></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source;
      expect(Array.isArray(source)).toBe(true);
      expect((source as JsxChild[])[0]).toBe('Updated: ');
      expect((source as JsxChild[])[1]).toHaveProperty('v', 'rt');
    });

    it('user Num is preserved as variable component', () => {
      // SOURCE:   <div>Price: <Num>{price}</Num></div>
      // INJECTED: <div><T>Price: <Num>{price}</Num></T></div>
      // User Num untouched — appears as v:"n" in extraction
      // EXPECTED: 1 update with Num variable entry
      const code = `
        import { T, Num } from "gt-next";
        export default function Page() {
          return <div>Price: <Num>{price}</Num></div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(1);
      const source = result.updates[0].source;
      expect(Array.isArray(source)).toBe(true);
      expect((source as JsxChild[])[0]).toBe('Price: ');
      expect((source as JsxChild[])[1]).toHaveProperty('v', 'n');
    });
  });

  // ================================================================ //
  //  13. TERNARY: auto Var vs user Var (Rules 14, 7a, 7b)
  // ================================================================ //

  describe('ternary with JSX — auto vs user Var', () => {
    it('7a: auto Var — JSX inside ternary IS translated', () => {
      // SOURCE (no user T/Var):
      //   <div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>
      //
      // INJECTED:
      //   <div><T>Status: <Var>{isActive ? <span><T>Active</T></span> : <span><T>Inactive</T></span>}</Var></T></div>
      //
      // EXPECTED: 3 updates: outer + Active + Inactive
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates).toHaveLength(3);
    });

    it('7b: user Var — JSX inside ternary is NOT translated', () => {
      // SOURCE (user manually wrote T and Var):
      //   <T>Status: <Var>{isActive ? <span>Active</span> : <span>Inactive</span>}</Var></T>
      //
      // User Var is opaque — Active/Inactive do NOT get their own T
      // EXPECTED: 1 update only (the outer T extraction)
      const code = `
        import { T, Var } from "gt-next";
        export default function Page() {
          return <T>Status: <Var>{isActive ? <span>Active</span> : <span>Inactive</span>}</Var></T>;
        }
      `;
      const result = extractUserT(code);
      expect(result.updates).toHaveLength(1);
      expect(Array.isArray(result.updates[0].source)).toBe(true);
      expect((result.updates[0].source as JsxChild[])[0]).toBe('Status: ');
      expect((result.updates[0].source as JsxChild[])[1]).toHaveProperty(
        'v',
        'v'
      );
    });
  });

  // ================================================================ //
  //  14. NON-GT COMPONENTS NAMED T/Var SHOULD NOT BE TREATED AS GT
  // ================================================================ //

  describe('non-GT components sharing GT names', () => {
    it('Var not imported from GT is treated as a regular element, not a variable', () => {
      // SOURCE — T and Var are NOT imported from any GT library:
      //   import { T, Var } from 'some-other-library';
      //   <T>Hello, <div>World</div> <Var>{userName}</Var>!</T>
      //
      // Since T is not from GT, Pass 1 finds no user T components.
      // Auto-injection (Pass 2) inserts GtInternalTranslateJsx around text.
      // The <T> and <Var> in the source are just regular components.
      //
      // After injection the structure becomes something like:
      //   <T><GtInternalTranslateJsx>Hello, <div>World</div>
      //     <Var><GtInternalVar>{userName}</GtInternalVar></Var>
      //   !</GtInternalTranslateJsx></T>
      //
      // When extracting from GtInternalTranslateJsx, <Var> should appear as
      // a regular element { t: "Var", i: ..., c: ... } because it's NOT
      // imported from GT. It should NOT be treated as a variable slot { v: "v" }.
      //
      // EXPECTED: The Var in the source appears as a regular element in the
      // extraction, not as a minified variable.
      const code = `
        import { T, Var } from 'some-other-library';
        export default function Page() {
          const userName = "Ernest";
          return <T>Hello, <div>World</div> <Var>{userName}</Var>!</T>;
        }
      `;
      const result = extractWithAutoInjection(code);
      expect(result.updates.length).toBeGreaterThan(0);

      // Find the update that contains "Hello, " — this is from auto-injection
      const mainUpdate = result.updates.find((u) => {
        const s = JSON.stringify(u.source);
        return s.includes('Hello, ');
      });
      expect(mainUpdate).toBeDefined();

      const source = mainUpdate!.source as JsxChild[];
      expect(Array.isArray(source)).toBe(true);

      // Var should appear as a regular element { t: "Var" } — NOT as { v: "v" }
      const varSlotWithoutTag = source.find(
        (child) =>
          typeof child === 'object' &&
          child !== null &&
          'v' in child &&
          (child as Record<string, unknown>).v === 'v' &&
          !('t' in child)
      );
      // This should be undefined — Var is not a GT variable, it's a regular element
      expect(varSlotWithoutTag).toBeUndefined();
    });
  });
});
