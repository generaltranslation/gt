/**
 * experimentalPrecomputeJsx: a production build turns each static `<T>` into a
 * precomputed component. The main safety net is the equivalence table: each
 * case renders the build with and without precomputing in gt-react, in every
 * locale, and the HTML must match.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
import {
  compileJsx,
  evaluateModule,
  getInjectedHash,
  loadGTRuntime,
  type GTRuntime,
} from './sourceReplacementHarness';
import { transformWithPlugin } from './transformWithPlugin';

type GTConfig = NonNullable<GTUnpluginOptions['gtConfig']>;

const LOCALES = ['fr', 'ja'] as const;
type Locale = (typeof LOCALES)[number];

type Case = {
  name: string;
  /** Module exporting `App`, a component rendered with each of `renders` */
  source: string;
  /** The catalog entry of the call site per locale; a locale left out has none */
  translations: Partial<Record<Locale, unknown>>;
  renders: Record<string, unknown>[];
  /** The component the call site becomes, or `kept` when it stays a `<T>` */
  expected: 'text' | 'jsx' | 'kept';
  gtConfig?: GTConfig;
};

const IMPORTS = `import { T, Var, Num, Currency, DateTime, RelativeTime, Plural, Branch } from 'gt-react';`;

const app = (body: string, params = '{}') =>
  `${IMPORTS}\nexport function App(${params}) {\n  return ${body};\n}`;

const DATE = new Date(Date.UTC(2024, 0, 15, 12));

const CASES: Case[] = [
  {
    name: 'plain text',
    source: app('<T>Hello world</T>'),
    translations: { fr: 'Bonjour le monde', ja: 'こんにちは世界' },
    renders: [{}],
    expected: 'text',
  },
  {
    name: 'a single element with text',
    source: app('<T><p>Simple paragraph</p></T>'),
    translations: {
      fr: { t: 'p', i: 1, c: 'Paragraphe simple' },
      ja: { i: 1, c: '簡単な段落' },
    },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'a nested element with props',
    source: app(
      '<T>Hello, <b className={cls} data-test="x">World!</b></T>',
      '{ cls }'
    ),
    translations: {
      fr: ['Bonjour, ', { t: 'b', i: 1, c: 'le Monde !' }],
      ja: [{ t: 'b', i: 1, c: '世界' }, 'こんにちは'],
    },
    renders: [{ cls: 'greeting' }],
    expected: 'jsx',
  },
  {
    name: 'elements nested in elements',
    source: app(
      '<T><p className="lead">Read <a href={url}>the <b>full</b> guide</a> today</p></T>',
      '{ url }'
    ),
    translations: {
      fr: {
        t: 'p',
        i: 1,
        c: [
          'Lisez ',
          {
            t: 'a',
            i: 2,
            c: ['le guide ', { t: 'b', i: 3, c: 'complet' }],
          },
          " aujourd'hui",
        ],
      },
    },
    renders: [{ url: '/guide' }],
    expected: 'jsx',
  },
  {
    name: 'elements reordered by the translation',
    source: app('<T><b>red</b> <i>car</i></T>'),
    translations: {
      fr: [{ t: 'i', i: 2, c: 'voiture' }, ' ', { t: 'b', i: 1, c: 'rouge' }],
    },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'self-closing elements',
    source: app('<T>First line<br />second line <img src="/x.png" /></T>'),
    translations: {
      fr: [
        'Première ligne',
        { t: 'br', i: 1 },
        'deuxième ligne ',
        { t: 'img', i: 2 },
      ],
    },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'a translated title on an element with children',
    source: app(
      '<T><abbr title="World Health Organization">WHO</abbr> guidance</T>'
    ),
    translations: {
      fr: [
        {
          t: 'abbr',
          i: 1,
          d: { ti: 'Organisation mondiale de la Santé' },
          c: 'OMS',
        },
        ' recommandations',
      ],
      // Leaves the title out, which keeps the source title
      ja: [{ t: 'abbr', i: 1, c: 'WHO' }, ' ガイダンス'],
    },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'a translated aria-label next to a spread',
    source: app(
      '<T><a {...link} aria-label="Read more">More</a></T>',
      '{ link }'
    ),
    translations: {
      fr: { t: 'a', i: 1, d: { arl: 'Lire la suite' }, c: 'Plus' },
    },
    renders: [{ link: { href: '/more', className: 'cta' } }],
    expected: 'jsx',
  },
  {
    name: 'an alt on an element without children',
    source: app('<T>A <img alt="cat" src="/c.png" /></T>'),
    translations: { fr: ['Un ', { t: 'img', i: 1, d: { alt: 'chat' } }] },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'a fragment',
    source: app('<T><>Hello <b>you</b></></T>'),
    translations: {
      fr: { t: 'C1', i: 1, c: ['Salut ', { t: 'b', i: 2, c: 'toi' }] },
    },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'whitespace and newlines',
    source: app(`<T>
      Hello,{' '}
      <b>  spaced  </b>   world
    </T>`),
    translations: {
      fr: [' Bonjour, ', { t: 'b', i: 1, c: '  espacé  ' }, '\n monde '],
    },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'entities and characters HTML escapes',
    source: app('<T>Fish &amp; chips&nbsp;&lt;3</T>'),
    translations: { fr: 'Poisson & frites <3 "maison"' },
    renders: [{}],
    expected: 'text',
  },
  {
    name: 'text split into several children',
    source: app(`<T>Split {"text"} here</T>`),
    translations: { fr: 'Texte divisé ici' },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: '<Var>',
    source: app('<T>Hi <Var>{name}</Var>, welcome!</T>', '{ name }'),
    translations: {
      fr: ['Salut ', { k: '_gt_value_1', i: 1, v: 'v' }, ', bienvenue !'],
      ja: [{ k: '_gt_value_1', i: 1, v: 'v' }, 'さん、ようこそ！'],
    },
    renders: [{ name: 'Ada' }],
    expected: 'jsx',
  },
  {
    name: 'named variables the translation reorders and repeats',
    source: app(
      '<T>From <Var name="from">{a}</Var> to <Var name="to">{b}</Var></T>',
      '{ a, b }'
    ),
    translations: {
      fr: [
        'Vers ',
        { k: 'to', i: 2, v: 'v' },
        ' depuis ',
        { k: 'from', i: 1, v: 'v' },
        ' (',
        { k: 'to', i: 2, v: 'v' },
        ')',
      ],
    },
    renders: [{ a: 'Paris', b: 'Lyon' }],
    expected: 'jsx',
  },
  {
    name: '<Var> holding an element',
    source: app('<T>Signed in as <Var><b>{name}</b></Var></T>', '{ name }'),
    translations: {
      fr: ['Connecté en tant que ', { k: '_gt_value_1', i: 1, v: 'v' }],
    },
    renders: [{ name: 'Ada' }],
    expected: 'jsx',
  },
  {
    name: '<Num> with options',
    source: app(
      "<T>Progress: <Num options={{ style: 'percent' }}>{ratio}</Num></T>",
      '{ ratio }'
    ),
    translations: { fr: ['Progression : ', { k: '_gt_n_1', i: 1, v: 'n' }] },
    renders: [{ ratio: 0.256 }, { ratio: 1234.5 }],
    expected: 'jsx',
  },
  {
    name: '<Currency>',
    source: app(
      '<T>Total: <Currency currency="EUR">{price}</Currency></T>',
      '{ price }'
    ),
    translations: {
      fr: ['Total : ', { k: '_gt_cost_1', i: 1, v: 'c' }],
      ja: ['合計: ', { k: '_gt_cost_1', i: 1, v: 'c' }],
    },
    renders: [{ price: 1234.5 }],
    expected: 'jsx',
  },
  {
    name: '<DateTime>',
    source: app(
      "<T>Due <DateTime options={{ dateStyle: 'long', timeZone: 'UTC' }}>{due}</DateTime></T>",
      '{ due }'
    ),
    translations: {
      fr: ['Échéance le ', { k: '_gt_date_1', i: 1, v: 'd' }],
      ja: [{ k: '_gt_date_1', i: 1, v: 'd' }, 'が期限'],
    },
    renders: [{ due: DATE }],
    expected: 'jsx',
  },
  {
    name: '<Plural> with a branch the source lacks',
    source: app(
      '<T><Plural n={n} one="One item" other="Many items" /></T>',
      '{ n }'
    ),
    translations: {
      fr: {
        t: 'Plural',
        i: 1,
        d: {
          t: 'p',
          b: {
            one: 'Un article',
            many: "Beaucoup d'articles",
            other: 'Des articles',
          },
        },
      },
      ja: { t: 'Plural', i: 1, d: { t: 'p', b: { other: 'アイテム' } } },
    },
    renders: [
      { n: 0 },
      { n: 1 },
      { n: 2 },
      { n: 1.5 },
      { n: 1_000_000 },
      { n: '3' },
    ],
    expected: 'jsx',
  },
  {
    name: '<Plural> with elements and variables in its branches',
    source: app(
      '<T>You have <Plural n={n} one={<><b>one</b> message</>} other={<><Num>{n}</Num> messages</>} /></T>',
      '{ n }'
    ),
    translations: {
      fr: [
        'Vous avez ',
        {
          t: 'Plural',
          i: 1,
          d: {
            t: 'p',
            b: {
              one: {
                t: 'C2',
                i: 2,
                c: [{ t: 'b', i: 3, c: 'un' }, ' message'],
              },
              many: {
                t: 'C2',
                i: 2,
                c: [{ k: '_gt_n_3', i: 3, v: 'n' }, ' de messages'],
              },
              other: {
                t: 'C2',
                i: 2,
                c: [{ k: '_gt_n_3', i: 3, v: 'n' }, ' messages'],
              },
            },
          },
        },
      ],
    },
    renders: [{ n: 0 }, { n: 1 }, { n: 7 }, { n: 1_000_000 }],
    expected: 'jsx',
  },
  {
    name: '<Plural> with children, inside an element',
    source: app(
      '<T><p>You have <Plural n={n} one="one task">several tasks</Plural></p></T>',
      '{ n }'
    ),
    translations: {
      fr: {
        t: 'p',
        i: 1,
        c: [
          'Vous avez ',
          {
            t: 'Plural',
            i: 2,
            d: { t: 'p', b: { one: 'une tâche' } },
            c: 'plusieurs tâches',
          },
        ],
      },
    },
    renders: [{ n: 1 }, { n: 3 }, { n: undefined }],
    expected: 'jsx',
  },
  {
    name: '<Branch>',
    source: app(
      '<T><Branch branch={mode} dark={<b>Dark</b>} light="Light">Auto</Branch> theme</T>',
      '{ mode }'
    ),
    translations: {
      fr: [
        {
          t: 'Branch',
          i: 1,
          d: {
            t: 'b',
            b: { dark: { t: 'b', i: 2, c: 'Sombre' }, light: 'Clair' },
          },
          c: 'Automatique',
        },
        ' (thème)',
      ],
      // Translates only one branch
      ja: [
        { t: 'Branch', i: 1, d: { t: 'b', b: { light: 'ライト' } }, c: '自動' },
        ' テーマ',
      ],
    },
    renders: [
      { mode: 'dark' },
      { mode: 'light' },
      { mode: 'system' },
      { mode: undefined },
      { mode: '' },
    ],
    expected: 'jsx',
  },
  {
    name: 'a <Branch> nested in a <Plural>',
    source: app(
      '<T><Plural n={n} one={<Branch branch={kind} file="one file">one thing</Branch>} other={<><Num>{n}</Num> <Branch branch={kind} file="files">things</Branch></>} /></T>',
      '{ n, kind }'
    ),
    translations: {
      fr: {
        t: 'Plural',
        i: 1,
        d: {
          t: 'p',
          b: {
            one: {
              t: 'Branch',
              i: 2,
              d: { t: 'b', b: { file: 'un fichier' } },
              c: 'une chose',
            },
            other: {
              t: 'C2',
              i: 2,
              c: [
                { k: '_gt_n_3', i: 3, v: 'n' },
                ' ',
                {
                  t: 'Branch',
                  i: 4,
                  d: { t: 'b', b: { file: 'fichiers' } },
                  c: 'choses',
                },
              ],
            },
          },
        },
      },
    },
    renders: [
      { n: 1, kind: 'file' },
      { n: 1, kind: 'other' },
      { n: 5, kind: 'file' },
      { n: 5, kind: 'other' },
    ],
    expected: 'jsx',
  },
  {
    name: 'id, context and maxChars props',
    source: app('<T id="hero" context="landing" maxChars={20}>Welcome</T>'),
    translations: { fr: 'Bienvenue' },
    renders: [{}],
    expected: 'text',
  },
  {
    name: 'a key in a list',
    source: app(
      '<ul>{items.map((item) => <li key={item}><T key={item}>Item <b>{"x"}</b></T></li>)}</ul>',
      '{ items }'
    ),
    translations: { fr: ['Élément ', { t: 'b', i: 1, c: 'y' }] },
    renders: [{ items: ['a', 'b'] }],
    expected: 'jsx',
  },
  {
    name: 'props with side effects, evaluated in source order',
    source: `${IMPORTS}
      let calls = 0;
      const tag = (name) => name + '-' + ++calls;
      export function App() {
        calls = 0;
        return <T><a data-x={tag('a')}>A <i data-x={tag('i')}>I</i></a> and <b data-x={tag('b')}>B</b></T>;
      }`,
    translations: {
      fr: [
        { t: 'b', i: 3, c: 'Deux' },
        ' et ',
        { t: 'a', i: 1, c: ['Un ', { t: 'i', i: 2, c: 'I' }] },
      ],
    },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'auto-inserted <T> and <Var>',
    source: `export function App({ name }) { return <p>Hello {name}, welcome</p>; }`,
    gtConfig: {
      files: { gt: { parsingFlags: { enableAutoJsxInjection: true } } },
    },
    translations: {
      fr: ['Bonjour ', { k: '_gt_value_1', i: 1, v: 'v' }, ', bienvenue'],
    },
    renders: [{ name: 'Ada' }],
    expected: 'jsx',
  },
  // Translations that do not match the source
  {
    name: 'a translation that is not content',
    source: app('<T>Hello number</T>'),
    translations: { fr: 42, ja: { t: 'b', i: 1, c: 'x' } },
    renders: [{}],
    expected: 'text',
  },
  {
    name: 'a translation with elements for a text source',
    source: app('<T>Hello elements</T>'),
    translations: {
      fr: ['Bonjour ', { t: 'b', i: 1, c: 'éléments' }, { k: 'x' }, '!'],
    },
    renders: [{}],
    expected: 'text',
  },
  {
    name: 'a text translation for a source with elements',
    source: app('<T>Hello, <b>bold</b> text</T>'),
    translations: { fr: 'Bonjour, texte gras', ja: '' },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'an element id the source lacks',
    source: app('<T>Hello, <b>unknown</b> and <i>ids</i></T>'),
    translations: {
      fr: [
        'Bonjour, ',
        { t: 'b', i: 9, c: 'inconnu' },
        ' et ',
        { t: 'i', i: 8, c: 'identifiants' },
        { t: 'u', i: 7, c: 'en trop' },
      ],
    },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'a variable key the source lacks',
    source: app('<T>Hi <Var>{name}</Var> again</T>', '{ name }'),
    translations: { fr: ['Salut ', { k: 'nom', i: 1, v: 'v' }, ' encore'] },
    renders: [{ name: 'Ada' }],
    expected: 'jsx',
  },
  {
    name: 'a translation that leaves out the children of an element',
    source: app('<T>Click <a href="/x">here</a></T>'),
    translations: { fr: ['Cliquez ', { t: 'a', i: 1 }] },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'an element translation for a source with several children',
    source: app('<T>Several <b>children</b></T>'),
    translations: { fr: { t: 'b', i: 1, c: 'enfants' } },
    renders: [{}],
    expected: 'jsx',
  },
  {
    name: 'a variable translation for an element, and an element for a variable',
    source: app(
      '<T><Plural n={n} one={<b>one</b>} other={<Var>{n}</Var>} /></T>',
      '{ n }'
    ),
    translations: {
      fr: {
        t: 'Plural',
        i: 1,
        d: {
          t: 'p',
          b: { one: { k: '_gt_value_2' }, other: { t: 'b', i: 2 } },
        },
      },
    },
    renders: [{ n: 1 }, { n: 5 }],
    expected: 'jsx',
  },
  {
    name: 'a translated branch that pairs with different source branches',
    source: app(
      '<T><Plural n={n} one={<b>one</b>} other={<i>many</i>} /></T>',
      '{ n }'
    ),
    translations: {
      fr: {
        t: 'Plural',
        i: 1,
        d: { t: 'p', b: { other: { t: 'i', i: 2, c: 'plusieurs' } } },
      },
    },
    renders: [{ n: 1 }, { n: 5 }],
    expected: 'jsx',
  },
  // Call sites that stay a <T>
  {
    name: '<Num> with a locales prop',
    source: app("<T>Count: <Num locales={['de']}>{n}</Num></T>", '{ n }'),
    translations: { fr: ['Total : ', { k: '_gt_n_1', i: 1, v: 'n' }] },
    renders: [{ n: 1234.5 }],
    expected: 'kept',
  },
  {
    name: '<Plural> with a locales prop',
    source: app(
      '<T><Plural n={n} locales={[\'de\']} one="One" other="Many" /></T>',
      '{ n }'
    ),
    translations: {
      fr: {
        t: 'Plural',
        i: 1,
        d: { t: 'p', b: { one: 'Un', other: 'Plusieurs' } },
      },
    },
    renders: [{ n: 1 }],
    expected: 'kept',
  },
  {
    name: '<RelativeTime>',
    source: app('<T>Posted <RelativeTime unit="day">{-1}</RelativeTime></T>'),
    translations: { fr: ['Publié ', { k: '_gt_time_1', i: 1, v: 'rt' }] },
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a spread on <T>',
    source: app('<T {...options}>Spread props</T>', '{ options }'),
    translations: { fr: 'Props étalées' },
    renders: [{ options: {} }],
    expected: 'kept',
  },
  {
    name: 'side effects after the children of an element',
    source: `${IMPORTS}
      const tag = (name) => 'tag-' + name;
      export function App({ name }) {
        return <T><a children={<Var>{tag(name)}</Var>} data-x={tag('a')} /> after</T>;
      }`,
    translations: {
      fr: [{ t: 'a', i: 1, c: { k: '_gt_value_2', i: 2, v: 'v' } }, ' après'],
    },
    renders: [{ name: 'Ada' }],
    expected: 'kept',
  },
  {
    name: 'an empty <Plural> branch',
    source: app(
      '<T><Plural n={n} one={null} other="Many empties" /></T>',
      '{ n }'
    ),
    translations: {
      fr: { t: 'Plural', i: 1, d: { t: 'p', b: { other: 'Plusieurs' } } },
    },
    renders: [{ n: 1 }, { n: 2 }],
    expected: 'kept',
  },
  {
    name: 'a <Branch> branch named __proto__',
    source: app(
      '<T><Branch branch={mode} __proto__="Prototype">Other mode</Branch></T>',
      '{ mode }'
    ),
    translations: {},
    renders: [{ mode: 'x' }],
    expected: 'kept',
  },
  // The collected source reads these children as the text "0"; React renders nothing
  {
    name: 'an undefined child',
    source: app('<T>before{undefined}after</T>'),
    translations: { fr: 'avant après' },
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a void child',
    source: app('<T>before{void 0}<b>after</b></T>'),
    translations: {},
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a void child that is the only one',
    source: app('<T><b>{void 0}</b> after</T>'),
    translations: {},
    renders: [{}],
    expected: 'kept',
  },
  // A translation that gives a variable another type than its source
  {
    name: 'a <Num> its translation prints as a plain value',
    source: app('<T>Count <Num>{n}</Num></T>', '{ n }'),
    translations: {
      fr: ['Total ', { k: '_gt_n_1', i: 1 }],
      ja: ['合計 ', { k: '_gt_n_1', i: 1, v: 'v' }],
    },
    renders: [{ n: 1234.5 }, { n: '12' }, { n: null }],
    expected: 'jsx',
  },
  {
    name: 'a <Var> its translation formats as a number',
    source: app('<T>Count <Var>{n}</Var></T>', '{ n }'),
    translations: {
      fr: ['Total ', { k: '_gt_value_1', i: 1, v: 'n' }],
      ja: ['合計 ', { k: '_gt_value_1', i: 1, v: 'c' }],
    },
    renders: [{ n: 1234.5 }, { n: '7' }],
    expected: 'jsx',
  },
  {
    name: 'a <Currency> its translation formats as a number or a date',
    source: app(
      '<T>Cost <Currency currency="EUR">{n}</Currency> on <DateTime options={{ timeZone: "UTC" }}>{date}</DateTime></T>',
      '{ n, date }'
    ),
    translations: {
      fr: [
        'Prix ',
        { k: '_gt_cost_1', i: 1, v: 'n' },
        ' le ',
        { k: '_gt_date_2', i: 2, v: 'c' },
      ],
      ja: [
        { k: '_gt_date_2', i: 2, v: 'd' },
        ' ',
        { k: '_gt_cost_1', i: 1, v: 'c' },
      ],
    },
    renders: [{ n: 1234.5, date: DATE }],
    expected: 'jsx',
  },
  {
    name: 'a variable its translation writes as an element',
    source: app('<T><Var>{name}</Var></T>', '{ name }'),
    translations: {
      fr: { t: 'b', i: 1, c: 'x' },
      ja: { t: 'b', i: 1, c: ['y', { k: 'other' }, 'z'] },
    },
    renders: [{ name: 'Ada' }, { name: '' }],
    expected: 'jsx',
  },
];

const COMPONENTS = {
  text: 'GtInternalPrecomputedText',
  jsx: 'GtInternalPrecomputedJsx',
};

function writeTranslations(
  translations: Partial<Record<Locale, Record<string, unknown>>>
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-precompute-jsx-'));
  onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [locale, entries] of Object.entries(translations)) {
    fs.writeFileSync(path.join(dir, `${locale}.json`), JSON.stringify(entries));
  }
  return path.join(dir, '[locale].json');
}

describe('experimentalPrecomputeJsx', () => {
  let runtime: GTRuntime;
  let setConditions: (conditions: {
    locale: string;
    enableI18n?: boolean;
  }) => void;
  const catalogs: Record<Locale, Record<string, unknown>> = { fr: {}, ja: {} };
  const hashes = new Map<Case, string>();

  // Inside the first test that renders, since the plugin helper needs a test to clean up after
  let loading: Promise<void> | undefined;
  const loadRuntime = () =>
    (loading ??= (async () => {
      for (const testCase of CASES) {
        const hash = await getInjectedHash(
          compileJsx(testCase.source),
          testCase.gtConfig
        );
        if (new Set(hashes.values()).has(hash)) {
          throw new Error(`"${testCase.name}" shares its source with a case`);
        }
        hashes.set(testCase, hash);
        for (const locale of LOCALES) {
          if (locale in testCase.translations) {
            catalogs[locale][hash] = testCase.translations[locale];
          }
        }
      }
      runtime = await loadGTRuntime('fr', {
        locales: ['en', ...LOCALES],
        loadTranslations: async (locale) => catalogs[locale as Locale] ?? {},
      });
      const gtReact = runtime.modules['gt-react'] as {
        createOrUpdateBrowserConditionStore: (conditions: object) => void;
        getTranslationsSnapshot: (locale: string) => Promise<unknown>;
      };
      await gtReact.getTranslationsSnapshot('ja');
      setConditions = ({ locale, enableI18n = true }) =>
        gtReact.createOrUpdateBrowserConditionStore({ locale, enableI18n });
    })());

  beforeAll(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GT_PRECOMPUTE_JSX', '');
    clearInlineTranslationsCache();
  });

  async function build(
    code: string,
    options: GTUnpluginOptions = {}
  ): Promise<{ kept: string; precomputed: string }> {
    const kept = await transformWithPlugin(options, code);
    const precomputed = await transformWithPlugin(
      { ...options, experimentalPrecomputeJsx: true },
      code
    );
    if (!kept || !precomputed)
      throw new Error('the plugin left the code alone');
    return { kept, precomputed };
  }

  /** The HTML of each render in each locale, switching the locale of one runtime as it goes. */
  async function renderAll(code: string, renders: Case['renders']) {
    await loadRuntime();
    const { App } = evaluateModule(code, runtime.modules);
    const html: Record<string, string[]> = {};
    for (const conditions of [
      { locale: 'fr' },
      { locale: 'ja' },
      { locale: 'en' },
      { locale: 'fr', enableI18n: false },
    ]) {
      setConditions(conditions);
      html[JSON.stringify(conditions)] = await Promise.all(
        renders.map((props) => runtime.render(App, props))
      );
    }
    return html;
  }

  describe('renders as <T> renders, in every locale', () => {
    it.each(CASES.map((testCase) => [testCase.name, testCase] as const))(
      '%s',
      async (_name, testCase) => {
        const { kept, precomputed } = await build(
          compileJsx(testCase.source),
          testCase.gtConfig ? { gtConfig: testCase.gtConfig } : {}
        );
        if (testCase.expected === 'kept') {
          expect(precomputed).toBe(kept);
        } else {
          expect(precomputed).toContain(COMPONENTS[testCase.expected]);
          expect(precomputed).not.toMatch(/jsxs?\((T|GtInternalTranslateJsx),/);
        }
        const [before, after] = [
          await renderAll(kept, testCase.renders),
          await renderAll(precomputed, testCase.renders),
        ];
        expect(after).toEqual(before);
        // The cases must exercise translations, not only the source
        const translated = JSON.stringify(testCase.translations.fr);
        if (
          typeof testCase.translations.fr === 'string' &&
          translated.length > 4
        ) {
          expect(after['{"locale":"fr"}'][0]).not.toBe(
            after['{"locale":"en"}'][0]
          );
        }
      }
    );
  });

  it('renders embedded translations as <T> renders them', async () => {
    const source = app(
      '<><T>Embedded text</T><T>Embedded <b>element</b> and <Num>{n}</Num></T><T>Loaded text</T></>',
      '{ n }'
    );
    const code = compileJsx(source);
    const output = (await transformWithPlugin(undefined, code))!;
    const [text, element] = [...output.matchAll(/_hash: "([^"]+)"/g)].map(
      (match) => match[1]
    );
    const gtConfig: GTConfig = {
      defaultLocale: 'en',
      locales: [...LOCALES],
      files: {
        gt: {
          output: writeTranslations({
            fr: {
              [text]: 'Texte intégré',
              [element]: [
                { k: '_gt_n_2', i: 2, v: 'n' },
                ' et ',
                { t: 'b', i: 1, c: 'élément' },
                ' intégrés',
              ],
            },
          }),
          inlineTranslations: { locales: ['fr'] },
        },
      },
    };
    const { kept, precomputed } = await build(code, { gtConfig });
    expect(kept).toContain('inline:');
    expect(precomputed).toContain('i: (locale) => locale === "fr"');
    expect(precomputed).not.toContain('inline:');
    const before = await renderAll(kept, [{ n: 1234.5 }]);
    const after = await renderAll(precomputed, [{ n: 1234.5 }]);
    expect(after).toEqual(before);
    expect(after['{"locale":"fr"}'][0]).toContain('Texte intégré');
    expect(after['{"locale":"fr"}'][0]).toContain('<b>élément</b> intégrés');
  });

  it('writes a text <T> as its hash and source', async () => {
    const { precomputed } = await build(
      compileJsx(app('<T id="greeting" context="home">Hello world</T>'))
    );
    expect(precomputed).toMatchInlineSnapshot(`
      "import { jsx } from "react/jsx-runtime";
      import { T } from "gt-react";import { GtInternalPrecomputedText as _GtInternalPrecomputedText } from "gt-react";
      function App({}) {
        return /* @__PURE__ */jsx(_GtInternalPrecomputedText, { h: "6ddd4900f06f3207", s: "Hello world" });
      }
      export {
        App };"
    `);
  });

  it('writes the children as static data and the values of a render as slots', async () => {
    const { precomputed } = await build(
      compileJsx(
        app(
          '<T>Hi <b className={cls}>there <Var>{name}</Var></b>, <Plural n={n} one={<i>one</i>} other={<><Num>{n}</Num> more</>}>none</Plural> for <Branch branch={mode} dark="dark">light</Branch></T>',
          '{ cls, name, n, mode }'
        )
      )
    );
    expect(precomputed).toMatchInlineSnapshot(`
      "import { Fragment, jsx, jsxs } from "react/jsx-runtime";
      import { T, Var, Num, Plural, Branch } from "gt-react";import { GtInternalPrecomputedJsx as _GtInternalPrecomputedJsx } from "gt-react";var _gtSource;
      function App({ cls, name, n, mode }) {
        return /* @__PURE__ */jsxs(_GtInternalPrecomputedJsx, { h: "a00152d12db35528", s: _gtSource || (_gtSource = ["Hi ", { i: 1, x: 0, c: ["there ", { k: "_gt_value_2", x: 1 }] }, ", ", { i: 3, t: "p", x: 2, b: { one: { i: 4, x: 3, c: "one" }, other: { i: 4, t: "f", c: [{ k: "_gt_n_5", v: "n", x: 4 }, " more"] } }, c: "none" }, " for ", { i: 4, t: "b", x: 5, b: { dark: "dark" }, c: "light" }]), v: [

          /* @__PURE__ */jsxs("b", { className: cls


          }), /* @__PURE__ */jsx(Var, { children: name }),

          n, /* @__PURE__ */jsx("i", {}),
          /* @__PURE__ */jsx(Num, { children: n }),



          mode] }
        );
      }
      export {
        App };"
    `);
  });

  it('precomputes every static <T> in a file, and leaves the others', async () => {
    const { precomputed } = await build(
      compileJsx(
        `${IMPORTS}
        const heading = <T>Module scope</T>;
        export function App({ n, options }) {
          return <>{heading}<T>First <b>bold</b></T><T {...options}>Spread</T><T>Count <Num locales={['de']}>{n}</Num></T></>;
        }`
      )
    );
    expect(
      precomputed.match(/jsxs?\(_GtInternalPrecomputed(Text|Jsx),/g)
    ).toHaveLength(2);
    expect(precomputed.match(/jsxs?\(T,/g)).toHaveLength(2);
    // Each call site builds its static children when it first renders
    expect(precomputed).toContain('var _gtSource;');
    expect(precomputed).toContain('s: _gtSource || (_gtSource = ["First ", ');
  });

  it('leaves a <T> inside another <T> alone', async () => {
    const { kept, precomputed } = await build(
      compileJsx(app('<T>Outer <b><T>inner</T></b></T>'))
    );
    expect(precomputed).toBe(kept);
  });

  it('precomputes only a <T> imported from gt-react', async () => {
    const source = `import { T } from 'gt-next';
      export function App() { return <T>From another package</T>; }`;
    const { kept, precomputed } = await build(compileJsx(source));
    expect(precomputed).toBe(kept);
  });

  it('leaves <T> a component when _tagIds needs its hash on the DOM', async () => {
    const { kept, precomputed } = await build(
      compileJsx(app('<T>Tagged</T>')),
      { gtConfig: { _tagIds: true } }
    );
    expect(precomputed).toBe(kept);
  });

  it('changes nothing outside production builds', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { kept, precomputed } = await build(
      compileJsx(app('<T>Development</T>'))
    );
    expect(precomputed).toBe(kept);
  });

  describe('options', () => {
    it.each([
      ['true', true],
      ['1', true],
      ['false', false],
      ['', false],
    ])('reads GT_PRECOMPUTE_JSX=%s', async (value, expected) => {
      vi.stubEnv('GT_PRECOMPUTE_JSX', value);
      const output = await transformWithPlugin(
        undefined,
        compileJsx(app('<T>Environment</T>'))
      );
      expect(output!.includes(COMPONENTS.text)).toBe(expected);
    });

    it('lets the option override GT_PRECOMPUTE_JSX', async () => {
      vi.stubEnv('GT_PRECOMPUTE_JSX', 'true');
      const output = await transformWithPlugin(
        { experimentalPrecomputeJsx: false },
        compileJsx(app('<T>Option</T>'))
      );
      expect(output).not.toContain(COMPONENTS.text);
    });

    it('rejects a GT_PRECOMPUTE_JSX that is not a boolean', () => {
      vi.stubEnv('GT_PRECOMPUTE_JSX', 'yes');
      expect(() => gtUnplugin.raw(undefined, { framework: 'vite' })).toThrow(
        /GT_PRECOMPUTE_JSX is set to "yes"/
      );
    });

    it('keys the persistent cache of webpack on the setting', () => {
      const version = (experimentalPrecomputeJsx: boolean) => {
        const plugin = gtUnplugin.raw({ experimentalPrecomputeJsx }, {
          framework: 'webpack',
        } as never) as unknown as { webpack(compiler: unknown): void };
        const options = { cache: { type: 'filesystem', version: 'next' } };
        plugin.webpack({ options });
        return options.cache.version;
      };
      expect(version(false)).toBe('next');
      expect(version(true)).toBe('next|gt-precompute-jsx');
    });

    it('reports call sites that stay a <T> at debug level', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      await transformWithPlugin(
        { experimentalPrecomputeJsx: true, logLevel: 'debug' },
        compileJsx(app('<T {...options}>Spread</T>', '{ options }'))
      );
      expect(
        log.mock.calls.some(([message]) =>
          /Left <T> [0-9a-f]+ as a component: <T> has spread or computed props/.test(
            String(message)
          )
        )
      ).toBe(true);
      log.mockRestore();
    });
  });

  describe('renders before its module has run', () => {
    // What a call site needs of gt-react and React, to run it in Node as it is
    const STUBS = {
      'gt.mjs': `export const T = 'T';
        export const GtInternalPrecomputedJsx = 'Jsx';
        export const GtInternalPrecomputedText = 'Text';`,
      'jsx.mjs': `export const jsx = (type, props) => ({ type, props });
        export const jsxs = jsx;
        export const Fragment = 'Fragment';`,
    };
    const EXPECTED = [
      {
        type: 'Jsx',
        props: {
          h: expect.any(String),
          s: ['Hello ', { i: 1, x: 0, c: 'world' }],
          v: [{ type: 'b', props: {} }],
        },
      },
    ];

    const run = async (
      modules: Record<string, string>,
      bundle: boolean
    ): Promise<unknown> => {
      const dir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gt-precompute-order-')
      );
      onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
      for (const [name, code] of Object.entries({ ...STUBS, ...modules })) {
        fs.writeFileSync(
          path.join(dir, name),
          code
            .replaceAll('"gt-react"', '"./gt.mjs"')
            .replaceAll('"react/jsx-runtime"', '"./jsx.mjs"')
        );
      }
      let entry = path.join(dir, 'entry.mjs');
      if (bundle) {
        buildSync({
          entryPoints: [entry],
          outfile: path.join(dir, 'bundle.mjs'),
          bundle: true,
          format: 'esm',
          platform: 'node',
          minify: true,
          logLevel: 'silent',
        });
        entry = path.join(dir, 'bundle.mjs');
      }
      return JSON.parse(
        execFileSync(process.execPath, [entry], { encoding: 'utf8' })
      );
    };

    it.each([
      ['as modules', false],
      ['as a minified bundle', true],
    ])('through an import cycle, %s', async (_name, bundle) => {
      // b's function is called by a, which b imports, before b's body runs
      const { precomputed } = await build(
        compileJsx(`import { T } from 'gt-react';
            import './a.mjs';
            export function label() { return <T>Hello <b>world</b></T>; }`)
      );
      expect(
        await run(
          {
            'b.mjs': precomputed,
            'a.mjs': `import { label } from './b.mjs';
                export const elements = [label()];`,
            'entry.mjs': `import './b.mjs';
                import { elements } from './a.mjs';
                console.log(JSON.stringify(elements));`,
          },
          bundle
        )
      ).toEqual(EXPECTED);
    });

    it('above an import', async () => {
      const { precomputed } = await build(
        `${compileJsx(`import { T } from 'gt-react';
          export const elements = [<T>Hello <b>world</b></T>];`)}
        import { sep } from 'node:path';
        export const separator = sep;`
      );
      expect(
        await run(
          {
            'early.mjs': precomputed,
            'entry.mjs': `import { elements } from './early.mjs';
              console.log(JSON.stringify(elements));`,
          },
          false
        )
      ).toEqual(EXPECTED);
    });
  });

  it('lets a bundler drop <T> and the source children of unused call sites', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-precompute-bundle-'));
    onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
    const { kept, precomputed } = await build(
      compileJsx(
        `${IMPORTS}
        export function App() { return <T>Used <b>element</b></T>; }
        export function Unused() { return <T>Never <i>rendered</i></T>; }`
      )
    );
    const bundle = (code: string) => {
      fs.writeFileSync(path.join(dir, 'app.js'), code);
      fs.writeFileSync(
        path.join(dir, 'entry.js'),
        `import { App } from './app.js'; globalThis.App = App;`
      );
      return buildSync({
        entryPoints: [path.join(dir, 'entry.js')],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        minify: true,
        logLevel: 'silent',
        external: ['react', 'react/jsx-runtime', 'react-dom'],
        define: { 'process.env.NODE_ENV': '"production"' },
        nodePaths: [path.join(__dirname, '../../node_modules')],
      }).outputFiles[0].text;
    };
    const [keptBundle, precomputedBundle] = [bundle(kept), bundle(precomputed)];
    expect(precomputedBundle).toContain('Used ');
    expect(precomputedBundle).not.toContain('Never ');
    // <T> marks itself for the tagging its render pipeline does
    expect(keptBundle).toContain('translate-client');
    expect(precomputedBundle).not.toContain('translate-client');
    expect(precomputedBundle.length).toBeLessThan(keptBundle.length);
  });
});
