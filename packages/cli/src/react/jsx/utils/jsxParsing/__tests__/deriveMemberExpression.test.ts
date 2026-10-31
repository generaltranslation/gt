import { describe, it, expect, vi, beforeEach } from 'vitest';
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

type ParseResult = {
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
};

/**
 * Parses source containing <T> components imported from gt-next and
 * returns the extracted updates, errors, and warnings.
 */
function parseSource(
  source: string,
  opts?: { autoderive?: boolean }
): ParseResult {
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
            file: '/test/derive-member/page.tsx',
            autoderive: opts?.autoderive,
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
 * Builds a component whose <T> renders `jsx`, where `{EXPR}` in `jsx` is
 * replaced with either the member expression itself (direct) or a local
 * const alias of it (the workaround from the bug report). `body` holds
 * component-scoped declarations shared by both variants.
 */
function buildPair({
  preamble,
  params = '{ index }: { index: number }',
  body = '',
  jsx,
  expression,
}: {
  preamble: string;
  params?: string;
  body?: string;
  jsx: string;
  expression: string;
}): { direct: string; alias: string } {
  const component = (alias: string, child: string) => `
    import { T, Derive } from "gt-next";
    ${preamble}
    export function Component(${params}) {
      ${body}
      ${alias}
      return (
        <T>
          ${jsx.replace('{EXPR}', `{${child}}`)}
        </T>
      );
    }
  `;
  return {
    direct: component('', expression),
    alias: component(`const alias = ${expression};`, 'alias'),
  };
}

function sources(result: ParseResult) {
  return result.updates.map((u) => u.source);
}

/**
 * Asserts the direct member expression extracts exactly what the
 * equivalent local alias extracts, and returns the direct result.
 */
function expectAliasParity(pair: {
  direct: string;
  alias: string;
}): ParseResult {
  const direct = parseSource(pair.direct);
  const alias = parseSource(pair.alias);
  expect(sources(direct)).toEqual(sources(alias));
  expect(direct.updates.map((u) => u.metadata.staticId !== undefined)).toEqual(
    alias.updates.map((u) => u.metadata.staticId !== undefined)
  );
  expect(direct.errors.length > 0).toBe(alias.errors.length > 0);
  return direct;
}

const STEPS = `
  const steps = [
    { label: 'export your reports.' },
    { label: 'invite your team.' },
  ];
`;

describe('<Derive> with a direct member expression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('issue reproduction', () => {
    it('resolves a dynamic index into a module-level array of objects', () => {
      const result = expectAliasParity(
        buildPair({
          preamble: STEPS,
          jsx: '<h3>Learn to</h3><div><Derive>{EXPR}</Derive></div>',
          expression: 'steps[index].label',
        })
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.size).toBe(0);
      expect(sources(result)).toEqual([
        [
          { t: 'h3', i: 1, c: 'Learn to' },
          {
            t: 'div',
            i: 2,
            c: { t: 'Derive', i: 3, c: 'export your reports.' },
          },
        ],
        [
          { t: 'h3', i: 1, c: 'Learn to' },
          { t: 'div', i: 2, c: { t: 'Derive', i: 3, c: 'invite your team.' } },
        ],
      ]);
    });

    it('produces one entry per array element (five entries)', () => {
      const labels = ['one.', 'two.', 'three.', 'four.', 'five.'];
      const result = expectAliasParity(
        buildPair({
          preamble: `const steps = [${labels
            .map((label) => `{ label: '${label}' }`)
            .join(', ')}];`,
          jsx: '<h3>Learn to</h3><div><Derive>{EXPR}</Derive></div>',
          expression: 'steps[index].label',
        })
      );

      expect(result.errors).toHaveLength(0);
      expect(result.updates).toHaveLength(5);
      expect(sources(result)).toEqual(
        labels.map((label) => [
          { t: 'h3', i: 1, c: 'Learn to' },
          { t: 'div', i: 2, c: { t: 'Derive', i: 3, c: label } },
        ])
      );
    });

    it('shares one staticId across all variants of the same <T>', () => {
      const { direct } = buildPair({
        preamble: STEPS,
        jsx: 'Learn to <Derive>{EXPR}</Derive>',
        expression: 'steps[index].label',
      });
      const result = parseSource(direct);

      expect(result.updates).toHaveLength(2);
      const staticIds = new Set(result.updates.map((u) => u.metadata.staticId));
      expect(staticIds.size).toBe(1);
      expect([...staticIds][0]).toEqual(expect.any(String));
    });
  });

  describe('access shapes', () => {
    it.each([
      {
        name: 'static numeric index narrows to one entry',
        preamble: STEPS,
        expression: 'steps[1].label',
        expected: ['invite your team.'],
      },
      {
        name: 'static string-literal key narrows to one entry',
        preamble: `const labels = { home: 'Home', settings: 'Settings' };`,
        expression: `labels['settings']`,
        expected: ['Settings'],
      },
      {
        name: 'dot access on a const object',
        preamble: `const labels = { home: 'Home', settings: 'Settings' };`,
        expression: 'labels.home',
        expected: ['Home'],
      },
      {
        name: 'dynamic key into a const object',
        preamble: `const labels = { home: 'Home', settings: 'Settings' };`,
        expression: 'labels[index]',
        expected: ['Home', 'Settings'],
      },
      {
        name: 'dynamic index into an array of strings',
        preamble: `const items = ['red', 'green', 'blue'];`,
        expression: 'items[index]',
        expected: ['red', 'green', 'blue'],
      },
      {
        name: 'nested object and array access',
        preamble: `
          const content = {
            steps: [{ label: 'first' }, { label: 'second' }],
          };
        `,
        expression: 'content.steps[index].label',
        expected: ['first', 'second'],
      },
      {
        name: 'two dynamic indexes in one chain',
        preamble: `
          const sections = [
            { steps: [{ label: 'a1' }, { label: 'a2' }] },
            { steps: [{ label: 'b1' }] },
          ];
        `,
        expression: 'sections[index].steps[index].label',
        expected: ['a1', 'a2', 'b1'],
      },
      {
        name: 'array declared with as const',
        preamble: `const steps = [{ label: 'x' }, { label: 'y' }] as const;`,
        expression: 'steps[index].label',
        expected: ['x', 'y'],
      },
      {
        name: 'array declared with satisfies',
        preamble: `
          const steps = [{ label: 'x' }, { label: 'y' }] satisfies { label: string }[];
        `,
        expression: 'steps[index].label',
        expected: ['x', 'y'],
      },
      {
        name: 'array built from a spread',
        preamble: `
          const base = [{ label: 'x' }];
          const steps = [...base, { label: 'y' }];
        `,
        expression: 'steps[index].label',
        expected: ['x', 'y'],
      },
      {
        name: 'entries holding conditionals and const references',
        preamble: `
          const SUFFIX = 'today';
          const steps = [
            { label: isMorning ? 'good morning' : 'good evening' },
            { label: \`see you \${SUFFIX}\` },
          ];
        `,
        expression: 'steps[index].label',
        expected: ['good morning', 'good evening', 'see you today'],
      },
      {
        name: 'numeric and empty-string values',
        preamble: `const values = [42, ''];`,
        expression: 'values[index]',
        expected: ['42', ''],
      },
      {
        name: 'array declared in the component scope',
        preamble: '',
        body: `const steps = [{ label: 'local' }];`,
        expression: 'steps[index].label',
        expected: ['local'],
      },
    ])('$name', ({ preamble, body, expression, expected }) => {
      const result = expectAliasParity(
        buildPair({
          preamble,
          body,
          jsx: 'Pick <Derive>{EXPR}</Derive>',
          expression,
        })
      );

      expect(result.errors).toHaveLength(0);
      expect(result.warnings.size).toBe(0);
      expect(sources(result)).toEqual(
        expected.map((value) => ['Pick ', { t: 'Derive', i: 1, c: value }])
      );
    });

    it('prefers a component-scoped array over a shadowed module array', () => {
      const result = parseSource(`
        import { T, Derive } from "gt-next";
        const steps = [{ label: 'outer' }];
        export function Component({ index }) {
          const steps = [{ label: 'inner' }];
          return <T>Pick <Derive>{steps[index].label}</Derive></T>;
        }
      `);

      expect(result.errors).toHaveLength(0);
      expect(sources(result)).toEqual([
        ['Pick ', { t: 'Derive', i: 1, c: 'inner' }],
      ]);
    });
  });

  describe('composition', () => {
    it('cross-multiplies two member-expression <Derive>s', () => {
      const result = parseSource(`
        import { T, Derive } from "gt-next";
        const sizes = ['small', 'large'];
        const colors = ['red', 'blue'];
        export function Component({ i, j }) {
          return (
            <T>
              A <Derive>{sizes[i]}</Derive> <Derive>{colors[j]}</Derive> car
            </T>
          );
        }
      `);

      expect(result.errors).toHaveLength(0);
      expect(result.updates).toHaveLength(4);
      for (const size of ['small', 'large']) {
        for (const color of ['red', 'blue']) {
          expect(sources(result)).toContainEqual([
            'A ',
            { t: 'Derive', i: 1, c: size },
            ' ',
            { t: 'Derive', i: 2, c: color },
            ' car',
          ]);
        }
      }
    });

    it('cross-multiplies with an identifier <Derive>', () => {
      const result = parseSource(`
        import { T, Derive } from "gt-next";
        const sizes = ['small', 'large'];
        export function Component({ i, isNew }) {
          const age = isNew ? 'new' : 'used';
          return (
            <T>
              A <Derive>{sizes[i]}</Derive> <Derive>{age}</Derive> car
            </T>
          );
        }
      `);

      expect(result.errors).toHaveLength(0);
      expect(result.updates).toHaveLength(4);
    });

    it('resolves a member expression nested in JSX inside <Derive>', () => {
      const result = parseSource(`
        import { T, Derive } from "gt-next";
        ${STEPS}
        export function Component({ index }) {
          return (
            <T>
              Learn to <Derive><b>{steps[index].label}</b></Derive>
            </T>
          );
        }
      `);

      expect(result.errors).toHaveLength(0);
      expect(sources(result)).toEqual([
        [
          'Learn to ',
          {
            t: 'Derive',
            i: 1,
            c: { t: 'b', i: 2, c: 'export your reports.' },
          },
        ],
        [
          'Learn to ',
          { t: 'Derive', i: 1, c: { t: 'b', i: 2, c: 'invite your team.' } },
        ],
      ]);
    });

    it('resolves a member expression returned from a derived function', () => {
      const result = parseSource(`
        import { T, Derive } from "gt-next";
        ${STEPS}
        function getLabel(index) {
          return steps[index].label;
        }
        export function Component({ index }) {
          return <T>Learn to <Derive>{getLabel(index)}</Derive></T>;
        }
      `);

      expect(result.errors).toHaveLength(0);
      expect(sources(result)).toEqual([
        ['Learn to ', { t: 'Derive', i: 1, c: 'export your reports.' }],
        ['Learn to ', { t: 'Derive', i: 1, c: 'invite your team.' }],
      ]);
    });

    it('resolves each <T> that reads the same array independently', () => {
      const result = parseSource(`
        import { T, Derive } from "gt-next";
        ${STEPS}
        export function First({ index }) {
          return <T>First <Derive>{steps[index].label}</Derive></T>;
        }
        export function Second({ index }) {
          return <T>Second <Derive>{steps[0].label}</Derive></T>;
        }
      `);

      expect(result.errors).toHaveLength(0);
      expect(sources(result)).toEqual([
        ['First ', { t: 'Derive', i: 1, c: 'export your reports.' }],
        ['First ', { t: 'Derive', i: 1, c: 'invite your team.' }],
        ['Second ', { t: 'Derive', i: 1, c: 'export your reports.' }],
      ]);
    });
  });

  describe('autoderive', () => {
    it('resolves a bare member expression like its local alias', () => {
      const direct = parseSource(
        `
          import { T } from "gt-next";
          ${STEPS}
          export function Component({ index }) {
            return <T>Learn to {steps[index].label}</T>;
          }
        `,
        { autoderive: true }
      );
      const alias = parseSource(
        `
          import { T } from "gt-next";
          ${STEPS}
          export function Component({ index }) {
            const label = steps[index].label;
            return <T>Learn to {label}</T>;
          }
        `,
        { autoderive: true }
      );

      expect(direct.errors).toHaveLength(0);
      expect(sources(direct)).toEqual(sources(alias));
      expect(sources(direct)).toEqual([
        ['Learn to ', 'export your reports.'],
        ['Learn to ', 'invite your team.'],
      ]);
    });

    it('still rejects a bare member expression when autoderive is off', () => {
      const result = parseSource(`
        import { T } from "gt-next";
        ${STEPS}
        export function Component({ index }) {
          return <T>Learn to {steps[index].label}</T>;
        }
      `);

      expect(result.updates).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('steps[index].label');
    });
  });

  describe('unresolvable member expressions still error', () => {
    it.each([
      {
        name: 'property of a function parameter',
        preamble: '',
        params: 'props',
        expression: 'props.label',
      },
      {
        name: 'undeclared object',
        preamble: '',
        expression: 'missing[index].label',
      },
      {
        name: 'optional chaining',
        preamble: STEPS,
        expression: 'steps[index]?.label',
      },
      {
        name: 'non-string array entries',
        preamble: STEPS,
        expression: 'steps[index]',
      },
      {
        name: 'property that does not exist on the entries',
        preamble: STEPS,
        expression: 'steps[index].title',
      },
      {
        name: 'array length',
        preamble: STEPS,
        expression: 'steps.length',
      },
      {
        name: 'entry value read from runtime state',
        preamble: `const steps = [{ label: window.location.hash }];`,
        expression: 'steps[index].label',
      },
      {
        name: 'array with a JSX entry',
        preamble: `const items = [<b>bold</b>];`,
        expression: 'items[index]',
      },
      {
        name: 'this-based access',
        preamble: '',
        expression: 'this.label',
      },
    ])('$name', ({ preamble, params, expression }) => {
      const result = expectAliasParity(
        buildPair({
          preamble,
          params,
          jsx: 'Pick <Derive>{EXPR}</Derive>',
          expression,
        })
      );

      expect(result.updates).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('does not resolve a member expression on a let binding', () => {
      const result = parseSource(`
        import { T, Derive } from "gt-next";
        let labels = { home: 'Home' };
        export function Component() {
          return <T>Go <Derive>{labels.home}</Derive></T>;
        }
      `);

      expect(result.updates).toHaveLength(0);
      expect([...result.warnings].join('\n')).toContain('labels');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('reports a member expression once, not twice', () => {
      const result = parseSource(`
        import { T, Derive } from "gt-next";
        const steps = [{ label: window.location.hash }];
        export function Component({ index }) {
          return <T>Pick <Derive>{steps[index].label}</Derive></T>;
        }
      `);

      expect(result.errors).toHaveLength(1);
    });
  });
});
