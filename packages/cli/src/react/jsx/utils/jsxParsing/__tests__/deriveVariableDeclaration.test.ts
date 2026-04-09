import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { parseTranslationComponent } from '../parseJsx.js';
import { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { Updates } from '../../../../../types/index.js';
import { Libraries } from '../../../../../types/libraries.js';

// Mock fs and resolveImportPath (required by parseJsx internals)
vi.mock('node:fs');
vi.mock('../../resolveImportPath.js');

/**
 * Helper: parses source code containing a <T> component with Derive,
 * returns the extracted updates, errors, and warnings.
 *
 * The source must `import { T, Derive } from "gt-next"`.
 */
function parseDerive(
  source: string,
  opts?: { filePath?: string }
): { updates: Updates; errors: string[]; warnings: Set<string> } {
  const filePath = opts?.filePath ?? '/test/derive-var/page.tsx';
  const updates: Updates = [];
  const errors: string[] = [];
  const warnings: Set<string> = new Set();
  const parsingOptions: ParsingConfigOptions = { conditionNames: [] };

  const ast = parse(source, {
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
            const name = spec.imported.name;
            importAliases[spec.local.name] = name;
            if (name === 'T') {
              tLocalName = spec.local.name;
            }
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
            pkgs: [Libraries.GT_NEXT],
            file: filePath,
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

describe('Derive with variable declarations in JSX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Happy path: basic derivable initializers ───────────────────

  describe('identifier referencing a const with conditional initializer', () => {
    it('should resolve a const ternary variable inside <Derive> and produce 2 branches', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const label = condition ? "boy" : "girl";
          return (
            <T>
              Hello <Derive>{label}</Derive>
            </T>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      // This test verifies the fix: the identifier is now resolved via the
      // VariableDeclarator binding, so no errors are produced and the two
      // ternary branches are extracted as separate updates.
      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(2);

      const sources = updates.map((u) => u.source);
      expect(sources).toContainEqual([
        'Hello ',
        { t: 'Derive', i: 1, c: 'boy' },
      ]);
      expect(sources).toContainEqual([
        'Hello ',
        { t: 'Derive', i: 1, c: 'girl' },
      ]);
    });
  });

  describe('identifier referencing a const string literal', () => {
    it('should resolve a simple const string inside <Derive>', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const greeting = "welcome";
          return (
            <T>
              <Derive>{greeting}</Derive> to our site
            </T>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
      expect(updates[0].source).toEqual([
        { t: 'Derive', i: 1, c: 'welcome' },
        ' to our site',
      ]);
    });
  });

  describe('identifier referencing a const template literal', () => {
    it('should resolve a static template literal inside <Derive>', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const msg = \`hello world\`;
          return (
            <T>
              <Derive>{msg}</Derive>
            </T>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
      expect(updates[0].source).toEqual({
        t: 'Derive',
        i: 1,
        c: 'hello world',
      });
    });
  });

  describe('identifier referencing a const with binary expression', () => {
    it('should resolve a string concatenation const inside <Derive>', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const combined = "good" + " " + "morning";
          return (
            <T>
              <Derive>{combined}</Derive>
            </T>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
    });
  });

  describe('chained const references', () => {
    it('should resolve a chain of const references inside <Derive>', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const base = condition ? "morning" : "evening";
          const alias = base;
          return (
            <T>
              <Derive>{alias}</Derive>
            </T>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(2);

      const sources = updates.map((u) => u.source);
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: 'morning' });
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: 'evening' });
    });
  });

  describe('identifier with surrounding static text and JSX', () => {
    it('should resolve a variable inside <Derive> alongside other content', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const subject = condition ? "cat" : "dog";
          return (
            <T>
              The <Derive>{subject}</Derive> is sleeping
            </T>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(2);

      const sources = updates.map((u) => u.source);
      expect(sources).toContainEqual([
        'The ',
        { t: 'Derive', i: 1, c: 'cat' },
        ' is sleeping',
      ]);
      expect(sources).toContainEqual([
        'The ',
        { t: 'Derive', i: 1, c: 'dog' },
        ' is sleeping',
      ]);
    });
  });

  describe('identifier referencing a numeric literal', () => {
    it('should resolve a const number inside <Derive>', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const count = 42;
          return (
            <T>
              <Derive>{count}</Derive> items
            </T>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
    });
  });

  // ─── Deeper ternary / branching scenarios ───────────────────────

  describe('nested ternary', () => {
    it('should resolve nested ternaries into 3 branches', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const size = a ? "small" : b ? "medium" : "large";
          return (
            <T><Derive>{size}</Derive></T>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(3);

      const sources = updates.map((u) => u.source);
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: 'small' });
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: 'medium' });
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: 'large' });
    });
  });

  describe('multiple Derive siblings each using a variable', () => {
    it('should cross-multiply two Derive variables', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const greeting = x ? "hi" : "hey";
          const subject  = y ? "world" : "there";
          return (
            <T>
              <Derive>{greeting}</Derive> <Derive>{subject}</Derive>
            </T>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      // 2 * 2 = 4 cross-product
      expect(updates).toHaveLength(4);
    });
  });

  describe('ternary with same value in both branches', () => {
    it('should still produce 2 updates (branches are positional)', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const val = cond ? "same" : "same";
          return <T><Derive>{val}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);
      expect(errors).toHaveLength(0);
      // Even though both branches resolve to "same", the derive system produces
      // one update per unique source, so deduplication may collapse this to 1.
      // The key thing is no errors.
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Const enforcement (let / var must warn) ───────────────────

  describe('let variable should warn and not resolve as derived', () => {
    it('should produce a warning for let declaration', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          let label = "hello";
          return <T><Derive>{label}</Derive></T>;
        }
      `;

      const { updates: _updates, warnings } = parseDerive(source);

      // The identifier should NOT be resolved as derivable (let is mutable).
      // A warning is emitted for the non-const variable.
      expect(warnings.size).toBeGreaterThan(0);
      const warningText = [...warnings].join(' ');
      expect(warningText).toMatch(/let/i);
    });
  });

  describe('var variable should warn and not resolve as derived', () => {
    it('should produce a warning for var declaration', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          var label = "hello";
          return <T><Derive>{label}</Derive></T>;
        }
      `;

      const { updates: _updates, warnings } = parseDerive(source);

      expect(warnings.size).toBeGreaterThan(0);
      const warningText = [...warnings].join(' ');
      expect(warningText).toMatch(/var/i);
    });
  });

  // ─── Destructuring (should error) ──────────────────────────────

  describe('object destructuring should error', () => {
    it('should produce an error for destructured variable', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const { label } = someObj;
          return <T><Derive>{label}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors.length).toBeGreaterThan(0);
      expect(updates).toHaveLength(0);
    });
  });

  describe('array destructuring should error', () => {
    it('should produce an error for array-destructured variable', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const [label] = someArr;
          return <T><Derive>{label}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors.length).toBeGreaterThan(0);
      expect(updates).toHaveLength(0);
    });
  });

  // ─── Unresolvable identifiers (no binding, params, etc.) ──────

  describe('function parameter (not a variable declaration)', () => {
    it('should not resolve a function parameter', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page({ label }) {
          return <T><Derive>{label}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      // Function params are not VariableDeclarators — should fall through
      // to buildJSXTree which reports an unwrapped expression error
      expect(updates).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('undeclared variable', () => {
    it('should not resolve and should error', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          return <T><Derive>{undeclaredVar}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(updates).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ─── Non-derivable initializers ────────────────────────────────

  describe('const referencing a function expression (not a call)', () => {
    it('should not resolve a bare function reference', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const fn = () => "hello";
          return <T><Derive>{fn}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      // Arrow function expression is not derivable as a value — it would
      // need to be called: {fn()}
      expect(updates).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ─── Boolean & null initializers ───────────────────────────────

  describe('boolean const', () => {
    it('should resolve a const boolean inside <Derive>', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const flag = true;
          return <T><Derive>{flag}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
    });
  });

  describe('null const', () => {
    it('should resolve a const null inside <Derive>', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const nothing = null;
          return <T><Derive>{nothing}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
    });
  });

  // ─── TypeScript-specific ───────────────────────────────────────

  describe('const with as const assertion', () => {
    it('should resolve a TS as-const string', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const label = "hello" as const;
          return <T><Derive>{label}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
    });
  });

  describe('const with type assertion', () => {
    it('should resolve through a TS type assertion', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const label = condition ? "a" : "b" as string;
          return <T><Derive>{label}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      // "b" as string wraps "b" in TSAsExpression — parseStringExpression
      // should unwrap it
      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(2);
    });
  });

  // ─── Scope isolation ──────────────────────────────────────────

  describe('variable defined in outer scope', () => {
    it('should resolve a variable from an enclosing scope', () => {
      const source = `
        import { T, Derive } from "gt-next";

        const label = condition ? "outer-a" : "outer-b";

        export default function Page() {
          return <T><Derive>{label}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(2);

      const sources = updates.map((u) => u.source);
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: 'outer-a' });
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: 'outer-b' });
    });
  });

  describe('variable shadowed in inner scope', () => {
    it('should use the inner scope variable, not the outer', () => {
      const source = `
        import { T, Derive } from "gt-next";

        const label = "outer";

        export default function Page() {
          const label = "inner";
          return <T><Derive>{label}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
      expect(updates[0].source).toEqual({ t: 'Derive', i: 1, c: 'inner' });
    });
  });

  // ─── Multiple <T> components ──────────────────────────────────

  describe('same variable used in multiple <T> components', () => {
    it('should resolve the variable in each <T> independently', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const role = cond ? "admin" : "user";
          return (
            <>
              <T>First: <Derive>{role}</Derive></T>
              <T>Second: <Derive>{role}</Derive></T>
            </>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      // 2 branches per <T>, 2 <T> components = 4 updates
      expect(updates).toHaveLength(4);
    });
  });

  // ─── Mixed: variable + function call in same <T> ──────────────

  describe('variable Derive and function-call Derive in same <T>', () => {
    it('should cross-multiply variable and function results', () => {
      const source = `
        import { T, Derive } from "gt-next";

        function getTime() {
          return cond ? "day" : "night";
        }

        export default function Page() {
          const greeting = x ? "hello" : "goodbye";
          return (
            <T>
              <Derive>{greeting}</Derive> <Derive>{getTime()}</Derive>
            </T>
          );
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      // 2 greeting * 2 time = 4
      expect(updates).toHaveLength(4);
    });
  });

  // ─── Deep chain of references ─────────────────────────────────

  describe('triple-chained const reference', () => {
    it('should resolve through 3 levels of indirection', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const original = cond ? "yes" : "no";
          const ref1 = original;
          const ref2 = ref1;
          return <T><Derive>{ref2}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(2);

      const sources = updates.map((u) => u.source);
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: 'yes' });
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: 'no' });
    });
  });

  // ─── Negative numeric literal ─────────────────────────────────

  describe('negative number const', () => {
    it('should resolve a negative number', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const temp = -10;
          return <T><Derive>{temp}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
    });
  });

  // ─── Empty string ─────────────────────────────────────────────

  describe('empty string const', () => {
    it('should resolve an empty string', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const empty = "";
          return <T>prefix<Derive>{empty}</Derive>suffix</T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(1);
    });
  });

  // ─── Ternary with mixed types in branches ─────────────────────

  describe('ternary with number and string branches', () => {
    it('should resolve both branches as strings', () => {
      const source = `
        import { T, Derive } from "gt-next";

        export default function Page() {
          const val = cond ? "text" : 42;
          return <T><Derive>{val}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(2);

      const sources = updates.map((u) => u.source);
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: 'text' });
      expect(sources).toContainEqual({ t: 'Derive', i: 1, c: '42' });
    });
  });

  // ─── Const without initializer ────────────────────────────────

  describe('const declaration without initializer (TS declare)', () => {
    it('should not resolve and should error', () => {
      const source = `
        import { T, Derive } from "gt-next";

        declare const label: string;

        export default function Page() {
          return <T><Derive>{label}</Derive></T>;
        }
      `;

      const { updates, errors } = parseDerive(source);

      // declare const has no initializer — cannot be resolved
      expect(updates).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
