import fs, { readFileSync } from 'node:fs';
import path from 'node:path';
import type { JsxChildren } from '@generaltranslation/format';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import {
  MINIMUM_EXACT_SEED_COUNT,
  NON_PORTABLE_SEEDS,
} from '../../../../../test-fixtures/react-vue-seed-contract.js';
import { assertVueCompiles, extractFromVueSource } from './testVueCompiler.js';

describe('React seed oracle parity for the Vue extractor', () => {
  const repositoryRoot = path.resolve(__dirname, '../../../../..');
  const seedRoot = path.join(repositoryRoot, 'tests/seeds');
  const reactSeedIds = collectSeedIds(seedRoot, 'page.tsx');
  const vueSeedIds = collectSeedIds(seedRoot, 'page.vue');
  const nonPortableIds = new Set(NON_PORTABLE_SEEDS.map(({ id }) => id));
  const exactSeedIds = reactSeedIds.filter((id) => !nonPortableIds.has(id));

  it('discovers the same complete seed corpus as the runtime contract', () => {
    expect(reactSeedIds).toHaveLength(84);
    expect(vueSeedIds).toEqual(reactSeedIds);
    expect(exactSeedIds.length).toBeGreaterThanOrEqual(
      MINIMUM_EXACT_SEED_COUNT
    );
  });

  for (const id of exactSeedIds) {
    it(`extracts React's exact semantic wire and hash for ${id}`, async () => {
      const directory = path.join(seedRoot, id);
      const vueFilename = path.join(directory, 'page.vue');
      const vueSource = fs.readFileSync(vueFilename, 'utf8');
      const reactSource = fs.readFileSync(
        path.join(directory, 'page.tsx'),
        'utf8'
      );
      const expectedSource = readJson(
        path.join(directory, 'expected.json')
      ) as JsxChildren;
      const expectedContext = readStaticReactContext(reactSource);
      const output = await extractFromVueSource(vueSource, vueFilename, {
        projectRoot: repositoryRoot,
      });
      const results = output.results.filter(
        ({ dataFormat }) => dataFormat === 'JSX'
      );

      expect(output.errors).toEqual([]);
      expect(output.warnings).toEqual([]);
      expect(results).toHaveLength(1);

      const result = results[0]!;
      expect(result.metadata.context).toBe(expectedContext);
      expect(normalizeSemanticWire(result.source)).toStrictEqual(
        normalizeSemanticWire(expectedSource)
      );
      expect(sourceHash(result.source, result.metadata.context)).toBe(
        sourceHash(expectedSource, expectedContext)
      );
    });
  }

  /** Reads the one static React context form supported by the shared seeds. */
  function readStaticReactContext(source: string): string | undefined {
    const match = source.match(/<T\b[^>]*\bcontext\s*=\s*"([^"]+)"/s);
    return match?.[1];
  }

  /** Removes only diagnostic element labels before framework comparison. */
  function normalizeSemanticWire(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalizeSemanticWire);
    if (!isRecord(value)) return value;

    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, child]) =>
            child !== undefined &&
            (key !== 't' || !('i' in value) || 'k' in value)
        )
        .map(([key, child]) => [key, normalizeSemanticWire(child)])
    );
  }

  function sourceHash(source: JsxChildren, context?: string): string {
    return hashSource({ context, dataFormat: 'JSX', source });
  }

  function readJson(filename: string): unknown {
    return JSON.parse(fs.readFileSync(filename, 'utf8')) as unknown;
  }

  /** Recursively discovers one side of the React/Vue seed contract. */
  function collectSeedIds(directory: string, seedFilename: string): string[] {
    const ids: string[] = [];

    function visit(current: string): void {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      if (
        entries.some((entry) => entry.isFile() && entry.name === seedFilename)
      ) {
        ids.push(path.relative(directory, current).replaceAll(path.sep, '/'));
      }
      for (const entry of entries) {
        if (entry.isDirectory()) visit(path.join(current, entry.name));
      }
    }

    visit(directory);
    return ids.sort();
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
});

describe('React-authoritative rich-content extraction contract', () => {
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
      sfc: templateFixture(
        '<T><p>Read <strong>the docs</strong> today.</p></T>'
      ),
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
      name: 'authored semantic Fragment',
      expectedHash: 'b7817326e13971eb',
      expectedSource: {
        t: 'C1',
        i: 1,
        c: { t: 'strong', i: 2, c: 'Semantic Fragment' },
      },
      sfc: templateFixture(
        '<T><Fragment><strong>Semantic Fragment</strong></Fragment></T>',
        "import { Fragment } from 'vue';"
      ),
      jsx: jsxFixture(
        '<T><VueFragment><strong>Semantic Fragment</strong></VueFragment></T>',
        "import { Fragment as VueFragment } from 'vue';"
      ),
    },
    {
      name: 'authored semantic Fragment explicit default slot',
      expectedHash: '41b3977504b974f9',
      expectedSource: {
        t: 'C1',
        i: 1,
        c: { t: 'em', i: 2, c: 'Explicit default' },
      },
      sfc: templateFixture(
        '<T><Fragment><template #default><em>Explicit default</em></template></Fragment></T>',
        "import { Fragment } from 'vue';"
      ),
      jsx: jsxFixture(
        '<T><VueFragment v-slots={{ default: () => <em>Explicit default</em> }} /></T>',
        "import { Fragment as VueFragment } from 'vue';"
      ),
    },
    {
      name: 'empty authored semantic Fragment',
      expectedHash: 'a013c005483cdd19',
      expectedSource: {
        t: 'C1',
        i: 1,
      },
      sfc: templateFixture(
        '<T><Fragment /></T>',
        "import { Fragment } from 'vue';"
      ),
      jsx: jsxFixture(
        '<T><VueFragment /></T>',
        "import { Fragment as VueFragment } from 'vue';"
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
        `<T><Callout><Branch branch="welcome" v-slots={{
        welcome: () => ['Welcome, ', <Var>{name}</Var>, '!'],
        default: () => 'Welcome!',
      }}/></Callout></T>`,
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

  function templateFixture(
    template: string,
    setup = '',
    imports = 'T'
  ): string {
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
});

describe('React CLI parity audit', () => {
  describe('rich Vue content', () => {
    it('serializes nested branches and public formatter value props', async () => {
      const source = createSfc(
        `
        import {
          Branch,
          Currency,
          DateTime,
          Num,
          Plural,
          T,
          Var,
        } from 'gt-vue';
        const count = 2;
        const name = 'Ada';
        const price = 12;
        const createdAt = new Date();
      `,
        `<T><Branch branch="formal"><template #formal><section><Plural :n="count"><template #one>One <Var>{{ name }}</Var><Num :value="count" /></template><template #other><Currency :value="price" /> on <DateTime :value="createdAt" /></template>Plural fallback</Plural></section></template><template #casual>Casual</template>Branch fallback</Branch><hr /><br /></T>`
      );
      assertVueCompiles(source, 'nested-formatters');

      const output = await extract(source, 'nested-formatters');

      expect(output.errors).toEqual([]);
      expect(richSources(output.results)).toEqual([
        [
          {
            t: 'Branch',
            i: 1,
            d: {
              b: {
                formal: {
                  t: 'section',
                  i: 2,
                  c: {
                    t: 'Plural',
                    i: 3,
                    d: {
                      b: {
                        one: [
                          'One ',
                          { i: 4, k: '_gt_value_4', v: 'v' },
                          { i: 5, k: '_gt_n_5', v: 'n' },
                        ],
                        other: [
                          { i: 4, k: '_gt_cost_4', v: 'c' },
                          ' on ',
                          { i: 5, k: '_gt_date_5', v: 'd' },
                        ],
                      },
                      t: 'p',
                    },
                    c: 'Plural fallback',
                  },
                },
                casual: 'Casual',
              },
              t: 'b',
            },
            c: 'Branch fallback',
          },
          { t: 'hr', i: 2 },
          { t: 'br', i: 3 },
        ],
      ]);
    });

    it('keeps numeric, empty, Unicode, and control branch values static', async () => {
      const source = createSfc(
        `import { Branch, T } from 'gt-vue';`,
        `<T><Branch branch="hex" :hex="0x10" :octal="0o10" :binary="0b10" :scientific="1e2" :negative="-3.5" :smallest="5e-324" :underflow="1e-324" :largest="1.7976931348623157e308" :negativeZero="-0" :epsilon="2.220446049250313e-16" empty="" :disabled="false" :nothing="null" unicode="你好" :control="'\\n\\t'">Fallback</Branch></T>`
      );
      assertVueCompiles(source, 'primitive-branches');

      const output = await extract(source, 'primitive-branches');

      expect(output.errors).toEqual([]);
      expect(richSources(output.results)).toEqual([
        {
          t: 'Branch',
          i: 1,
          d: {
            b: {
              hex: '16',
              octal: '8',
              binary: '2',
              scientific: '100',
              negative: '-3.5',
              smallest: '5e-324',
              underflow: '0',
              largest: '1.7976931348623157e+308',
              negativeZero: '0',
              epsilon: '2.220446049250313e-16',
              empty: '',
              disabled: false,
              nothing: null,
              unicode: '你好',
              control: '\n\t',
            },
            t: 'b',
          },
          c: 'Fallback',
        } as unknown as JsxChildren,
      ]);
    });

    it('extracts legacy and CLDR plural forms together', async () => {
      const source = createSfc(
        `import { Plural, T } from 'gt-vue';`,
        `<T><Plural :n="2" singular="Single" dual="Double" plural="Plural" zero="Zero" one="One" two="Two" few="Few" many="Many" other="Other">Fallback</Plural></T>`
      );
      assertVueCompiles(source, 'plural-forms');

      const output = await extract(source, 'plural-forms');

      expect(output.errors).toEqual([]);
      expect(richSources(output.results)).toEqual([
        {
          t: 'Plural',
          i: 1,
          d: {
            b: {
              singular: 'Single',
              dual: 'Double',
              plural: 'Plural',
              zero: 'Zero',
              one: 'One',
              two: 'Two',
              few: 'Few',
              many: 'Many',
              other: 'Other',
            },
            t: 'p',
          },
          c: 'Fallback',
        },
      ]);
    });

    it('preserves entities, built-ins, custom components, and void elements', async () => {
      const source = createSfc(
        `import { T } from 'gt-vue'; import Card from './Card.vue';`,
        `<T>Hello&nbsp;<Suspense><Card title="Heading">Custom &amp; deep</Card></Suspense><Transition><p>Motion</p></Transition><img alt="Portrait" /><br /></T>`
      );
      assertVueCompiles(source, 'elements');

      const output = await extract(source, 'elements');

      expect(output.errors).toEqual([]);
      expect(richSources(output.results)).toEqual([
        [
          'Hello\u00a0',
          {
            t: 'Suspense',
            i: 1,
            c: {
              t: 'Card',
              i: 2,
              d: { ti: 'Heading' },
              c: 'Custom & deep',
            },
          },
          {
            t: 'Transition',
            i: 3,
            c: { t: 'p', i: 4, c: 'Motion' },
          },
          { t: 'img', i: 5, d: { alt: 'Portrait' } },
          { t: 'br', i: 6 },
        ],
      ]);
    });

    it('preserves empty translations and empty named branches', async () => {
      const source = createSfc(
        `import { Branch, T } from 'gt-vue';`,
        `<T></T><T><Branch branch="formal"><template #formal></template><template #casual>Casual</template></Branch></T>`
      );
      assertVueCompiles(source, 'empty-content');

      const output = await extract(source, 'empty-content');

      expect(output.errors).toEqual([]);
      expect(richSources(output.results)).toEqual([
        undefined,
        {
          t: 'Branch',
          i: 1,
          d: { b: { formal: [], casual: 'Casual' }, t: 'b' },
        },
      ]);
    });

    it('continues to reject value props on Var', async () => {
      const source = createSfc(
        `import { T, Var } from 'gt-vue'; const name = 'Ada';`,
        `<T><Var :value="name">{{ name }}</Var></T>`
      );
      assertVueCompiles(source, 'var-value');

      const output = await extract(source, 'var-value');

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain('unsupported value prop');
    });

    it('serializes immutable primitive globals with Vue display semantics', async () => {
      const source = createSfc(
        `import { T } from 'gt-vue';`,
        `<T>{{ undefined }}{{ NaN }}{{ Infinity }}</T>`
      );
      assertVueCompiles(source, 'special-globals');

      const output = await extract(source, 'special-globals');

      expect(output.errors).toEqual([]);
      expect(output.results.map((result) => result.source)).toEqual([
        'NaNInfinity',
      ]);
    });

    it('gives script bindings precedence over primitive globals', async () => {
      const source = createSfc(
        `
        import { T } from 'gt-vue';
        const undefined = 'local undefined';
        const NaN = 'local NaN';
        const Infinity = 'local Infinity';
      `,
        `<T>{{ undefined }}|{{ NaN }}|{{ Infinity }}</T>`
      );
      assertVueCompiles(source, 'shadowed-special-globals');

      const output = await extract(source, 'shadowed-special-globals');

      expect(output.errors).toEqual([]);
      expect(output.results.map((result) => result.source)).toEqual([
        'local undefined|local NaN|local Infinity',
      ]);
    });

    it.each(['undefined', 'NaN', 'Infinity'])(
      'does not fall back to global %s when a dynamic binding shadows it',
      async (name) => {
        const source = createSfc(
          `import { T } from 'gt-vue'; const ${name} = getValue();`,
          `<T>{{ ${name} }}</T>`
        );
        assertVueCompiles(source, `dynamic-shadow-${name}`);

        const output = await extract(source, `dynamic-shadow-${name}`);

        expect(output.results).toEqual([]);
        expect(output.errors.join('\n')).toContain('dynamic template content');
      }
    );

    it.each(['data', 'setup'])(
      'keeps immutable globals ahead of Options API %s return keys',
      async (method) => {
        const source = `
        <script lang="ts">
          import { T } from 'gt-vue';
          export default {
            components: { T },
            ${method}() {
              return {
                undefined: 'options undefined',
                NaN: 'options NaN',
                Infinity: 'options Infinity',
              };
            },
          };
        </script>
        <template><T>{{ undefined }}|{{ NaN }}|{{ Infinity }}</T></template>
      `;
        assertVueCompiles(source, `options-${method}-special-globals`);

        const output = await extract(
          source,
          `options-${method}-special-globals`
        );

        expect(output.errors).toEqual([]);
        expect(output.results.map((result) => result.source)).toEqual([
          '|NaN|Infinity',
        ]);
      }
    );

    it('serializes unary forms of primitive globals', async () => {
      const source = createSfc(
        `import { T } from 'gt-vue';`,
        `<T>{{ -Infinity }}|{{ +Infinity }}|{{ -NaN }}|{{ +NaN }}|{{ -undefined }}|{{ +undefined }}</T>`
      );
      assertVueCompiles(source, 'unary-special-globals');

      const output = await extract(source, 'unary-special-globals');

      expect(output.errors).toEqual([]);
      expect(output.results.map((result) => result.source)).toEqual([
        '-Infinity|Infinity|NaN|NaN|NaN|NaN',
      ]);
    });
  });

  describe('string calls', () => {
    it('handles encoded nesting, decode exclusions, arrays, and Unicode', async () => {
      const source = createSfc(
        `
        import { msg, useMessages } from 'gt-vue';
        const m = useMessages();
        const raw = 'Raw identifier';
        const encoded = msg('Encoded', { $context: 'encoded' });
        m(raw);
        m(encoded);
        m(msg('Nested', { $context: 'nested' }));
        msg.decode(encoded);
        msg['decode'](encoded);
        msg(['First', \`Second\`], { $context: 'list' });
        msg([]);
        msg(['Only']);
        msg('こんにちは\\n世界', { $context: 'unicode' });
      `,
        `<div />`
      );
      assertVueCompiles(source, 'string-parity');

      const output = await extract(source, 'string-parity');

      expect(output.errors).toEqual([]);
      expect(
        output.results.map((result) => ({
          source: result.source,
          context: result.metadata.context,
        }))
      ).toEqual([
        { source: 'Encoded', context: 'encoded' },
        { source: 'Raw identifier', context: undefined },
        { source: 'Nested', context: 'nested' },
        { source: 'First', context: 'list' },
        { source: 'Second', context: 'list' },
        { source: 'Only', context: undefined },
        { source: 'こんにちは\n世界', context: 'unicode' },
      ]);
    });
  });

  describe('Vue catalog safety', () => {
    it.each([
      {
        name: 'unclosed translation element',
        source: `<script setup>import { msg, T } from 'gt-vue'; msg('Script');</script><template><T>Broken`,
      },
      {
        name: 'invalid closing element',
        source: `<script setup>import { msg, T } from 'gt-vue'; msg('Script');</script><template><T>First</T></Wrong></template>`,
      },
      {
        name: 'duplicate template blocks',
        source: `<script setup>import { msg, T } from 'gt-vue'; msg('Script');</script><template><T>First</T></template><template><T>Second</T></template>`,
      },
    ])('emits no partial catalog for $name', async ({ name, source }) => {
      const output = await extract(source, `malformed-${slug(name)}`);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(
        'Could not parse a gt-vue single-file component'
      );
    });

    it.each([
      {
        name: 'malformed normal script with valid setup',
        source: `<script>import { msg } from 'gt-vue'; msg(</script><script setup>import { T } from 'gt-vue';</script><template><T>Template</T></template>`,
        diagnostic: 'Could not parse a gt-vue script block',
      },
      {
        name: 'valid normal script with malformed setup',
        source: `<script>import { msg } from 'gt-vue'; msg('Normal');</script><script setup>import { T } from 'gt-vue'; const broken = ;</script><template><T>Template</T></template>`,
        diagnostic: 'Could not parse a gt-vue script block',
      },
      {
        name: 'external script block',
        source: `<script src="./logic.ts"></script><template><div /></template>`,
        diagnostic: 'externally sourced Vue script block',
      },
      {
        name: 'unsupported script language',
        source: `<script lang="coffee">msg 'Script'</script><template><div /></template>`,
        diagnostic: 'unsupported Vue script language "coffee"',
      },
      {
        name: 'external template block',
        source: `<script setup>import { msg } from 'gt-vue'; msg('Script');</script><template src="./view.html"></template>`,
        diagnostic: 'externally sourced Vue template',
      },
      {
        name: 'unsupported template language',
        source: `<script setup>import { msg } from 'gt-vue'; msg('Script');</script><template lang="pug">p Template</template>`,
        diagnostic: 'unsupported Vue template language "pug"',
      },
    ])('fails closed for $name', async ({ diagnostic, name, source }) => {
      const output = await extract(source, `unsupported-${slug(name)}`);

      expect(output.results).toEqual([]);
      expect(output.errors.join('\n')).toContain(diagnostic);
    });

    it('keeps valid entries alongside a per-entry semantic diagnostic', async () => {
      const source = createSfc(
        `
        import { msg, T } from 'gt-vue';
        const runtime = String(Date.now());
        msg('Script valid');
      `,
        `<T>Template valid</T><T>{{ runtime }}</T>`
      );
      assertVueCompiles(source, 'semantic-partial');

      const output = await extract(source, 'semantic-partial');

      expect(output.results.map((result) => result.source)).toEqual([
        'Script valid',
        'Template valid',
      ]);
      expect(output.errors).toHaveLength(1);
      expect(output.errors[0]).toContain('dynamic template content');
    });
  });

  function createSfc(script: string, template: string): string {
    return `<script setup lang="ts">${script}</script><template>${template}</template>`;
  }

  function extract(source: string, name: string) {
    return extractFromVueSource(source, `/project/src/${name}.vue`, {
      projectRoot: '/project',
    });
  }

  function richSources(
    results: Awaited<ReturnType<typeof extractFromVueSource>>['results']
  ): JsxChildren[] {
    return results
      .filter((result) => result.dataFormat === 'JSX')
      .map((result) => result.source);
  }

  function slug(value: string): string {
    return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
  }
});

describe('shared rich-content wire format', () => {
  type WireFormatFixture = {
    description: string;
    hash: string;
    id: keyof typeof sources;
    source: JsxChildren;
  };

  const sources = {
    'nested-element': `
    <script setup>
    import { T } from 'gt-vue';
    </script>
    <template><T>Hello <strong>wonderful <em>world</em></strong>.</T></template>
  `,
    'typed-variables': `
    <script setup>
    import { Num, T, Var } from 'gt-vue';
    const count = 3;
    const name = 'Ada';
    </script>
    <template><T>Hello <Var>{{ name }}</Var>, you have <Num :value="count" /> messages.</T></template>
  `,
    'independent-branch-numbering': `
    <script setup>
    import { Branch, T, Var } from 'gt-vue';
    const name = 'Ada';
    </script>
    <template><T><Branch branch="formal"><template #formal><strong>Hello</strong> <Var>{{ name }}</Var></template><template #casual><em>Hi</em> <Var>{{ name }}</Var></template><template #default>Fallback</template></Branch><span>After</span></T></template>
  `,
    'independent-plural-numbering': `
    <script setup>
    import { Num, Plural, T } from 'gt-vue';
    const count = 2;
    </script>
    <template><T><Plural :n="count"><template #one>One <Num :value="1" /></template><template #other>Many <Num :value="count" /></template><template #default>Fallback</template></Plural><span>After</span></T></template>
  `,
  } satisfies Record<string, string>;

  const fixtures = JSON.parse(
    readFileSync(
      new URL(
        '../../../../../test-fixtures/rich-content-wire-format.json',
        import.meta.url
      ),
      'utf8'
    )
  ) as WireFormatFixture[];

  it.each(fixtures)('$id: $description', async (fixture) => {
    const output = await extractFromVueSource(
      sources[fixture.id],
      `${fixture.id}.vue`
    );
    const richResults = output.results.filter(
      (result) => result.dataFormat === 'JSX'
    );

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(richResults).toHaveLength(1);
    expect(richResults[0].source).toEqual(fixture.source);
    expect(
      hashSource({ dataFormat: 'JSX', source: richResults[0].source })
    ).toBe(fixture.hash);
  });
});
