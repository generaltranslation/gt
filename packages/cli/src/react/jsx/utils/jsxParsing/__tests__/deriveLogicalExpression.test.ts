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
  const filePath = opts?.filePath ?? '/test/derive-logical/page.tsx';
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

describe('Derive with logical && expressions in JSX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives condition && JSX element into content and empty branches', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ show }) {
        return (
          <T>
            Hello
            <Derive>{show && <li>Extra item</li>}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const sources = updates.map((u) => u.source);
    expect(sources).toContainEqual([
      'Hello',
      { t: 'Derive', i: 1, c: { t: 'li', i: 2, c: 'Extra item' } },
    ]);
    expect(sources).toContainEqual(['Hello', { t: 'Derive', i: 1 }]);
  });

  it('derives condition && parenthesized JSX with nested elements', () => {
    const source = `
      import { T, Derive } from "gt-next";
      import Link from "next/link";

      export default function Page({ showFullDegree }) {
        return (
          <T>
            <ul>
              <li>Studied Computer Science.</li>
              <Derive>
                {
                  showFullDegree && (
                    <li><Link href='https://example.com'>Computer Science</Link>, and more.</li>
                  )
                }
              </Derive>
            </ul>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const serialized = updates.map((u) => JSON.stringify(u.source));
    expect(serialized.some((s) => s.includes(', and more.'))).toBe(true);
    // The empty branch keeps the Derive element but drops its children
    expect(
      serialized.some(
        (s) => !s.includes(', and more.') && s.includes('"t":"Derive"')
      )
    ).toBe(true);
    // The static sibling <li> is present in both variants
    expect(
      serialized.every((s) => s.includes('Studied Computer Science.'))
    ).toBe(true);
  });

  it('derives condition && string literal', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ cond }) {
        return (
          <T>
            Status: <Derive>{cond && "active"}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const sources = updates.map((u) => u.source);
    expect(sources).toContainEqual([
      'Status: ',
      { t: 'Derive', i: 1, c: 'active' },
    ]);
    expect(sources).toContainEqual(['Status: ', { t: 'Derive', i: 1 }]);
  });

  it('derives condition && function invocation into all variants plus empty branch', () => {
    const source = `
      import { T, Derive } from "gt-next";

      function getSubject(gender) {
        return gender === 'male' ? 'boy' : 'girl';
      }

      export default function Page({ cond, gender }) {
        return (
          <T>
            The <Derive>{cond && getSubject(gender)}</Derive> runs.
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(3);

    const serialized = updates.map((u) => JSON.stringify(u.source));
    expect(serialized.some((s) => s.includes('boy'))).toBe(true);
    expect(serialized.some((s) => s.includes('girl'))).toBe(true);
    expect(
      serialized.some((s) => !s.includes('boy') && !s.includes('girl'))
    ).toBe(true);
  });

  it('derives chained conditions a && b && content into two branches', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ a, b }) {
        return (
          <T>
            Hello
            <Derive>{a && b && <li>Both true</li>}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);
  });

  it('derives condition && ternary into all ternary variants plus empty branch', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ cond, flag }) {
        return (
          <T>
            Hello <Derive>{cond && (flag ? "first" : "second")}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(3);

    const sources = updates.map((u) => u.source);
    expect(sources).toContainEqual([
      'Hello ',
      { t: 'Derive', i: 1, c: 'first' },
    ]);
    expect(sources).toContainEqual([
      'Hello ',
      { t: 'Derive', i: 1, c: 'second' },
    ]);
    expect(sources).toContainEqual(['Hello ', { t: 'Derive', i: 1 }]);
  });

  it('does not duplicate the empty branch for nested parenthesized &&', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ a, b }) {
        return (
          <T>
            Hello
            <Derive>{a && (b && <li>Both true</li>)}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const sources = updates.map((u) => u.source);
    expect(sources).toContainEqual([
      'Hello',
      { t: 'Derive', i: 1, c: { t: 'li', i: 2, c: 'Both true' } },
    ]);
    expect(sources).toContainEqual(['Hello', { t: 'Derive', i: 1 }]);
  });

  it('does not duplicate the empty branch for && wrapping a ternary with a null branch', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ cond, flag }) {
        return (
          <T>
            Hello <Derive>{cond && (flag ? "text" : null)}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const sources = updates.map((u) => u.source);
    expect(sources).toContainEqual([
      'Hello ',
      { t: 'Derive', i: 1, c: 'text' },
    ]);
    expect(sources).toContainEqual(['Hello ', { t: 'Derive', i: 1 }]);
  });

  it('derives && alongside static sibling content inside Derive', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ cond }) {
        return (
          <T>
            Hello
            <Derive>prefix {cond && "x"}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const sources = updates.map((u) => u.source);
    expect(sources).toContainEqual([
      'Hello',
      { t: 'Derive', i: 1, c: ['prefix ', 'x'] },
    ]);
    // The empty variant drops the falsy child but keeps the static sibling,
    // matching the runtime serialization of <Derive>prefix {false}</Derive>
    expect(sources).toContainEqual([
      'Hello',
      { t: 'Derive', i: 1, c: ['prefix '] },
    ]);
  });

  it('still errors when the right side of && is dynamic', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ cond, userName }) {
        return (
          <T>
            Hello <Derive>{cond && userName}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors.length).toBeGreaterThan(0);
    expect(updates).toHaveLength(0);
  });

  it('still errors on || expressions with dynamic content', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ name }) {
        return (
          <T>
            Hello <Derive>{name || "Anonymous"}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors.length).toBeGreaterThan(0);
    expect(updates).toHaveLength(0);
  });

  it('derives && returned from a function wrapped in Derive', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ show }) {
        function getExtra() {
          return show && <li>Extra item</li>;
        }
        return (
          <T>
            Hello
            <Derive>{getExtra()}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    const sources = updates.map((u) => u.source);
    expect(sources).toContainEqual([
      'Hello',
      { t: 'Derive', i: 1, c: { t: 'li', i: 2, c: 'Extra item' } },
    ]);
    expect(sources).toContainEqual(['Hello', { t: 'Derive', i: 1 }]);
  });
});
