/**
 * experimentalStaticRuntime: a per-locale build that leaves the GT runtime
 * out. The main safety net is the equivalence table: each case is built for
 * gt-react's runtime and for the static runtime, and both must render the
 * same text in the build's locale.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import gtUnplugin from '../index';
import type { GTUnpluginOptions } from '../index';
import { clearInlineTranslationsCache } from '../transform/injection/inline-translations/loadInlineTranslations';
import { compileJsx, evaluateModule } from './sourceReplacementHarness';
import { transformWithPlugin } from './transformWithPlugin';

type GTConfig = NonNullable<GTUnpluginOptions['gtConfig']>;
type Module = Record<string, unknown>;

const GT_REACT_DIST = fileURLToPath(
  new URL('../../node_modules/gt-react/dist/', import.meta.url)
);

const IMPORTS = `import { t, plural, selectordinal, select, part, n, number, date, time } from 'gt-react/unstable';`;

const app = (expression: string, params = '{}') =>
  `${IMPORTS}\nexport function App(${params}) {\n  return ${expression};\n}`;

const DATE = new Date(Date.UTC(2024, 0, 15, 12, 30));

type Case = {
  name: string;
  /** Module exporting `App`, a function called with each of `renders` */
  source: string;
  /** The fr catalog entry of the template; undefined leaves it out */
  translation: unknown;
  renders: Record<string, unknown>[];
  /** Whether the fr build renders the translation or, with a warning, the source */
  expected?: 'source';
};

const CASES: Case[] = [
  {
    name: 'text',
    source: app('t`Account settings`'),
    translation: 'Paramètres du compte',
    renders: [{}],
  },
  {
    name: 'a named value',
    source: app('t`Welcome back, ${{ name }}!`', '{ name }'),
    translation: ['Bon retour, ', ['name'], ' !'],
    renders: [
      { name: 'Ada' },
      { name: 42 },
      { name: true },
      { name: null },
      { name: undefined },
      { name: 12n },
      { name: DATE },
    ],
  },
  {
    name: 'a named value that is no text: only an object is formatted',
    source: app('t`Value: ${{ value }}.`', '{ value }'),
    translation: ['Valeur : ', ['value'], '.'],
    renders: [
      { value: { toString: () => 'object' } },
      { value: ['a', 'b'] },
      { value: () => 'function' },
      { value: 0 },
      { value: '' },
      { value: false },
      { value: NaN },
      { value: Symbol('symbol') },
    ],
  },
  {
    name: 'a message that is one value',
    source: app('t`${{ value }}`', '{ value }'),
    translation: [['value']],
    renders: [
      { value: 'text' },
      { value: 7 },
      { value: null },
      { value: DATE },
      { value: Symbol('symbol') },
      { value: { toString: () => 'object' } },
    ],
  },
  {
    name: 'two values and no text',
    source: app('t`${{ first }}${{ second }}`', '{ first, second }'),
    translation: [['second'], ['first']],
    renders: [
      { first: 'a', second: 'b' },
      { first: Symbol('symbol'), second: 'b' },
    ],
  },
  {
    name: 'values written as text or numbers',
    source: app(
      't`Version ${{ major: 2 }}.${{ minor: "x" }} of ${{ name }}`',
      '{ name }'
    ),
    translation: ['Version ', ['major'], '.', ['minor'], ' de ', ['name']],
    renders: [{ name: 'GT' }, { name: null }],
  },
  {
    name: 'text that a template literal reads as syntax',
    source: app('t`Run ${{ command }} now`', '{ command }'),
    translation: ['Lancez `', ['command'], '` : ${pas une valeur} \\ fin\r'],
    renders: [{ command: 'build' }],
  },
  {
    name: 'a value named apart from its expression, and one the translation repeats',
    source: app(
      't`From ${{ from: route.from }} to ${{ to: route.to }}`',
      '{ route }'
    ),
    translation: ['Vers ', ['to'], ' depuis ', ['from'], ' (', ['to'], ')'],
    renders: [{ route: { from: 'Paris', to: 'Lyon' } }],
  },
  {
    name: 'a name the template uses twice',
    source: app('t`${{ name }} and again ${{ name }}`', '{ name }'),
    translation: [['name'], ' et encore ', ['name']],
    renders: [{ name: 'Ada' }],
  },
  {
    name: 'values without a name',
    source: app(
      't`${1 + count} of ${String(total).length > 9 ? 0 : 10}`',
      '{ count, total }'
    ),
    translation: [['_gt_1'], ' sur ', ['_gt_2']],
    renders: [{ count: 2, total: 7 }],
  },
  {
    name: 'a plural with the count',
    source: app(
      't`${plural({ count }, { one: part`${n} invoice ready`, other: part`${n} invoices ready` })}`',
      '{ count }'
    ),
    translation: [
      [
        'count',
        'plural',
        {
          one: [0, ' facture prête'],
          many: [0, ' de factures prêtes'],
          other: [0, ' factures prêtes'],
        },
      ],
    ],
    renders: [
      { count: 0 },
      { count: 1 },
      { count: 2 },
      { count: 1.5 },
      { count: 1234 },
      { count: 1_000_000 },
      { count: -1 },
      { count: '3' },
      { count: ' 1 ' },
      { count: '1e3' },
      { count: 5n },
      { count: 2n ** 70n },
      { count: 'many' },
      { count: null },
      { count: true },
    ],
  },
  {
    name: 'a plural with exact branches, text around it and a value in a branch',
    source: app(
      't`You have ${plural({ count }, { "=0": "no files", one: part`one file from ${{ name }}`, other: part`${n} files from ${{ name }}` })}.`',
      '{ count, name }'
    ),
    translation: [
      'Vous avez ',
      [
        'count',
        'plural',
        {
          '=0': 'aucun fichier',
          one: ['un fichier de ', ['name']],
          other: [0, ' fichiers de ', ['name']],
        },
      ],
      '.',
    ],
    renders: [
      { count: 0, name: 'Ada' },
      { count: 1, name: 'Ada' },
      { count: 12, name: 'Ada' },
    ],
  },
  {
    name: 'a plural of a value without a name',
    source: app(
      't`${plural(count - 1, { one: "one item", other: part`${n} items` })}`',
      '{ count }'
    ),
    translation: [
      ['_gt_1', 'plural', { one: 'un article', other: [0, ' articles'] }],
    ],
    renders: [{ count: 2 }, { count: 4 }],
  },
  {
    name: 'an ordinal',
    source: app(
      't`${selectordinal({ place }, { one: part`${n}st`, two: part`${n}nd`, few: part`${n}rd`, other: part`${n}th` })} place`',
      '{ place }'
    ),
    translation: [
      ['place', 'selectordinal', { one: [0, 're'], other: [0, 'e'] }],
      ' place',
    ],
    renders: [{ place: 1 }, { place: 2 }, { place: 3 }, { place: 11 }],
  },
  {
    name: 'a select',
    source: app(
      't`${select({ role }, { admin: "Manage the workspace", other: "View the workspace" })}`',
      '{ role }'
    ),
    translation: [
      ['role', 'select', { admin: 'Gérer l’espace', other: 'Voir l’espace' }],
    ],
    renders: [
      { role: 'admin' },
      { role: 'member' },
      { role: '' },
      { role: 'toString' },
      { role: 1 },
      { role: null },
    ],
  },
  {
    name: 'a select and a plural without an other branch',
    source: app(
      't`${select({ role }, { admin: "Admin" })} ${plural({ count }, { one: "one" })}`',
      '{ role, count }'
    ),
    translation: [
      ['role', 'select', { admin: 'Administrateur', other: '' }],
      ' ',
      ['count', 'plural', { one: 'un', other: '' }],
    ],
    renders: [
      { role: 'admin', count: 1 },
      { role: 'guest', count: 5 },
    ],
  },
  {
    name: 'a plural inside a select',
    source: app(
      't`${select({ kind }, { file: part`${plural({ count }, { one: "one file", other: part`${n} files` })}`, other: part`${plural({ count }, { one: "one item", other: part`${n} items` })}` })} selected`',
      '{ kind, count }'
    ),
    translation: [
      [
        'kind',
        'select',
        {
          file: [
            ['count', 'plural', { one: 'un fichier', other: [0, ' fichiers'] }],
          ],
          other: [
            ['count', 'plural', { one: 'un élément', other: [0, ' éléments'] }],
          ],
        },
      ],
      ' sélectionné(s)',
    ],
    renders: [
      { kind: 'file', count: 1 },
      { kind: 'file', count: 4 },
      { kind: 'folder', count: 4 },
    ],
  },
  {
    name: 'a number with a style and its formatting context',
    source: app(
      't`Total: ${number({ total }, { style: "currency", currency })} at ${number({ rate }, { style: "percent" })}`',
      '{ total, rate, currency }'
    ),
    translation: [
      'Total : ',
      ['total', 'number', 'currency'],
      ' à ',
      ['rate', 'number', 'percent'],
    ],
    renders: [
      { total: 1234.5, rate: 0.25, currency: 'EUR' },
      { total: 99, rate: 1, currency: 'USD' },
    ],
  },
  {
    name: 'a number without a name',
    source: app('t`${number(amount * 2)} points`', '{ amount }'),
    translation: [['_gt_1', 'number'], ' points'],
    renders: [{ amount: 12345.678 }],
  },
  {
    name: 'a date and a time',
    source: app(
      't`Due ${date({ due }, { style: "long", timeZone: "UTC" })} at ${time({ at }, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}`',
      '{ due, at }'
    ),
    translation: [
      'Échéance le ',
      ['due', 'date', 'long'],
      ' à ',
      ['at', 'time', { hour: 'numeric', minute: '2-digit' }],
    ],
    renders: [{ due: DATE, at: DATE }],
  },
  {
    name: 'a context',
    source: app('t({ context: "button" })`Save ${{ name }}`', '{ name }'),
    translation: ['Enregistrer ', ['name']],
    renders: [{ name: 'draft' }],
  },
  {
    name: 'a translation without the variables of its source',
    source: app('t`Hello ${{ name }}, welcome`', '{ name }'),
    translation: 'Bonjour et bienvenue',
    renders: [{ name: 'Ada' }],
  },
  // Templates whose translation the runtime would not render either
  {
    name: 'a missing translation',
    source: app('t`Missing ${{ name }}`', '{ name }'),
    translation: undefined,
    renders: [{ name: 'Ada' }],
    expected: 'source',
  },
  {
    name: 'a translation that is not a message tree',
    source: app('t`Malformed ${{ name }}`', '{ name }'),
    translation: { text: 'Mal formé' },
    renders: [{ name: 'Ada' }],
    expected: 'source',
  },
  {
    name: 'a translation with a variable its source lacks',
    source: app('t`Unknown ${{ name }}`', '{ name }'),
    translation: ['Inconnu ', ['nom']],
    renders: [{ name: 'Ada' }],
    expected: 'source',
  },
  {
    name: 'a translation that selects on a value its source prints',
    source: app('t`Printed ${{ role }}`', '{ role }'),
    translation: [['role', 'select', { admin: 'Admin', other: 'Autre' }]],
    renders: [{ role: 3 }],
    expected: 'source',
  },
];

/** gt-react's SPA runtime in `locale`, with `catalogs` as its loaded translations. */
async function loadRuntime(
  locale: string,
  catalogs: Record<string, Record<string, unknown>>
): Promise<{
  modules: Record<string, Module>;
  setLocale: (locale: string) => Promise<void>;
}> {
  const cookies = new Map<string, string>();
  vi.stubGlobal('document', {
    get cookie() {
      return Array.from(cookies, ([name, value]) => `${name}=${value}`).join(
        '; '
      );
    },
    set cookie(cookie: string) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    },
  });
  // Test files share a process, and GT keeps the first runtime a process starts
  Reflect.deleteProperty(globalThis, '__generaltranslation');
  const gtReact = (await import(
    path.join(GT_REACT_DIST, 'index.client.mjs')
  )) as Module & {
    initializeGTSPA: (config: unknown) => Promise<void>;
    createOrUpdateBrowserConditionStore: (conditions: object) => void;
    getTranslationsSnapshot: (locale: string) => Promise<unknown>;
  };
  await gtReact.initializeGTSPA({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    locale,
    loadTranslations: async (loaded: string) => catalogs[loaded] ?? {},
  });
  return {
    modules: {
      'gt-react': gtReact,
      'gt-react/unstable': (await import(
        path.join(GT_REACT_DIST, 'unstable.mjs')
      )) as Module,
    },
    setLocale: async (next) => {
      await gtReact.getTranslationsSnapshot(next);
      gtReact.createOrUpdateBrowserConditionStore({ locale: next });
    },
  };
}

function writeTranslations(translations: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-static-runtime-'));
  onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'fr.json'), JSON.stringify(translations));
  return path.join(dir, '[locale].json');
}

/** A static-runtime build for `locale`, embedding `translations` as its fr file. */
function staticOptions(
  locale: 'en' | 'fr',
  translations: Record<string, unknown> = {},
  gtConfig: GTConfig = {}
): GTUnpluginOptions {
  return {
    experimentalStaticLocale: locale,
    experimentalReplaceSource: true,
    experimentalStaticRuntime: true,
    logLevel: 'silent',
    gtConfig: {
      defaultLocale: 'en',
      locales: ['fr'],
      ...gtConfig,
      files: {
        gt: {
          ...gtConfig.files?.gt,
          output: writeTranslations(translations),
          inlineTranslations: { locales: ['fr'] },
        },
      },
    },
  };
}

/** The hash the plugin injects for the one message of `code`. */
async function getHash(source: string): Promise<string> {
  const output = await transformWithPlugin(undefined, compileJsx(source));
  const [hash, ...others] = [
    ...new Set(
      [...(output ?? '').matchAll(/\$?_hash: "([^"]+)"/g)].map(
        (match) => match[1]
      )
    ),
  ];
  if (!hash || others.length) {
    throw new Error(`expected one hash in:\n${source}\n${output}`);
  }
  return hash;
}

describe('experimentalStaticRuntime', () => {
  let staticModules: Record<string, Module>;
  const catalog: Record<string, unknown> = {};
  let loading: ReturnType<typeof loadRuntime> | undefined;

  // Inside the first test that renders, since the plugin helper needs a test to clean up after
  const loadReference = () =>
    (loading ??= (async () => {
      for (const testCase of CASES) {
        if (testCase.translation === undefined) continue;
        catalog[await getHash(testCase.source)] = testCase.translation;
      }
      return loadRuntime('fr', { fr: catalog });
    })());

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    staticModules = {
      'gt-react/static-runtime': (await import(
        path.join(GT_REACT_DIST, 'static-runtime.mjs')
      )) as Module,
      'gt-react/static-runtime/intl': (await import(
        path.join(GT_REACT_DIST, 'static-runtime-intl.mjs')
      )) as Module,
    };
  });

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GT_STATIC_LOCALE', '');
    vi.stubEnv('GT_REPLACE_SOURCE', '');
    vi.stubEnv('GT_STATIC_RUNTIME', '');
    clearInlineTranslationsCache();
  });

  const call = (
    code: string,
    modules: Record<string, Module>,
    renders: Case['renders']
  ) => {
    const { App } = evaluateModule(code, modules) as {
      App: (props: unknown) => unknown;
    };
    return renders.map((props) => {
      try {
        return String(App(props));
      } catch (error) {
        return `throws ${(error as Error).constructor.name}`;
      }
    });
  };

  // Through esbuild first, as a bundler hands a module to the plugin
  const build = async (source: string, options: GTUnpluginOptions) => {
    const output = await transformWithPlugin(options, compileJsx(source));
    if (!output) throw new Error('the plugin left the code alone');
    return output;
  };

  describe('renders templates as gt-react renders them', () => {
    it.each(CASES.map((testCase) => [testCase.name, testCase] as const))(
      '%s',
      async (_name, { source, translation, renders, expected }) => {
        const reference = await loadReference();
        const hash = await getHash(source);
        const runtimeBuild = await build(source, {});
        for (const locale of ['fr', 'en'] as const) {
          await reference.setLocale(locale);
          // Not a spy: the plugin helper restores console.warn after its own
          const warnings: string[] = [];
          const warn = console.warn;
          console.warn = (message: unknown) => warnings.push(String(message));
          const staticBuild = await build(source, {
            ...staticOptions(
              locale,
              translation === undefined ? {} : { [hash]: translation }
            ),
            logLevel: 'warn',
          }).finally(() => {
            console.warn = warn;
          });
          expect(staticBuild).not.toMatch(/from "gt-react(\/unstable)?"/);
          expect(call(staticBuild, staticModules, renders)).toEqual(
            call(runtimeBuild, reference.modules, renders)
          );
          // A build says which messages render their source for want of a translation
          expect(
            warnings.filter((warning) => warning.includes(hash))
          ).toHaveLength(locale === 'fr' && expected === 'source' ? 1 : 0);
        }
      }
    );
  });

  it('writes text as a literal and a message with variables as a call on its tree', async () => {
    const source = `${IMPORTS}
      export function App({ name, count }) {
        return [
          t\`Account settings\`,
          t\`Welcome back, \${{ name }}!\`,
          t\`\${plural({ count }, { one: part\`\${n} invoice\`, other: part\`\${n} invoices\` })}\`,
          t\`Welcome back, \${{ name }}!\`,
        ];
      }`;
    expect(await build(source, staticOptions('en'))).toMatchInlineSnapshot(`
      "import { createStaticFormatter as _createStaticFormatter } from "gt-react/static-runtime";const _gtFormat = /* @__PURE__ */_createStaticFormatter(["en"]);const _gtTree = ["Welcome back, ", ["name"], "!"];const _gtTree2 = [["count", "plural", { one: [0, " invoice"], other: [0, " invoices"] }]];
      function App({ name, count }) {
        return ["Account settings", typeof

        name == "object" && name ? _gtFormat(_gtTree, { name: name }) : \`Welcome back, \${name ?? ""}!\`, _gtFormat(_gtTree2, { count:
          count }), typeof
        name == "object" && name ? _gtFormat(_gtTree, { name: name }) : \`Welcome back, \${name ?? ""}!\`];

      }
      export {
        App };"
    `);
  });

  it('replaces <T> with what it renders and initializeGTSPA with a call that does nothing', async () => {
    const source = compileJsx(`
      import { initializeGTSPA, T } from 'gt-react';
      import { t } from 'gt-react/unstable';
      import { loadTranslations } from './translations';
      export const ready = initializeGTSPA({ defaultLocale: 'en', locales: ['fr'], loadTranslations });
      export function App({ name }) {
        return <T><p>Billing <b>history</b></p></T>;
      }
      export const title = () => t\`Receipts for \${{ name: 'Ada' }}\`;
    `);
    const jsxHash = await getHash(
      compileJsx(`import { T } from 'gt-react';
        export function App() { return <T><p>Billing <b>history</b></p></T>; }`)
    );
    const output = await build(
      source,
      staticOptions('fr', {
        [jsxHash]: {
          t: 'p',
          i: 1,
          c: ['Historique de ', { t: 'b', i: 2, c: 'facturation' }],
        },
        [await getHash(
          `${IMPORTS}\nexport const title = () => t\`Receipts for \${{ name: 'Ada' }}\`;`
        )]: ['Reçus de ', ['name']],
      })
    );
    expect(output).toMatchInlineSnapshot(`
      "import { Fragment as _Fragment } from "react/jsx-runtime";import { jsx, jsxs } from "react/jsx-runtime";


      import { loadTranslations } from "./translations";import { initializeGTSPA } from "gt-react/static-runtime";
      const ready = initializeGTSPA({ defaultLocale: "en", locales: ["fr"], loadTranslations });
      function App({ name }) {
        return /* @__PURE__ */jsx(_Fragment, { children: /* @__PURE__ */jsxs("p", { children: ["Historique de ", /* @__PURE__ */jsx(

              "b", { children: "facturation" })] }) }
        );
      }
      const title = () => \`Reçus de \${"Ada"}\`;
      export {
        App,
        ready,
        title };"
    `);
    const { ready, title } = evaluateModule(output, {
      'react/jsx-runtime': {},
      './translations': {},
      ...staticModules,
    }) as { ready: Promise<void>; title: () => string };
    await expect(ready).resolves.toBeUndefined();
    expect(title()).toBe('Reçus de Ada');
  });

  it('evaluates each value once, in source order, even when the text leaves it out', async () => {
    const source = `${IMPORTS}
      export function App({ log }) {
        const read = (name) => (log.push(name), name);
        return t\`\${{ a: read('a') }} then \${{ b: read('b') }} then \${plural({ c: read(1) }, { other: 'x' })}\`;
      }`;
    const hash = await getHash(source);
    for (const translation of [[['b'], ' puis ', ['a']], 'Sans variable']) {
      const log: string[] = [];
      const output = await build(
        source,
        staticOptions('fr', { [hash]: translation })
      );
      call(output, staticModules, [{ log }]);
      expect(log).toEqual(['a', 'b', 1]);
    }
  });

  describe('fails the build on what still needs the GT runtime', () => {
    it.each([
      [
        'useGT() from gt-react',
        `import { useGT } from 'gt-react';
         export function App() { const gt = useGT(); return gt('Hello'); }`,
        /useGT from "gt-react" needs the GT runtime/,
      ],
      [
        'useGT() from gt-react/unstable',
        `import { useGT } from 'gt-react/unstable';
         export function App() { const gt = useGT(); return gt\`Hello\`; }`,
        /useGT from "gt-react\/unstable" needs the GT runtime/,
      ],
      [
        'msg',
        `import { msg } from 'gt-react/unstable';
         export const label = msg\`Save\`;`,
        /msg from "gt-react\/unstable" needs the GT runtime/,
      ],
      [
        'a locale hook',
        `import { useLocale } from 'gt-react';
         export function App() { return useLocale(); }`,
        /useLocale from "gt-react" needs the GT runtime/,
      ],
      [
        'a provider',
        compileJsx(`import { GTProvider } from 'gt-react';
         export function App({ children }) { return <GTProvider>{children}</GTProvider>; }`),
        /GTProvider from "gt-react" needs the GT runtime/,
      ],
      [
        'a variable component inside <T>',
        compileJsx(`import { T, Num } from 'gt-react';
         export function App({ n }) { return <T>Count: <Num>{n}</Num></T>; }`),
        /Num from "gt-react" needs the GT runtime/,
      ],
      [
        'a <T> the build cannot replace',
        compileJsx(`import { T } from 'gt-react';
         export function App(props) { return <T {...props}>Spread</T>; }`),
        /this <T> cannot be replaced with what it renders: <T> has spread or computed props/,
      ],
      [
        'a template that is not static',
        `${IMPORTS}
         export function App({ value }) { return t\`Hello \${value}\`; }`,
        /this t template is not static/,
      ],
      [
        'a template with maxChars',
        `${IMPORTS}
         export function App() { return t({ maxChars: 5 })\`Hello world\`; }`,
        /this t template sets maxChars/,
      ],
      [
        'a name with two values',
        `${IMPORTS}
         export function App({ a, b }) { return t\`\${{ name: a }} and \${{ name: b }}\`; }`,
        /gives the variable "name" more than one value/,
      ],
      [
        'a re-export',
        `export { T } from 'gt-react';`,
        /T from "gt-react" needs the GT runtime/,
      ],
      [
        'a dynamic import',
        `export const load = () => import('gt-react');`,
        /loading "gt-react" needs the GT runtime/,
      ],
      [
        'an import for its side effects',
        `import 'gt-react/macros';`,
        /importing "gt-react\/macros" for its side effects needs the GT runtime/,
      ],
    ])('%s', async (_name, source, reason) => {
      const error = await build(source, staticOptions('en')).then(
        () => undefined,
        (thrown: Error) => thrown
      );
      expect(error?.message).toMatch(
        /experimentalStaticRuntime is set, but this module still needs the GT runtime/
      );
      expect(error?.message).toMatch(reason);
      // Each reason names its file and line
      expect(error?.message).toMatch(/App\.tsx:\d+/);
    });
  });

  it('leaves alone a module that imports nothing from GT', async () => {
    expect(
      await transformWithPlugin(
        staticOptions('en'),
        `export const double = (value) => value * 2;`
      )
    ).toBeNull();
  });

  describe('options', () => {
    const plugin = (options: GTUnpluginOptions) =>
      gtUnplugin.raw(options, { framework: 'vite' }) as {
        buildStart: (this: unknown) => void;
      };

    it.each([
      ['no static locale', { experimentalReplaceSource: false }],
      ['no source replacement', { experimentalStaticLocale: 'fr' }],
      [
        'a static locale that is not embedded',
        {
          experimentalStaticLocale: 'de',
          experimentalReplaceSource: true,
          gtConfig: { defaultLocale: 'en', locales: ['fr', 'de'] },
        },
      ],
      [
        '_tagIds',
        {
          experimentalStaticLocale: 'en',
          experimentalReplaceSource: true,
          gtConfig: { defaultLocale: 'en', _tagIds: true },
        },
      ],
      [
        'compileTimeHash: false',
        {
          experimentalStaticLocale: 'en',
          experimentalReplaceSource: true,
          compileTimeHash: false,
        },
      ],
    ] as [string, GTUnpluginOptions][])(
      'fails a production build with %s',
      (_name, options) => {
        expect(() =>
          plugin({
            logLevel: 'silent',
            ...options,
            experimentalStaticRuntime: true,
          }).buildStart.call({})
        ).toThrow(/experimentalStaticRuntime is set, but this build does not/);
      }
    );

    it('fails when the locale has no translations file to read', async () => {
      const options = staticOptions('fr');
      fs.rmSync(
        (options.gtConfig!.files!.gt!.output as string).replace(
          '[locale]',
          'fr'
        )
      );
      await expect(build(app('t`Hello`'), options)).rejects.toThrow(
        /experimentalStaticRuntime is set, but this build does not/
      );
    });

    it('changes nothing outside production builds', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const source = app('t`Development ${{ name }}`', '{ name }');
      expect(await transformWithPlugin(staticOptions('en'), source)).toBe(
        await transformWithPlugin({ logLevel: 'silent' }, source)
      );
    });

    it.each([
      ['true', true],
      ['1', true],
      ['false', false],
      ['', false],
    ])('reads GT_STATIC_RUNTIME=%s', async (value, expected) => {
      vi.stubEnv('GT_STATIC_RUNTIME', value);
      const { experimentalStaticRuntime: _, ...options } = staticOptions('en');
      const output = await build(
        app('t`Environment ${{ name }}`', '{ name }'),
        options
      );
      expect(output.includes('gt-react/static-runtime')).toBe(expected);
    });

    it('rejects a GT_STATIC_RUNTIME that is not a boolean', () => {
      vi.stubEnv('GT_STATIC_RUNTIME', 'yes');
      expect(() => gtUnplugin.raw(undefined, { framework: 'vite' })).toThrow(
        /GT_STATIC_RUNTIME is set to "yes"/
      );
    });

    it('formats in the locales and time zone the runtime would resolve', async () => {
      const output = await build(
        app('t`Mapped ${{ name }}`', '{ name }'),
        staticOptions('en', {}, {
          defaultLocale: 'en-US',
          timeZone: 'Asia/Tokyo',
        } as GTConfig)
      );
      expect(output).toContain('(["en-US"], "Asia/Tokyo")');
    });
  });

  it('bundles the static entry without the GT runtime', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-static-bundle-'));
    onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
    const output = await build(
      compileJsx(`
        import { initializeGTSPA, T } from 'gt-react';
        import { t, plural, select, part, n } from 'gt-react/unstable';
        export async function start() { await initializeGTSPA({ defaultLocale: 'en' }); }
        export function App({ name, count, role }) {
          return [
            t\`Account settings\`,
            t\`Welcome back, \${{ name }}!\`,
            t\`\${plural({ count }, { one: part\`\${n} invoice\`, other: part\`\${n} invoices\` })}\`,
            t\`\${select({ role }, { admin: 'Manage', other: 'View' })}\`,
            <T><p>Billing history</p></T>,
          ];
        }
      `),
      staticOptions('en')
    );
    fs.writeFileSync(path.join(dir, 'app.js'), output);
    const { metafile, outputFiles } = buildSync({
      entryPoints: [path.join(dir, 'app.js')],
      bundle: true,
      write: false,
      metafile: true,
      format: 'esm',
      platform: 'browser',
      conditions: ['browser', 'import'],
      minify: true,
      logLevel: 'silent',
      external: ['react', 'react/jsx-runtime', 'react-dom'],
      define: { 'process.env.NODE_ENV': '"production"' },
      nodePaths: [path.join(__dirname, '../../node_modules')],
    });
    const inputs = Object.keys(Object.values(metafile.outputs)[0].inputs);
    // The static entry alone: no cache, config, parser, client, hashing or
    // formatter of the runtime
    expect(
      inputs
        .filter((file) => !file.endsWith('app.js'))
        .map((file) => path.basename(file))
    ).toEqual(['static-runtime.mjs']);
    expect(outputFiles[0].text.length).toBeLessThan(2_500);
  });
});
