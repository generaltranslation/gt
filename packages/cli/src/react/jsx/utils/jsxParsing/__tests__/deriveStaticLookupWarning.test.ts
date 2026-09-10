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
  const filePath = opts?.filePath ?? '/test/derive-static-lookup/page.tsx';
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

describe('<T> with id or hash prop containing <Derive>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns (not errors) when a <T> with an id contains <Derive> variants', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ show }) {
        return (
          <T id="landing">
            Hello
            <Derive>{show && <li>Extra item</li>}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors, warnings } = parseDerive(source);

    expect(errors).toHaveLength(0);
    // All variants are still extracted, carrying the user-supplied id
    expect(updates).toHaveLength(2);
    expect(updates.every((u) => u.metadata.id === 'landing')).toBe(true);
    expect(updates.every((u) => u.metadata.staticId)).toBeTruthy();

    expect(warnings.size).toBe(1);
    const warning = [...warnings][0];
    expect(warning).toContain('landing');
    expect(warning).toContain('overrides the lookup behavior');
    expect(warning).toContain('one hard-coded option');
  });

  it('warns when a <T> with a hash prop contains <Derive> variants', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ show }) {
        return (
          <T hash="0123456789abcdef">
            Hello
            <Derive>{show && <li>Extra item</li>}</Derive>
          </T>
        );
      }
    `;

    const { updates, errors, warnings } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);

    expect(warnings.size).toBe(1);
    const warning = [...warnings][0];
    expect(warning).toContain('hash');
    expect(warning).toContain('overrides the lookup behavior');
  });

  it('warns when a <T> with a _hash prop contains <Derive> variants', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ show }) {
        return (
          <T _hash="0123456789abcdef">
            Hello
            <Derive>{show && <li>Extra item</li>}</Derive>
          </T>
        );
      }
    `;

    const { errors, warnings } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(warnings.size).toBe(1);
    expect([...warnings][0]).toContain('_hash');
  });

  it('does not warn for a <T> with an id and no derived variants', () => {
    const source = `
      import { T } from "gt-next";

      export default function Page() {
        return (
          <T id="landing">
            Hello world
          </T>
        );
      }
    `;

    const { updates, errors, warnings } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(warnings.size).toBe(0);
    expect(updates).toHaveLength(1);
  });

  it('does not warn for <Derive> variants without an id or hash', () => {
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

    const { updates, errors, warnings } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(warnings.size).toBe(0);
    expect(updates).toHaveLength(2);
  });

  it('warns for a ternary <Derive> with an id', () => {
    const source = `
      import { T, Derive } from "gt-next";

      export default function Page({ gender }) {
        return (
          <T id="subject">
            The <Derive>{gender === 'male' ? 'boy' : 'girl'}</Derive> runs.
          </T>
        );
      }
    `;

    const { updates, errors, warnings } = parseDerive(source);

    expect(errors).toHaveLength(0);
    expect(updates).toHaveLength(2);
    expect(warnings.size).toBe(1);
    expect([...warnings][0]).toContain('subject');
  });
});
