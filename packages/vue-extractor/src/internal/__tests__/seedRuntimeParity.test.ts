import type { JsxChildren } from '@generaltranslation/format/types';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

type ReactOracleFixture = {
  context?: string;
  expectedHash: string;
  expectedSource: JsxChildren;
  jsx: string;
  name: string;
  sfc: string;
};

const reactCommentBoundaryFixture = {
  name: 'text boundaries separated by a source comment',
  expectedHash: '3bcc07b273d94f01',
  expectedSource: {
    t: 'p',
    i: 1,
    c: ['Before', 'After'],
  },
  sfc: templateFixture('<T><p>Before<!-- source boundary -->After</p></T>'),
  jsx: jsxFixture('<T><p>Before{/* source boundary */}After</p></T>'),
} satisfies ReactOracleFixture;

/**
 * Portable rich-content cases whose source and hashes were produced by React's
 * `prepareT()`. The parent runtime-contract PR exercises the same oracle for
 * the shared cases; these constants keep extraction independently locked to
 * it.
 *
 * Every case is deliberately authored without indentation-only slot text. Vue
 * templates apply their configured whitespace transform before runtime, while
 * JSX applies JavaScript's JSX whitespace transform. Formatting-only source
 * that those compilers normalize differently is therefore not the same runtime
 * input. HTML source comments are also excluded because Vue removes them in
 * production and merges the surrounding text into one runtime VNode.
 */
const reactOracleFixtures = [
  {
    name: 'nested intrinsic elements and exact text boundaries',
    expectedHash: '3c9fbfe0bd03e332',
    expectedSource: {
      t: 'p',
      i: 1,
      c: ['Read ', { t: 'strong', i: 2, c: 'the docs' }, ' today.'],
    },
    sfc: templateFixture('<T><p>Read <strong>the docs</strong> today.</p></T>'),
    jsx: jsxFixture('<T><p>Read <strong>the docs</strong> today.</p></T>'),
  },
  {
    name: 'static custom-component children',
    expectedHash: 'f7cdc234abd75e9f',
    expectedSource: {
      t: 'DocsLink',
      i: 1,
      c: 'Cannot access?',
    },
    sfc: templateFixture(
      '<T><DocsLink to="/docs">Cannot access?</DocsLink></T>',
      "import DocsLink from './DocsLink.vue';"
    ),
    jsx: jsxFixture(
      '<T><DocsLink to="/docs">Cannot access?</DocsLink></T>',
      "import DocsLink from './DocsLink.vue';"
    ),
  },
  {
    name: 'self-closing custom component excludes implementation content',
    expectedHash: 'a013c005483cdd19',
    expectedSource: {
      t: 'DocsLink',
      i: 1,
    },
    sfc: templateFixture(
      '<T><DocsLink to="/docs"/></T>',
      "import DocsLink from './DocsLink.vue';"
    ),
    jsx: jsxFixture(
      '<T><DocsLink to="/docs"/></T>',
      "import DocsLink from './DocsLink.vue';"
    ),
  },
  {
    name: 'nested static custom-component content with a dynamic Var',
    expectedHash: '356b2ca0bdc05769',
    expectedSource: {
      t: 'DocsLink',
      i: 1,
      c: {
        t: 'span',
        i: 2,
        c: ['Hello, ', { i: 3, k: '_gt_value_3', v: 'v' }, '!'],
      },
    },
    sfc: templateFixture(
      '<T><DocsLink to="/docs"><span>Hello, <Var>{{ name }}</Var>!</span></DocsLink></T>',
      "import DocsLink from './DocsLink.vue'; const name = getName();",
      'T, Var'
    ),
    jsx: jsxFixture(
      '<T><DocsLink to="/docs"><span>Hello, <Var>{name}</Var>!</span></DocsLink></T>',
      "import DocsLink from './DocsLink.vue'; const name = getName();",
      'T, Var'
    ),
  },
  {
    name: 'nested custom components',
    expectedHash: '1784f420869fcf17',
    expectedSource: {
      t: 'Callout',
      i: 1,
      c: {
        t: 'DocsLink',
        i: 2,
        c: ['Read ', { t: 'em', i: 3, c: 'the guide' }],
      },
    },
    sfc: templateFixture(
      '<T><Callout><DocsLink to="/docs">Read <em>the guide</em></DocsLink></Callout></T>',
      "import Callout from './Callout.vue'; import DocsLink from './DocsLink.vue';"
    ),
    jsx: jsxFixture(
      '<T><Callout><DocsLink to="/docs">Read <em>the guide</em></DocsLink></Callout></T>',
      "import Callout from './Callout.vue'; import DocsLink from './DocsLink.vue';"
    ),
  },
  {
    name: 'typed and untyped variables',
    expectedHash: '21b7659d399c89fc',
    expectedSource: [
      { i: 1, k: '_gt_value_1', v: 'v' },
      { i: 2, k: '_gt_n_2', v: 'n' },
      { i: 3, k: '_gt_cost_3', v: 'c' },
      { i: 4, k: '_gt_date_4', v: 'd' },
    ],
    sfc: templateFixture(
      '<T><Var>{{ name }}</Var><Num :value="count"/><Currency currency="USD" :value="cost"/><DateTime :value="date"/></T>',
      'const name = getName(); const count = getCount(); const cost = getCost(); const date = getDate();',
      'Currency, DateTime, Num, T, Var'
    ),
    jsx: jsxFixture(
      '<T><Var>{name}</Var><Num value={count}/><Currency currency="USD" value={cost}/><DateTime value={date}/></T>',
      'const name = getName(); const count = getCount(); const cost = getCost(); const date = getDate();',
      'Currency, DateTime, Num, T, Var'
    ),
  },
  {
    name: 'Branch alternatives and fallback content',
    expectedHash: '3bf7c973bd1e6ca3',
    expectedSource: {
      t: 'Branch',
      i: 1,
      d: {
        b: { online: { t: 'strong', i: 2, c: 'Online' } },
        t: 'b',
      },
      c: { t: 'span', i: 2, c: 'Unknown' },
    },
    sfc: templateFixture(
      '<T><Branch branch="online"><template #online><strong>Online</strong></template><span>Unknown</span></Branch></T>',
      '',
      'Branch, T'
    ),
    jsx: jsxFixture(
      '<T><Branch branch="online" v-slots={{ online: () => <strong>Online</strong>, default: () => <span>Unknown</span> }}/></T>',
      '',
      'Branch, T'
    ),
  },
  {
    name: 'Plural alternatives and fallback content',
    expectedHash: 'f440fc6969acdbc8',
    expectedSource: {
      t: 'Plural',
      i: 1,
      d: {
        b: {
          one: { t: 'span', i: 2, c: 'One item' },
          other: { t: 'span', i: 2, c: 'Many items' },
        },
        t: 'p',
      },
      c: { t: 'span', i: 2, c: 'Items' },
    },
    sfc: templateFixture(
      '<T><Plural :n="2"><template #one><span>One item</span></template><template #other><span>Many items</span></template><span>Items</span></Plural></T>',
      '',
      'Plural, T'
    ),
    jsx: jsxFixture(
      '<T><Plural n={2} v-slots={{ one: () => <span>One item</span>, other: () => <span>Many items</span>, default: () => <span>Items</span> }}/></T>',
      '',
      'Plural, T'
    ),
  },
  {
    name: 'custom components inside Branch alternatives',
    expectedHash: 'edf0e94a93bc4cad',
    expectedSource: {
      t: 'Branch',
      i: 1,
      d: {
        b: {
          docs: {
            t: 'DocsLink',
            i: 2,
            c: 'Read the docs',
          },
        },
        t: 'b',
      },
      c: { t: 'span', i: 2, c: 'No destination' },
    },
    sfc: templateFixture(
      '<T><Branch branch="docs"><template #docs><DocsLink to="/docs">Read the docs</DocsLink></template><span>No destination</span></Branch></T>',
      "import DocsLink from './DocsLink.vue';",
      'Branch, T'
    ),
    jsx: jsxFixture(
      '<T><Branch branch="docs" v-slots={{ docs: () => <DocsLink to="/docs">Read the docs</DocsLink>, default: () => <span>No destination</span> }}/></T>',
      "import DocsLink from './DocsLink.vue';",
      'Branch, T'
    ),
  },
  {
    name: 'Branch and Var inside a custom component',
    expectedHash: '954d847862e22fe8',
    expectedSource: {
      t: 'Callout',
      i: 1,
      c: {
        t: 'Branch',
        i: 2,
        d: {
          b: {
            welcome: ['Welcome, ', { i: 3, k: '_gt_value_3', v: 'v' }, '!'],
          },
          t: 'b',
        },
        c: 'Welcome!',
      },
    },
    sfc: templateFixture(
      '<T><Callout><Branch branch="welcome"><template #welcome>Welcome, <Var>{{ name }}</Var>!</template>Welcome!</Branch></Callout></T>',
      "import Callout from './Callout.vue'; const name = getName();",
      'Branch, T, Var'
    ),
    jsx: jsxFixture(
      '<T><Callout><Branch branch="welcome" v-slots={{ welcome: () => <>Welcome, <Var>{name}</Var>!</>, default: () => <>Welcome!</> }}/></Callout></T>',
      "import Callout from './Callout.vue'; const name = getName();",
      'Branch, T, Var'
    ),
  },
  {
    name: 'statically translatable content props',
    expectedHash: '2d16822a26dda28b',
    expectedSource: {
      t: 'button',
      i: 1,
      d: {
        pl: 'Find a guide',
        ti: 'Open docs',
        arl: 'Read the docs',
      },
      c: 'Read',
    },
    sfc: templateFixture(
      '<T><button title="Open docs" aria-label="Read the docs" placeholder="Find a guide">Read</button></T>'
    ),
    jsx: jsxFixture(
      '<T><button title="Open docs" aria-label="Read the docs" placeholder="Find a guide">Read</button></T>'
    ),
  },
  {
    name: 'static context',
    context: 'account navigation',
    expectedHash: '772a8ad7b7535db5',
    expectedSource: { t: 'nav', i: 1, c: 'Account' },
    sfc: templateFixture(
      '<T context="account navigation"><nav>Account</nav></T>'
    ),
    jsx: jsxFixture('<T context="account navigation"><nav>Account</nav></T>'),
  },
] satisfies ReactOracleFixture[];

describe('React-authoritative rich-content extraction contract', () => {
  for (const fixture of reactOracleFixtures) {
    describe(fixture.name, () => {
      it('locks the checked-in React prepareT oracle', () => {
        expect(hashRichSource(fixture.expectedSource, fixture.context)).toBe(
          fixture.expectedHash
        );
      });

      it.each([
        ['Vue SFC template', 'vue', fixture.sfc],
        ['Vue JSX', 'tsx', fixture.jsx],
      ] as const)(
        'extracts the exact semantic wire and hash from %s',
        async (_syntax, extension, sourceCode) => {
          const filename = `/project/src/${toFilename(fixture.name)}.${extension}`;
          const output = await extractFromVueSource(sourceCode, filename, {
            projectRoot: '/project',
          });
          const richResults = output.results.filter(
            ({ dataFormat }) => dataFormat === 'JSX'
          );

          expect(output.errors).toEqual([]);
          expect(output.warnings).toEqual([]);
          expect(output.results).toHaveLength(1);
          expect(richResults).toHaveLength(1);

          const result = richResults[0]!;
          expect(result.metadata.context).toBe(fixture.context);
          expect(normalizeSemanticWire(result.source)).toStrictEqual(
            normalizeSemanticWire(fixture.expectedSource)
          );
          expect(hashRichSource(result.source, result.metadata.context)).toBe(
            fixture.expectedHash
          );
        }
      );
    });
  }

  describe(reactCommentBoundaryFixture.name, () => {
    it('locks the checked-in React prepareT oracle', () => {
      expect(hashRichSource(reactCommentBoundaryFixture.expectedSource)).toBe(
        reactCommentBoundaryFixture.expectedHash
      );
    });

    it('extracts the exact semantic wire and hash from Vue JSX', async () => {
      const output = await extractFromVueSource(
        reactCommentBoundaryFixture.jsx,
        '/project/src/text-boundaries-separated-by-a-source-comment.tsx',
        { projectRoot: '/project' }
      );

      expect(output.errors).toEqual([]);
      expect(output.warnings).toEqual([]);
      expect(output.results).toHaveLength(1);
      expect(normalizeSemanticWire(output.results[0]!.source)).toStrictEqual(
        normalizeSemanticWire(reactCommentBoundaryFixture.expectedSource)
      );
      expect(hashRichSource(output.results[0]!.source)).toBe(
        reactCommentBoundaryFixture.expectedHash
      );
    });

    it('rejects the non-portable Vue SFC comment boundary', async () => {
      const output = await extractFromVueSource(
        reactCommentBoundaryFixture.sfc,
        '/project/src/text-boundaries-separated-by-a-source-comment.vue',
        { projectRoot: '/project' }
      );

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'hash changes between development and production'
      );
    });
  });
});

function templateFixture(template: string, setup = '', imports = 'T'): string {
  return `<script setup lang="ts">import { ${imports} } from 'gt-vue'; ${setup}</script><template>${template}</template>`;
}

function jsxFixture(expression: string, setup = '', imports = 'T'): string {
  return `import { ${imports} } from 'gt-vue'; ${setup} export const View = () => (${expression});`;
}

function hashRichSource(source: JsxChildren, context?: string): string {
  return hashSource({ context, dataFormat: 'JSX', source });
}

/**
 * Removes only diagnostic ordinary-element labels, matching the runtime test.
 *
 * React function names can be minified and Vue component names can be inferred,
 * so `t` is deliberately ignored by `hashSource()` and runtime ID binding. IDs,
 * nesting, content props, branch discriminators, and variable identities remain
 * strict here.
 */
function normalizeSemanticWire(source: JsxChildren): unknown {
  if (Array.isArray(source)) return source.map(normalizeSemanticWire);
  if (typeof source === 'string') return source;
  if ('k' in source) {
    return {
      i: source.i,
      k: source.k,
      ...(source.v && { v: source.v }),
    };
  }

  return {
    i: source.i,
    ...(source.d && {
      d: {
        ...source.d,
        ...(source.d.b && {
          b: Object.fromEntries(
            Object.entries(source.d.b).map(([key, branch]) => [
              key,
              normalizeSemanticWire(branch),
            ])
          ),
        }),
      },
    }),
    ...(source.c !== undefined && { c: normalizeSemanticWire(source.c) }),
  };
}

function toFilename(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}
