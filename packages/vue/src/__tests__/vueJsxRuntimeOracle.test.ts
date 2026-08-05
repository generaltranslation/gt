import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { JsxChildren } from '@generaltranslation/format/types';
import { extractFromVueSource } from '@generaltranslation/vue-extractor';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { hashSource } from 'generaltranslation/id';
import {
  build,
  createServer,
  type InlineConfig,
  type ViteDevServer,
} from 'vite';
import {
  createSSRApp,
  isVNode,
  type Component,
  type Slots,
  type VNode,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import { serializeVueChildren } from '../rendering/translateVueChildren';

const temporaryDirectories: string[] = [];

const oracleSource = `
import { defineComponent, Suspense, Transition } from 'vue';
import * as Vue from 'vue';
import * as GT from 'gt-vue';

const Fragment = () => 'not a Vue fragment';
const Wait = Suspense;
const name = 'Ada';
const count = 2;
const amount = 12.5;
const updatedAt = new Date('2024-01-02T00:00:00.000Z');

const InfoBox = defineComponent({
  name: 'InfoBox',
  setup(_props, { slots }) {
    return () => <aside>{slots.default?.()}</aside>;
  },
});

export const createGT = GT.createGT;

export const WhitespaceCase = () => (
  <GT.T context="oracle whitespace">
	Alpha
	Beta	Gamma {'A'}{'B'}{1}
    <span title="Static title">Nested <strong aria-label="Static label">text</strong>{' tail'}</span>
    <button on={{ click: () => undefined }}>Event action</button>
  </GT.T>
);

export const FragmentCase = () => (
  <GT.T context="oracle fragments"><>short</><Fragment><em>literal</em></Fragment><Vue.Fragment><i>namespace</i></Vue.Fragment></GT.T>
);

export const VariableCase = () => (
  <GT.T context="oracle variables"><GT.Var>{name}</GT.Var>|<GT.Num value={count} />|<GT.Currency currency="EUR" value={amount} />|<GT.DateTime value={updatedAt} options={{ day: 'numeric', month: 'long', timeZone: 'UTC', year: 'numeric' }} /></GT.T>
);

export const BranchCase = () => (
  <GT.T context="oracle branches"><GT.Branch branch="formal" v-slots={{
    default: () => <p>Default <u>tone</u></p>,
    formal: () => <section>Formal <GT.Var>{name}</GT.Var></section>,
    casual: () => <aside>Casual <GT.Var>{name}</GT.Var></aside>,
  }} /><GT.Plural n={count} v-slots={{
    default: () => <b>Default count</b>,
    one: () => <span>One <GT.Num value={count} /></span>,
    other: () => <div>Many <GT.Num value={count} /></div>,
  }} /></GT.T>
);

export const OpaqueCase = () => (
  <GT.T context="oracle opaque"><InfoBox title="Box title"><span>Opaque body</span></InfoBox><Transition><em>Transition body</em></Transition></GT.T>
);

export const DynamicTagCase = (useMark = true) => {
  const ElementTag = useMark ? 'mark' : 'small';
  return <GT.T context="oracle dynamic tag"><ElementTag>Aliased element</ElementTag></GT.T>;
};

export const SuspenseCase = () => (
  <GT.T context="oracle suspense"><Suspense title="Boundary" v-slots={{ fallback: () => <i>Fallback direct</i> }}><section>Direct</section></Suspense><Wait v-slots={{ default: () => <article>Alias</article>, fallback: () => <i>Fallback alias</i> }} /><Vue.Suspense>{() => <div>Namespace</div>}</Vue.Suspense></GT.T>
);

export default defineComponent({
  name: 'OracleApp',
  setup() {
    return () => (
      <main>
        <WhitespaceCase />
        <FragmentCase />
        <VariableCase />
        <BranchCase />
        <OpaqueCase />
        <DynamicTagCase />
        <SuspenseCase />
      </main>
    );
  },
});
`.replace(/\n/g, '\r\n');

type OracleCase = {
  context: string;
  exportName:
    | 'BranchCase'
    | 'DynamicTagCase'
    | 'FragmentCase'
    | 'OpaqueCase'
    | 'SuspenseCase'
    | 'VariableCase'
    | 'WhitespaceCase';
  /** Runtime-only label differences that hashing intentionally sanitizes. */
  runtimeSource?: JsxChildren;
  source: JsxChildren;
  target: JsxChildren;
};

const oracleCases: OracleCase[] = [
  {
    context: 'oracle whitespace',
    exportName: 'WhitespaceCase',
    source: [
      'Alpha Beta Gamma AB1',
      {
        c: [
          'Nested ',
          {
            c: 'text',
            d: { arl: 'Static label' },
            i: 2,
            t: 'strong',
          },
          ' tail',
        ],
        d: { ti: 'Static title' },
        i: 1,
        t: 'span',
      },
      { c: 'Event action', i: 3, t: 'button' },
    ],
    target: [
      'Préface ',
      {
        c: [
          'Imbriqué ',
          {
            c: 'fort',
            d: { arl: 'Étiquette traduite' },
            i: 2,
            t: 'strong',
          },
          ' fin',
        ],
        d: { ti: 'Titre traduit' },
        i: 1,
        t: 'span',
      },
      { c: 'Action traduite', i: 3, t: 'button' },
    ],
  },
  {
    context: 'oracle fragments',
    exportName: 'FragmentCase',
    source: [
      'short',
      { c: 'literal', i: 1, t: 'em' },
      { c: 'namespace', i: 2, t: 'i' },
    ],
    target: [
      { c: 'espace de noms', i: 2, t: 'i' },
      ' / ',
      { c: 'littéral', i: 1, t: 'em' },
      { c: 'répété', i: 1, t: 'em' },
    ],
  },
  {
    context: 'oracle variables',
    exportName: 'VariableCase',
    source: [
      { i: 1, k: '_gt_value_1', v: 'v' },
      '|',
      { i: 2, k: '_gt_n_2', v: 'n' },
      '|',
      { i: 3, k: '_gt_cost_3', v: 'c' },
      '|',
      { i: 4, k: '_gt_date_4', v: 'd' },
    ],
    target: [
      { i: 4, k: '_gt_date_4', v: 'd' },
      '|',
      { i: 1, k: '_gt_value_1', v: 'v' },
      '|',
      { i: 3, k: '_gt_cost_3', v: 'c' },
      '|',
      { i: 2, k: '_gt_n_2', v: 'n' },
    ],
  },
  {
    context: 'oracle branches',
    exportName: 'BranchCase',
    source: [
      {
        c: {
          c: ['Default ', { c: 'tone', i: 3, t: 'u' }],
          i: 2,
          t: 'p',
        },
        d: {
          b: {
            casual: {
              c: ['Casual ', { i: 3, k: '_gt_value_3', v: 'v' }],
              i: 2,
              t: 'aside',
            },
            formal: {
              c: ['Formal ', { i: 3, k: '_gt_value_3', v: 'v' }],
              i: 2,
              t: 'section',
            },
          },
          t: 'b',
        },
        i: 1,
        t: 'Branch',
      },
      {
        c: { c: 'Default count', i: 5, t: 'b' },
        d: {
          b: {
            one: {
              c: ['One ', { i: 6, k: '_gt_n_6', v: 'n' }],
              i: 5,
              t: 'span',
            },
            other: {
              c: ['Many ', { i: 6, k: '_gt_n_6', v: 'n' }],
              i: 5,
              t: 'div',
            },
          },
          t: 'p',
        },
        i: 4,
        t: 'Plural',
      },
    ],
    target: [
      {
        c: { c: 'Repli', i: 2, t: 'p' },
        d: {
          b: {
            casual: { c: 'Familier', i: 2, t: 'aside' },
            formal: {
              c: ['Formel ', { i: 3, k: '_gt_value_3', v: 'v' }],
              i: 2,
              t: 'section',
            },
          },
          t: 'b',
        },
        i: 1,
        t: 'Branch',
      },
      {
        c: { c: 'Quantité', i: 5, t: 'b' },
        d: {
          b: {
            one: {
              c: ['Un ', { i: 6, k: '_gt_n_6', v: 'n' }],
              i: 5,
              t: 'span',
            },
            other: {
              c: ['Plusieurs ', { i: 6, k: '_gt_n_6', v: 'n' }],
              i: 5,
              t: 'div',
            },
          },
          t: 'p',
        },
        i: 4,
        t: 'Plural',
      },
    ],
  },
  {
    context: 'oracle opaque',
    exportName: 'OpaqueCase',
    source: [
      { d: { ti: 'Box title' }, i: 1, t: 'InfoBox' },
      { i: 2, t: 'Transition' },
    ],
    // Vue's Transition type is anonymous. The runtime therefore uses its
    // deterministic C{id} fallback, while extraction retains the source tag
    // for catalog readability. IDs and hashes must still match exactly.
    runtimeSource: [
      { d: { ti: 'Box title' }, i: 1, t: 'InfoBox' },
      { i: 2, t: 'C2' },
    ],
    target: [
      {
        c: 'must not replace the opaque slot',
        d: { ti: 'Titre de boîte' },
        i: 1,
        t: 'InfoBox',
      },
      {
        c: 'must not replace Transition content',
        i: 2,
        t: 'Transition',
      },
    ],
  },
  {
    context: 'oracle dynamic tag',
    exportName: 'DynamicTagCase',
    source: { c: 'Aliased element', i: 1, t: 'ElementTag' },
    // Element names are deliberately excluded from hashes. Both possible
    // runtime types are string elements and therefore traverse identically.
    runtimeSource: { c: 'Aliased element', i: 1, t: 'mark' },
    target: { c: 'Élément traduit', i: 1, t: 'ElementTag' },
  },
  {
    context: 'oracle suspense',
    exportName: 'SuspenseCase',
    source: [
      {
        c: { c: 'Direct', i: 2, t: 'section' },
        d: { ti: 'Boundary' },
        i: 1,
        t: 'Suspense',
      },
      {
        c: { c: 'Alias', i: 4, t: 'article' },
        i: 3,
        t: 'Suspense',
      },
      {
        c: { c: 'Namespace', i: 6, t: 'div' },
        i: 5,
        t: 'Suspense',
      },
    ],
    target: [
      {
        c: { c: 'Direct traduit', i: 2, t: 'section' },
        d: { ti: 'Frontière' },
        i: 1,
        t: 'Suspense',
      },
      {
        c: { c: 'Alias traduit', i: 4, t: 'article' },
        i: 3,
        t: 'Suspense',
      },
      {
        c: { c: 'Espace traduit', i: 6, t: 'div' },
        i: 5,
        t: 'Suspense',
      },
    ],
  },
];

type OracleModule = {
  BranchCase: () => VNode;
  DynamicTagCase: () => VNode;
  FragmentCase: () => VNode;
  OpaqueCase: () => VNode;
  SuspenseCase: () => VNode;
  VariableCase: () => VNode;
  WhitespaceCase: () => VNode;
  createGT: (typeof import('gt-vue'))['createGT'];
  default: Component;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

/** Loads the exact same TSX fixture through Vite's dev or production pipeline. */
async function loadOracleModule(
  directory: string,
  mode: 'development' | 'production',
  pluginOptions: Parameters<typeof vueJsx>[0]
): Promise<{
  close: () => Promise<void>;
  module: OracleModule;
}> {
  const config: InlineConfig = {
    appType: 'custom',
    logLevel: 'silent',
    plugins: [vueJsx(pluginOptions)],
    root: directory,
  };
  if (mode === 'development') {
    const server: ViteDevServer = await createServer({
      ...config,
      server: { middlewareMode: true },
    });
    return {
      close: () => server.close(),
      module: (await server.ssrLoadModule('/entry.tsx')) as OracleModule,
    };
  }

  const outDir = join(directory, 'dist');
  await build({
    ...config,
    build: {
      emptyOutDir: true,
      minify: 'esbuild',
      outDir,
      rollupOptions: {
        output: { entryFileNames: 'entry.mjs' },
      },
      ssr: 'entry.tsx',
    },
  });
  const module = (await import(
    `${pathToFileURL(join(outDir, 'entry.mjs')).href}?${Date.now()}`
  )) as OracleModule;
  return { close: async () => {}, module };
}

/** Invokes a controlled T slot without speculatively running user components. */
function readTranslationChildren(factory: () => VNode): VNode[] {
  const translation = factory();
  expect(isVNode(translation)).toBe(true);
  const slots = translation.children as Slots;
  const children = slots.default?.() ?? [];
  return (Array.isArray(children) ? children : [children]) as VNode[];
}

describe.each(['development', 'production'] as const)(
  'Vue JSX %s runtime oracle',
  (mode) => {
    it.each([
      { name: 'default plugin options', options: undefined },
      {
        name: 'proven hash-neutral optimize option',
        options: {
          optimize: true,
        },
      },
    ])(
      'matches source, hashes, and rendering with $name',
      async ({ options }) => {
        const directory = await mkdtemp(
          join(process.cwd(), '.vue-jsx-oracle-')
        );
        temporaryDirectories.push(directory);
        const entry = join(directory, 'entry.tsx');
        await writeFile(entry, oracleSource);

        const extraction = await extractFromVueSource(oracleSource, entry, {
          projectRoot: directory,
        });
        expect(extraction.errors).toEqual([]);
        expect(extraction.results).toHaveLength(oracleCases.length);

        const loaded = await loadOracleModule(directory, mode, options);
        try {
          const targets: Record<string, JsxChildren> = {};
          for (const oracleCase of oracleCases) {
            const extracted = extraction.results.find(
              (result) => result.metadata.context === oracleCase.context
            );
            expect(extracted).toBeDefined();
            expect(extracted).toMatchObject({
              dataFormat: 'JSX',
              source: oracleCase.source,
            });

            const runtimeSource = serializeVueChildren(
              readTranslationChildren(loaded.module[oracleCase.exportName])
            );
            expect(runtimeSource).toEqual(
              oracleCase.runtimeSource ?? oracleCase.source
            );

            const extractedHash = hashSource({
              context: oracleCase.context,
              dataFormat: 'JSX',
              source: extracted!.source,
            });
            const runtimeHash = hashSource({
              context: oracleCase.context,
              dataFormat: 'JSX',
              source: runtimeSource,
            });
            expect(runtimeHash).toBe(extractedHash);
            targets[extractedHash] = oracleCase.target;
          }

          const observedHashes: string[] = [];
          const catalog = new Proxy(targets, {
            get(target, key, receiver) {
              if (
                typeof key === 'string' &&
                Object.prototype.hasOwnProperty.call(target, key)
              ) {
                observedHashes.push(key);
              }
              return Reflect.get(target, key, receiver);
            },
          });
          const gt = loaded.module.createGT({
            locale: 'fr',
            loadTranslations: async () => catalog,
          });
          await gt.loadTranslations('fr');
          const app = createSSRApp(loaded.module.default);
          app.use(gt);
          const html = await renderToString(app);
          const visibleHtml = html.replace(/<!--(?:\[|\])-->/g, '');

          expect(new Set(observedHashes)).toEqual(
            new Set(Object.keys(targets))
          );
          expect(visibleHtml).toContain(
            '<span title="Titre traduit">Imbriqué <strong aria-label="Étiquette traduite">fort</strong> fin</span>'
          );
          expect(visibleHtml).toContain(
            '<i>espace de noms</i> / <em>littéral</em><em>répété</em>'
          );
          expect(visibleHtml).toContain('<section>Formel Ada</section>');
          expect(visibleHtml).toContain('<div>Plusieurs 2</div>');
          expect(visibleHtml).toContain('<aside title="Titre de boîte">');
          expect(visibleHtml).toContain('<span>Opaque body</span>');
          expect(visibleHtml).toContain('<em>Transition body</em>');
          expect(visibleHtml).not.toContain('must not replace');
          expect(visibleHtml).toContain('<mark>Élément traduit</mark>');
          expect(visibleHtml).toContain('<section>Direct traduit</section>');
          expect(visibleHtml).toContain('<article>Alias traduit</article>');
          expect(visibleHtml).toContain('<div>Espace traduit</div>');
          expect(visibleHtml).not.toContain('Fallback direct');
          expect(visibleHtml).not.toContain('Fallback alias');

          const dateIndex = visibleHtml.indexOf('janvier');
          const nameIndex = visibleHtml.indexOf('Ada', dateIndex);
          const currencyIndex = visibleHtml.indexOf('€', nameIndex);
          const numberIndex = visibleHtml.indexOf('2', currencyIndex);
          expect(dateIndex).toBeGreaterThan(-1);
          expect(nameIndex).toBeGreaterThan(dateIndex);
          expect(currencyIndex).toBeGreaterThan(nameIndex);
          expect(numberIndex).toBeGreaterThan(currencyIndex);
        } finally {
          await loaded.close();
        }
      }
    );
  }
);
