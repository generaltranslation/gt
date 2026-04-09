import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'node:fs';
import { parseTranslationComponent } from '../parseJsx.js';
import { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { Updates } from '../../../../../types/index.js';
import { Libraries } from '../../../../../types/libraries.js';

// Mock fs and resolveImportPath
vi.mock('node:fs');
vi.mock('../../resolveImportPath.js');

const mockFs = vi.mocked(fs);

/**
 * Helper: parses source code containing a <T> component with Derive,
 * returns the extracted updates and errors.
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
          if (
            t.isImportSpecifier(spec) &&
            t.isIdentifier(spec.imported)
          ) {
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

      // Should produce 2 multiplication branches: one for "boy", one for "girl"
      // Currently fails: the identifier is not resolved, producing an error
      // like "unwrapped expression" because processDeriveExpression does not
      // handle Identifier nodes — it falls through to buildJSXTree which
      // treats it as a generic expression.
      expect(errors).toHaveLength(0);
      expect(updates).toHaveLength(2);

      const sources = updates.map((u) => u.source);
      // Each update should contain the Derive component with a different branch
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
      expect(updates[0].source).toEqual([
        { t: 'Derive', i: 1, c: 'hello world' },
      ]);
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
      expect(sources).toContainEqual([
        { t: 'Derive', i: 1, c: 'morning' },
      ]);
      expect(sources).toContainEqual([
        { t: 'Derive', i: 1, c: 'evening' },
      ]);
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
});
