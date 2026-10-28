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
 * Helper: parses source code containing a <T> component with autoderive enabled,
 * returns the extracted updates, errors, and warnings.
 *
 * The source must `import { T } from "gt-next"` (and optionally `Derive`).
 */
function parseAutoderive(
  source: string,
  opts?: { filePath?: string }
): { updates: Updates; errors: string[]; warnings: Set<string> } {
  const filePath = opts?.filePath ?? '/test/autoderive/page.tsx';
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
            autoderive: true,
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

/**
 * Helper: same as parseAutoderive but WITHOUT autoderive enabled.
 * Used for control tests to verify that dynamic content still errors
 * when autoderive is not active.
 */
function parseNoAutoderive(
  source: string,
  opts?: { filePath?: string }
): { updates: Updates; errors: string[]; warnings: Set<string> } {
  const filePath = opts?.filePath ?? '/test/autoderive/page.tsx';
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
            autoderive: false,
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

describe('Autoderive JSX: <T> implicitly acts as <Derive>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve a ternary variable without producing a Derive node', () => {
    const source = `
      import { T } from "gt-next";

      export default function Page() {
        const label = condition ? "boy" : "girl";
        return <T>Hello {label}</T>;
      }
    `;

    const { updates, errors } = parseAutoderive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const sources = updates.map((u) => u.source);
    expect(sources).toContainEqual(['Hello ', 'boy']);
    expect(sources).toContainEqual(['Hello ', 'girl']);
  });

  it('should resolve a ternary variable nested inside child elements', () => {
    const source = `
      import { T } from "gt-next";

      export default function Page() {
        const label = condition ? "boy" : "girl";
        return <T>Hello <b>{label}</b></T>;
      }
    `;

    const { updates, errors } = parseAutoderive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const sources = updates.map((u) => u.source);
    expect(sources).toContainEqual(['Hello ', { t: 'b', i: 1, c: 'boy' }]);
    expect(sources).toContainEqual(['Hello ', { t: 'b', i: 1, c: 'girl' }]);
  });

  it('should leave static content unaffected by autoderive', () => {
    const source = `
      import { T } from "gt-next";

      export default function Page() {
        return <T>Hello world</T>;
      }
    `;

    const { updates, errors } = parseAutoderive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].source).toEqual('Hello world');
  });

  it('should still produce Derive nodes when explicit <Derive> is used alongside autoderive', () => {
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

    const { updates, errors } = parseAutoderive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const sources = updates.map((u) => u.source);
    expect(sources).toContainEqual(['Hello ', { t: 'Derive', i: 1, c: 'boy' }]);
    expect(sources).toContainEqual([
      'Hello ',
      { t: 'Derive', i: 1, c: 'girl' },
    ]);
  });

  it('should error on dynamic content when autoderive is not enabled', () => {
    const source = `
      import { T } from "gt-next";

      export default function Page() {
        const label = condition ? "boy" : "girl";
        return <T>Hello {label}</T>;
      }
    `;

    const { updates, errors } = parseNoAutoderive(source);

    expect(errors.length).toBeGreaterThan(0);
    expect(updates).toHaveLength(0);
  });
});

describe('Autoderive JSX: edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Variable resolution ──

  it('should resolve a simple const string', () => {
    const source = `
      import { T } from "gt-next";
      export default function Page() {
        const label = "hello";
        return <T>{label}</T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(1);
  });

  it('should resolve nested ternary into 3 branches', () => {
    const source = `
      import { T } from "gt-next";
      export default function Page() {
        const x = a ? "one" : b ? "two" : "three";
        return <T>{x}</T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(3);
  });

  it('should cross-multiply two dynamic expressions (2x2=4)', () => {
    const source = `
      import { T } from "gt-next";
      export default function Page() {
        const a = c1 ? "x" : "y";
        const b = c2 ? "1" : "2";
        return <T>{a} and {b}</T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(4);
  });

  it('should warn on let variable', () => {
    const source = `
      import { T } from "gt-next";
      export default function Page() {
        let label = "hello";
        return <T>{label}</T>;
      }
    `;
    const { warnings } = parseAutoderive(source);
    expect(warnings.size).toBeGreaterThan(0);
  });

  it('should error on destructured variable', () => {
    const source = `
      import { T } from "gt-next";
      export default function Page() {
        const { label } = obj;
        return <T>{label}</T>;
      }
    `;
    const { errors } = parseAutoderive(source);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should resolve a variable from enclosing scope', () => {
    const source = `
      import { T } from "gt-next";
      const label = condition ? "outer1" : "outer2";
      export default function Page() {
        return <T>{label}</T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);
  });

  it('should handle T with only dynamic content and no static text', () => {
    const source = `
      import { T } from "gt-next";
      export default function Page() {
        const label = condition ? "hello" : "world";
        return <T>{label}</T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);
  });

  // ── Nesting ──

  it('should resolve through 3 levels of element nesting', () => {
    const source = `
      import { T } from "gt-next";
      export default function Page() {
        const label = condition ? "boy" : "girl";
        return <T><div><span>{label}</span></div></T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);
  });

  it('should cross-multiply dynamic expressions in separate nested elements', () => {
    const source = `
      import { T } from "gt-next";
      export default function Page() {
        const a = c1 ? "x" : "y";
        const b = c2 ? "1" : "2";
        return <T><b>{a}</b> and <i>{b}</i></T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(4);
  });

  it('should resolve two T components in the same file independently', () => {
    const source = `
      import { T } from "gt-next";
      export function A() {
        const x = c ? "a" : "b";
        return <T>{x}</T>;
      }
      export function B() {
        const y = c ? "1" : "2";
        return <T>{y}</T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(4);
  });

  // ── Metadata ──

  it('should not set staticId on static-only content', () => {
    const source = `
      import { T } from "gt-next";
      export default function Page() {
        return <T>Hello <b>World</b></T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].metadata.staticId).toBeUndefined();
  });

  it('should set shared staticId on dynamic content branches', () => {
    const source = `
      import { T } from "gt-next";
      export default function Page() {
        const label = condition ? "boy" : "girl";
        return <T>Hello {label}</T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);
    expect(updates[0].metadata.staticId).toBeDefined();
    expect(updates[1].metadata.staticId).toBeDefined();
    expect(updates[0].metadata.staticId).toEqual(updates[1].metadata.staticId);
  });

  // ── Interactions ──

  it('should preserve explicit Derive nodes while resolving bare expressions', () => {
    const source = `
      import { T, Derive } from "gt-next";
      export default function Page() {
        const a = c1 ? "x" : "y";
        const b = c2 ? "1" : "2";
        return <T><Derive>{a}</Derive> and {b}</T>;
      }
    `;
    const { updates, errors } = parseAutoderive(source);
    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(4);
    const sources = updates.map((u) => u.source);
    const hasDerive = sources.some(
      (s) =>
        Array.isArray(s) &&
        s.some(
          (child) =>
            typeof child === 'object' &&
            child !== null &&
            't' in child &&
            child.t === 'Derive'
        )
    );
    expect(hasDerive).toBe(true);
  });
});
