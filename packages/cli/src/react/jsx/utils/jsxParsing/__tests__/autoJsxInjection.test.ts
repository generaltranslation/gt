/**
 * Tests for auto JSX injection simulation in the CLI extraction pipeline.
 *
 * When enableAutoJsxInjection is true, the CLI must simulate where the compiler
 * would insert _T and _Var components, and extract accordingly. The hashes
 * produced here must agree with those from the compiler plugin.
 *
 * These tests verify the extraction logic against the rules in JSX_INSERTION_RULES.md.
 * They use the same pattern as parseJsx.test.ts: parse source code, run extraction,
 * and verify the resulting JsxChildren structure and hashes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { parseTranslationComponent } from '../parseJsx.js';
import { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { Updates } from '../../../../../types/index.js';
import { hashSource } from 'generaltranslation/id';
import { Libraries } from '../../../../../types/libraries.js';

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

  /**
   * Helper: parse source code and extract updates.
   * Simulates what createInlineUpdates does but for a single file.
   */
  function extractUpdates(
    sourceCode: string,
    opts?: { enableAutoJsxInjection?: boolean }
  ) {
    const ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // First pass: collect import aliases (same as getPathsAndAliases)
    const importAliases: Record<string, string> = {};
    let tLocalName = '';

    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (
          source === 'gt-next' ||
          source === 'gt-react' ||
          source === 'gt-react/browser'
        ) {
          path.node.specifiers.forEach((spec) => {
            if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported)) {
              const originalName = spec.imported.name;
              const localName = spec.local.name;
              importAliases[localName] = originalName;
              if (originalName === 'T') {
                tLocalName = localName;
              }
            }
          });
        }
      },
    });

    // Second pass: parse T components
    if (tLocalName) {
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
                pkgs: [Libraries.GT_NEXT],
                file: '/test/page.tsx',
                includeSourceCodeContext: false,
                enableAutoJsxInjection:
                  opts?.enableAutoJsxInjection ?? false,
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
    }

    return { updates, errors, warnings };
  }

  // ===== Rule 1: _T at the highest level with translatable text ===== //

  it('extracts simple text as if wrapped in _T', () => {
    // Source:     <div>Hello</div>
    // Simulated:  <div><_T>Hello</_T></div>
    // Expected extraction: "Hello" (same as if user wrote <T>Hello</T>)
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <div>Hello</div>;
      }
    `;
    // TODO: When enableAutoJsxInjection is implemented, this should
    // produce an update with source: "Hello" even without explicit <T>
  });

  // ===== Rule 2: Parent with text claims entire subtree ===== //

  it('extracts parent with text + nested elements as single unit', () => {
    // Source:     <div>Hello <b>World</b></div>
    // Simulated:  <div><_T>Hello <b>World</b></_T></div>
    // Expected: ["Hello ", { t: "b", i: 1, c: "World" }]
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <div>Hello <b>World</b></div>;
      }
    `;
    // TODO: implement
  });

  // ===== Rule 3: Siblings without common text parent get independent _T ===== //

  it('extracts independent text from sibling elements', () => {
    // Source:     <div><span>First</span><p><em>Second</em></p></div>
    // Simulated:  <div><span><_T>First</_T></span><p><em><_T>Second</_T></em></p></div>
    // Expected: Two separate updates: "First" and "Second"
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <div><span>First</span><p><em>Second</em></p></div>;
      }
    `;
    // TODO: implement
  });

  // ===== Rule 4: Dynamic expressions get _Var ===== //

  it('extracts text with dynamic identifier as Var', () => {
    // Source:     <div>Hello {name}!</div>
    // Simulated:  <div><_T>Hello <_Var>{name}</_Var>!</_T></div>
    // Expected: ["Hello ", { i: 1, k: "_gt_value_1", v: "v" }, "!"]
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        const name = "World";
        return <div>Hello {name}!</div>;
      }
    `;
    // TODO: implement
  });

  it('extracts text with member expression as Var', () => {
    // Source:     <div>Price: {obj.price}</div>
    // Simulated:  <div><_T>Price: <_Var>{obj.price}</_Var></_T></div>
    // Expected: ["Price: ", { i: 1, k: "_gt_value_1", v: "v" }]
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <div>Price: {obj.price}</div>;
      }
    `;
    // TODO: implement
  });

  it('wraps each dynamic expression in its own Var (1-to-1 mapping)', () => {
    // Source:     <div>Hello {firstName}, welcome to {city}!</div>
    // Simulated:  <div><_T>Hello <_Var>{firstName}</_Var>, welcome to <_Var>{city}</_Var>!</_T></div>
    // Expected: ["Hello ", {v:"v"...}, ", welcome to ", {v:"v"...}, "!"]
    //           Two separate Var entries
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <div>Hello {firstName}, welcome to {city}!</div>;
      }
    `;
    // TODO: implement
  });

  // ===== Rule 5: No _T when no translatable text ===== //

  it('does NOT extract when children are only dynamic', () => {
    // Source:     <div>{userName}</div>
    // Simulated:  unchanged — no text, no _T
    // Expected: No updates produced
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <div>{userName}</div>;
      }
    `;
    // TODO: implement — should produce 0 updates when flag is on
  });

  it('does NOT extract when only whitespace between dynamic content', () => {
    // Source:     <div>{firstName} {lastName}</div>
    // Simulated:  unchanged — whitespace alone not translatable
    // Expected: No updates produced
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <div>{firstName} {lastName}</div>;
      }
    `;
    // TODO: implement
  });

  // ===== Rule 6: User-written T — extract as normal ===== //

  it('extracts user-written T component normally', () => {
    // Source:     <T>Hello World</T>
    // This is the existing behavior — should still work unchanged
    // Expected: "Hello World"
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <T>Hello World</T>;
      }
    `;
    const result = extractUpdates(code, {
      enableAutoJsxInjection: true,
    });
    expect(result.errors).toHaveLength(0);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].source).toEqual('Hello World');
  });

  it('extracts user T with Var normally', () => {
    // Source:     <T>Hello <Var>{name}</Var></T>
    // Existing behavior — user T with user Var
    // Expected: ["Hello ", { i: 1, k: "name", v: "v" }]
    const code = `
      import { T, Var } from "gt-next";
      export default function Page() {
        const name = "World";
        return <T>Hello <Var>{name}</Var></T>;
      }
    `;
    const result = extractUpdates(code, {
      enableAutoJsxInjection: true,
    });
    expect(result.errors).toHaveLength(0);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].source).toEqual([
      'Hello ',
      { i: 1, k: '_gt_value_1', v: 'v' },
    ]);
  });

  // ===== Rule 7: User Var/Num/Currency/DateTime — hands off ===== //

  it('does NOT auto-wrap inside user-written Var', () => {
    // Source:     <div>Hello <Var>{name}</Var></div>
    // Simulated:  <div><_T>Hello <Var>{name}</Var></_T></div>
    // The user Var is untouched — no _Var inserted
    // Expected: ["Hello ", { i: 1, k: "name", v: "v" }]
    const code = `
      import { T, Var } from "gt-next";
      export default function Page() {
        return <div>Hello <Var>{name}</Var></div>;
      }
    `;
    // TODO: implement — should extract with user Var preserved
  });

  // ===== Rule 8: Branch/Plural — _T wraps from parent ===== //

  it('extracts Branch as opaque child triggering _T at parent', () => {
    // Source:     <div><Branch branch="test">Fallback</Branch></div>
    // Simulated:  <div><_T><Branch branch="test">Fallback</Branch></_T></div>
    // Expected: [{ t: "Branch", ... }] with Branch structure
    const code = `
      import { T, Branch } from "gt-next";
      export default function Page() {
        return <div><Branch branch="test">Fallback</Branch></div>;
      }
    `;
    // TODO: implement
  });

  // ===== Rule 9: Derive/Static ===== //

  it('extracts Derive as opaque child triggering _T at parent', () => {
    // Source:     <div><Derive>{getName()}</Derive></div>
    // Simulated:  <div><_T><Derive>{getName()}</Derive></_T></div>
    const code = `
      import { T, Derive } from "gt-next";
      function getName() { return "Alice"; }
      export default function Page() {
        return <div><Derive>{getName()}</Derive></div>;
      }
    `;
    // TODO: implement
  });

  // ===== Rule 12: Nested dynamic content inside _T ===== //

  it('extracts nested dynamic content with Var at expression level', () => {
    // Source:     <div>Hello <span>{userName}</span></div>
    // Simulated:  <div><_T>Hello <span><_Var>{userName}</_Var></span></_T></div>
    // Expected: ["Hello ", { t: "span", i: 1, c: { i: 2, k: "...", v: "v" } }]
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <div>Hello <span>{userName}</span></div>;
      }
    `;
    // TODO: implement
  });

  // ===== Rule 13: Fragments ===== //

  it('extracts text inside fragments', () => {
    // Source:     <>Hello World</>
    // Simulated:  <><_T>Hello World</_T></>
    // Expected: "Hello World"
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <>Hello World</>;
      }
    `;
    // TODO: implement
  });

  // ===== Rule 14: Conditional rendering ===== //

  it('wraps ternary in Var when inside _T region', () => {
    // Source:     <div>Status: {isActive ? "on" : "off"}</div>
    // Simulated:  <div><_T>Status: <_Var>{isActive ? "on" : "off"}</_Var></_T></div>
    // Expected: ["Status: ", { i: 1, k: "...", v: "v" }]
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <div>Status: {isActive ? "on" : "off"}</div>;
      }
    `;
    // TODO: implement
  });

  // ===== Deep nesting ===== //

  it('inserts _T at deepest level with text', () => {
    // Source:     <div><section><p>Deep text</p></section></div>
    // Simulated:  <div><section><p><_T>Deep text</_T></p></section></div>
    // Expected: "Deep text" (extracted from the <p> level)
    const code = `
      import { T } from "gt-next";
      export default function Page() {
        return <div><section><p>Deep text</p></section></div>;
      }
    `;
    // TODO: implement
  });

  // ===== Hash agreement with compiler ===== //

  it('produces same hash for auto-injected _T as user-written T', () => {
    // The whole point: auto-injected _T must produce the same hash
    // as if the user had written <T>Hello World</T> manually.
    const autoCode = `
      import { T } from "gt-next";
      export default function Page() {
        return <div>Hello World</div>;
      }
    `;

    const manualCode = `
      import { T } from "gt-next";
      export default function Page() {
        return <T>Hello World</T>;
      }
    `;

    // Extract with auto-injection enabled
    // TODO: const autoResult = extractUpdates(autoCode, { enableAutoJsxInjection: true });

    // Extract with manual T (existing behavior)
    const manualResult = extractUpdates(manualCode, {
      enableAutoJsxInjection: true,
    });

    // Calculate hash for manual
    const manualHash = hashSource({
      source: manualResult.updates[0].source,
      dataFormat: 'JSX',
    });

    // TODO: When implemented, verify hashes match:
    // const autoHash = hashSource({ source: autoResult.updates[0].source, dataFormat: 'JSX' });
    // expect(autoHash).toEqual(manualHash);

    // For now just verify manual extraction works
    expect(manualResult.updates).toHaveLength(1);
    expect(manualResult.updates[0].source).toEqual('Hello World');
    expect(manualHash).toBeDefined();
  });
});
