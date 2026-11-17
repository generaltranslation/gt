/**
 * experimentalReplaceSource: a per-locale build replaces the source content of
 * the call sites it embeds with the static locale's translation. The main
 * safety net is the equivalence tables: each case renders the per-locale
 * build with and without replacement in gt-react, and the HTML must match.
 */
import { getPluralForm } from 'generaltranslation/internal';
import {
  afterAll,
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
  PLURAL_SCENARIOS,
  selectPluralForm,
} from '../transform/injection/inline-translations/pluralScenarios';
import {
  buildBothWays,
  buildOptions,
  compileJsx,
  evaluateModule,
  getInjectedHash,
  loadGTRuntime,
  STATIC_LOCALE,
  type GTRuntime,
} from './sourceReplacementHarness';
import { transformWithPlugin } from './transformWithPlugin';

type GTConfig = NonNullable<GTUnpluginOptions['gtConfig']>;

type Case = {
  name: string;
  /** Module exporting `App`, a component rendered (or for templates, a function called) with each of `renders` */
  source: string;
  translation: unknown;
  renders: Record<string, unknown>[];
  /** Whether the call site is replaced, or keeps its source and embedded translation */
  expected: 'replaced' | 'kept';
  /** Source strings a replaced build must not ship */
  sourceText?: string[];
  /** Set when a build for the source locale keeps the <T> too */
  sourceLocale?: 'kept';
  /** Templates: the string literal a translated build compiles the call to */
  literal?: string;
  /** Templates: the string literal a build for the source locale compiles the call to */
  sourceLiteral?: string;
  gtConfig?: GTConfig;
};

const IMPORTS = `import { T, Var, Num, Currency, DateTime, RelativeTime, Plural, Branch } from 'gt-react';`;

// Sources by the JSX they return, so a case can be rebuilt with that JSX among other children
const APP_BODIES = new Map<string, { body: string; params: string }>();

const app = (body: string, params = '{}') => {
  const source = `${IMPORTS}\nexport function App(${params}) {\n  return ${body};\n}`;
  APP_BODIES.set(source, { body, params });
  return source;
};

/** Where a `<T>` sits among the children of what renders it. */
const PLACEMENTS: Record<string, (body: string) => string> = {
  'the only child of an element': (body) => `<section>${body}</section>`,
  'among the children of an element': (body) =>
    `<section>Before {1}${body}<i>after</i></section>`,
  'among the children of a fragment': (body) => `<>${body}<i>after</i></>`,
  'in a condition': (body) =>
    `<section>{on ? ${body} : 'off'}{!on || ${body}}<i>after</i></section>`,
  'the only child of a component': (body) => `<Box>${body}</Box>`,
};

/** Each `app()` case of `cases`, with the JSX it returns placed by `place`. */
const placeCases = (cases: Case[], place: (body: string) => string): Case[] =>
  [...new Map(cases.map((testCase) => [testCase.source, testCase])).values()]
    .filter((testCase) => APP_BODIES.has(testCase.source))
    .map((testCase) => {
      const { body, params } = APP_BODIES.get(testCase.source)!;
      return {
        ...testCase,
        source: `${IMPORTS}
          const on = true;
          const Box = ({ children }) => <div>{children}</div>;
          export function App(${params}) {
            return ${place(body)};
          }`,
      };
    });

const DATE = new Date(Date.UTC(2024, 0, 15, 12));

const JSX_CASES: Case[] = [
  {
    name: 'plain text',
    source: app('<T>Hello world</T>'),
    translation: 'Bonjour le monde',
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Hello world'],
  },
  {
    name: 'a nested element with props',
    source: app(
      '<T>Hello, <b className="greeting" data-test="x">World!</b></T>'
    ),
    translation: ['Bonjour, ', { t: 'b', i: 1, c: 'le Monde !' }],
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Hello', 'World'],
  },
  {
    name: 'several sibling elements',
    source: app('<T><b>One</b>, <i>two</i> and <a href="/three">three</a></T>'),
    translation: [
      { t: 'b', i: 1, c: 'Un' },
      ', ',
      { t: 'i', i: 2, c: 'deux' },
      ' et ',
      { t: 'a', i: 3, c: 'trois' },
    ],
    renders: [{}],
    expected: 'replaced',
    sourceText: ['One', '"two"', '"three"', ' and '],
  },
  {
    name: 'elements reordered by the translation',
    source: app('<T><b>red</b> <i>car</i></T>'),
    translation: [
      { t: 'i', i: 2, c: 'voiture' },
      ' ',
      { t: 'b', i: 1, c: 'rouge' },
    ],
    renders: [{}],
    expected: 'replaced',
    sourceText: ['red', 'car'],
  },
  {
    name: 'self-closing elements',
    source: app('<T>First line<br />second line <img src="/x.png" /></T>'),
    translation: [
      'Première ligne',
      { t: 'br', i: 1 },
      'deuxième ligne ',
      { t: 'img', i: 2 },
    ],
    renders: [{}],
    expected: 'replaced',
    sourceText: ['First line', 'second line'],
  },
  {
    name: 'a translated title on an element with children',
    source: app(
      '<T><abbr title="World Health Organization">WHO</abbr> guidance</T>'
    ),
    translation: [
      {
        t: 'abbr',
        i: 1,
        d: { ti: 'Organisation mondiale de la Santé' },
        c: 'OMS',
      },
      ' recommandations',
    ],
    renders: [{}],
    expected: 'replaced',
    sourceText: ['World Health Organization', 'guidance'],
  },
  {
    name: 'a translated aria-label next to a spread',
    source: app(
      '<T><a {...link} aria-label="Read more">More</a></T>',
      '{ link }'
    ),
    translation: { t: 'a', i: 1, d: { arl: 'Lire la suite' }, c: 'Plus' },
    renders: [{ link: { href: '/more', className: 'cta' } }],
    expected: 'replaced',
    sourceText: ['Read more', 'More'],
  },
  {
    name: 'a fragment',
    source: app('<T><>Hello <b>you</b></></T>'),
    translation: {
      t: 'C1',
      i: 1,
      c: ['Salut ', { t: 'b', i: 2, c: 'toi' }],
    },
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Hello', 'you'],
  },
  {
    name: 'whitespace and newlines',
    source: app(`<T>
      Hello,{' '}
      <b>  spaced  </b>   world
    </T>`),
    translation: [' Bonjour, ', { t: 'b', i: 1, c: '  espacé  ' }, '\n monde '],
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Hello', 'world'],
  },
  {
    name: 'entities and characters HTML escapes',
    source: app('<T>Fish &amp; chips&nbsp;&lt;3</T>'),
    translation: 'Poisson & frites <3 "maison"',
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Fish', 'chips'],
  },
  {
    name: '<Var>',
    source: app('<T>Hi <Var>{name}</Var>, welcome!</T>', '{ name }'),
    translation: [
      'Salut ',
      { k: '_gt_value_1', i: 1, v: 'v' },
      ', bienvenue !',
    ],
    renders: [{ name: 'Ada' }],
    expected: 'replaced',
    sourceText: ['Hi ', 'welcome'],
  },
  {
    name: 'named variables the translation reorders',
    source: app(
      '<T>From <Var name="from">{a}</Var> to <Var name="to">{b}</Var></T>',
      '{ a, b }'
    ),
    translation: [
      'Vers ',
      { k: 'to', i: 2, v: 'v' },
      ' depuis ',
      { k: 'from', i: 1, v: 'v' },
    ],
    renders: [{ a: 'Paris', b: 'Lyon' }],
    expected: 'replaced',
    sourceText: ['From ', ' to '],
  },
  {
    name: 'a variable the translation repeats',
    source: app('<T>Hi <Var>{name}</Var></T>', '{ name }'),
    translation: [
      'Salut ',
      { k: '_gt_value_1', i: 1, v: 'v' },
      ' (',
      { k: '_gt_value_1', i: 1, v: 'v' },
      ')',
    ],
    renders: [{ name: 'Ada' }],
    expected: 'replaced',
    sourceText: ['Hi '],
  },
  {
    name: '<Num> with options',
    source: app(
      "<T>Progress: <Num options={{ style: 'percent' }}>{ratio}</Num></T>",
      '{ ratio }'
    ),
    translation: ['Progression : ', { k: '_gt_n_1', i: 1, v: 'n' }],
    renders: [{ ratio: 0.256 }, { ratio: 1234.5 }],
    expected: 'replaced',
    sourceText: ['Progress:'],
  },
  {
    name: '<Currency>',
    source: app(
      '<T>Total: <Currency currency="EUR">{price}</Currency></T>',
      '{ price }'
    ),
    translation: ['Total : ', { k: '_gt_cost_1', i: 1, v: 'c' }],
    renders: [{ price: 1234.5 }],
    expected: 'replaced',
    sourceText: ['Total: '],
  },
  {
    name: '<DateTime>',
    source: app(
      "<T>Due <DateTime options={{ dateStyle: 'long', timeZone: 'UTC' }}>{due}</DateTime></T>",
      '{ due }'
    ),
    translation: ['Échéance le ', { k: '_gt_date_1', i: 1, v: 'd' }],
    renders: [{ due: DATE }],
    expected: 'replaced',
    sourceText: ['Due '],
  },
  {
    name: '<Plural> with a branch the source lacks',
    source: app(
      '<T><Plural n={n} one="One item" other="Many items" /></T>',
      '{ n }'
    ),
    translation: {
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
    renders: [{ n: 0 }, { n: 1 }, { n: 2 }, { n: 1.5 }, { n: 1_000_000 }],
    expected: 'replaced',
    sourceText: ['One item', 'Many items'],
  },
  {
    name: '<Plural> with elements and variables in its branches',
    source: app(
      '<T>You have <Plural n={n} one={<><b>one</b> message</>} other={<><Num>{n}</Num> messages</>} /></T>',
      '{ n }'
    ),
    translation: [
      'Vous avez ',
      {
        t: 'Plural',
        i: 1,
        d: {
          t: 'p',
          b: {
            one: { t: 'C2', i: 2, c: [{ t: 'b', i: 3, c: 'un' }, ' message'] },
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
    renders: [{ n: 0 }, { n: 1 }, { n: 7 }, { n: 1_000_000 }],
    expected: 'replaced',
    sourceText: ['You have', '"one"'],
  },
  {
    name: '<Plural> inside an element',
    source: app(
      '<T><p>You have <Plural n={n} one="one task" other="many tasks" /></p></T>',
      '{ n }'
    ),
    translation: {
      t: 'p',
      i: 1,
      c: [
        'Vous avez ',
        {
          t: 'Plural',
          i: 2,
          d: { t: 'p', b: { one: 'une tâche', other: 'des tâches' } },
        },
      ],
    },
    renders: [{ n: 1 }, { n: 3 }],
    expected: 'replaced',
    sourceText: ['You have', 'task'],
  },
  {
    name: '<Branch>',
    source: app(
      '<T><Branch branch={mode} dark={<b>Dark</b>} light="Light">Auto</Branch> theme</T>',
      '{ mode }'
    ),
    translation: [
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
    renders: [
      { mode: 'dark' },
      { mode: 'light' },
      { mode: 'system' },
      { mode: undefined },
    ],
    expected: 'replaced',
    sourceText: ['Dark', 'Light', '"Auto"', ' theme'],
  },
  {
    name: 'id and context props',
    source: app('<T id="hero" context="landing">Hello</T>'),
    translation: 'Bonjour',
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Hello'],
  },
  {
    name: 'a key in a list',
    source: app(
      '<ul>{items.map((item) => <li key={item}><T key={item}>Item</T></li>)}</ul>',
      '{ items }'
    ),
    translation: 'Élément',
    renders: [{ items: ['a', 'b'] }],
    expected: 'replaced',
    sourceText: ['Item'],
  },
  {
    name: 'side-effect props kept in order',
    source: `${IMPORTS}
      const tag = (name) => 'tag-' + name;
      export function App() {
        return <T><a data-x={tag('a')}>A</a> and <b data-x={tag('b')}>B</b></T>;
      }`,
    translation: [
      { t: 'a', i: 1, c: 'Un' },
      ' et ',
      { t: 'b', i: 2, c: 'Deux' },
    ],
    renders: [{}],
    expected: 'replaced',
    sourceText: [' and '],
  },
  {
    name: 'auto-inserted <T> and <Var>',
    source: `export function App({ name }) { return <p>Hello {name}, welcome</p>; }`,
    gtConfig: {
      files: { gt: { parsingFlags: { enableAutoJsxInjection: true } } },
    },
    translation: [
      'Bonjour ',
      { k: '_gt_value_1', i: 1, v: 'v' },
      ', bienvenue',
    ],
    renders: [{ name: 'Ada' }],
    expected: 'replaced',
    sourceText: ['Hello', 'welcome'],
  },
  // Call sites that keep their source and embedded translation
  {
    name: 'a missing translation',
    source: app('<T>Hello world</T>'),
    translation: undefined,
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a malformed translation',
    source: app('<T>Hello world</T>'),
    translation: 42,
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'an element id the source lacks',
    source: app('<T>Hello, <b>World!</b></T>'),
    translation: ['Bonjour, ', { t: 'b', i: 9, c: 'le Monde !' }],
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a variable key the source lacks',
    source: app('<T>Hi <Var>{name}</Var></T>', '{ name }'),
    translation: ['Salut ', { k: 'nom', i: 1, v: 'v' }],
    renders: [{ name: 'Ada' }],
    expected: 'kept',
  },
  {
    name: 'a translation that leaves out the children of an element',
    source: app('<T>Click <a href="/x">here</a></T>'),
    translation: ['Cliquez ', { t: 'a', i: 1 }],
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a translation that leaves out a title',
    source: app('<T><abbr title="World Health Organization">WHO</abbr></T>'),
    translation: { t: 'abbr', i: 1, c: 'OMS' },
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'an alt on an element without children, which <T> leaves in the source language',
    source: app('<T>A <img alt="cat" src="/c.png" /></T>'),
    translation: ['Un ', { t: 'img', i: 1, d: { alt: 'chat' } }],
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a translated branch that pairs with different source branches',
    source: app(
      '<T><Plural n={n} one={<b>one</b>} other={<i>many</i>} /></T>',
      '{ n }'
    ),
    translation: {
      t: 'Plural',
      i: 1,
      d: { t: 'p', b: { other: { t: 'i', i: 2, c: 'plusieurs' } } },
    },
    renders: [{ n: 1 }, { n: 5 }],
    expected: 'kept',
  },
  {
    name: '<Num> with a locales prop',
    source: app("<T>Count: <Num locales={['de']}>{n}</Num></T>", '{ n }'),
    translation: ['Total : ', { k: '_gt_n_1', i: 1, v: 'n' }],
    renders: [{ n: 1234.5 }],
    expected: 'kept',
    sourceLocale: 'kept',
  },
  {
    name: '<Plural> with a locales prop',
    source: app(
      '<T><Plural n={n} locales={[\'de\']} one="One" other="Many" /></T>',
      '{ n }'
    ),
    translation: {
      t: 'Plural',
      i: 1,
      d: { t: 'p', b: { one: 'Un', other: 'Plusieurs' } },
    },
    renders: [{ n: 1 }],
    expected: 'kept',
    sourceLocale: 'kept',
  },
  {
    name: '<RelativeTime>',
    source: app('<T>Posted <RelativeTime unit="day">{-1}</RelativeTime></T>'),
    translation: ['Publié ', { k: '_gt_time_1', i: 1, v: 'rt' }],
    renders: [{}],
    expected: 'kept',
    sourceLocale: 'kept',
  },
  {
    name: 'a repeated variable with side effects',
    source: `${IMPORTS}
      const shout = (s) => s.toUpperCase();
      export function App({ name }) { return <T>Hi <Var>{shout(name)}</Var></T>; }`,
    translation: [
      'Salut ',
      { k: '_gt_value_1', i: 1, v: 'v' },
      ' ',
      { k: '_gt_value_1', i: 1, v: 'v' },
    ],
    renders: [{ name: 'Ada' }],
    expected: 'kept',
  },
  {
    name: 'side-effect props the translation reorders',
    source: `${IMPORTS}
      const tag = (name) => 'tag-' + name;
      export function App() {
        return <T><a data-x={tag('a')}>A</a> and <b data-x={tag('b')}>B</b></T>;
      }`,
    translation: [
      { t: 'b', i: 2, c: 'Deux' },
      ' et ',
      { t: 'a', i: 1, c: 'Un' },
    ],
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a variable the translation moves across one with side effects',
    source: `${IMPORTS}
      export function App() {
        let x = 0;
        return <T><Var name="a">{x}</Var> then <Var name="b">{x++}</Var></T>;
      }`,
    translation: [{ k: 'b', i: 2, v: 'v' }, ' puis ', { k: 'a', i: 1, v: 'v' }],
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a <Branch> whose branch prop with side effects follows a branch',
    source: `${IMPORTS}
      export function App() {
        let i = 0;
        const next = () => String(++i);
        return <T><Branch yes={<Var>{next()}</Var>} branch={next() === '2' ? 'yes' : 'no'}>Other</Branch></T>;
      }`,
    translation: {
      t: 'Branch',
      i: 1,
      d: { t: 'b', b: { yes: { k: '_gt_value_2', i: 2, v: 'v' } } },
      c: 'Autre',
    },
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a translated title, then the same element without its title',
    source: app('<T><abbr title="World Health Organization">WHO</abbr></T>'),
    translation: [
      { t: 'abbr', i: 1, d: { ti: 'Organisation mondiale' }, c: 'OMS' },
      ' ',
      { t: 'abbr', i: 1, c: 'encore' },
    ],
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'a variable the translation formats as another type',
    source: app('<T>Count: <Num>{n}</Num></T>', '{ n }'),
    translation: ['Total : ', { k: '_gt_n_1', i: 1, v: 'v' }],
    renders: [{ n: 1234.5 }],
    expected: 'kept',
  },
  {
    name: 'children passed before a prop with side effects',
    source: `${IMPORTS}
      export function App() {
        let x = 0;
        return <T><b children={<Var>{x}</Var>} data-x={x++} /></T>;
      }`,
    translation: { t: 'b', i: 1, c: { k: '_gt_value_2', i: 2, v: 'v' } },
    renders: [{}],
    expected: 'kept',
  },
  {
    name: 'sibling variables that share a name',
    source: app(
      '<T><Var name="who">{a}</Var> / <Var name="who">{b}</Var></T>',
      '{ a, b }'
    ),
    translation: [
      { k: 'who', i: 1, v: 'v' },
      ' et ',
      { k: 'who', i: 2, v: 'v' },
    ],
    renders: [{ a: 'Alice', b: 'Bob' }],
    expected: 'replaced',
    sourceText: [' / '],
  },
];

const TEMPLATE_CASES: Case[] = [
  {
    name: 'plain text',
    source: `import { t } from 'gt-react/unstable';
      export const App = () => t\`Hello world\`;`,
    translation: 'Bonjour le monde',
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Hello world'],
    literal: 'Bonjour le monde',
    sourceLiteral: 'Hello world',
  },
  {
    name: 'text that string and template literals escape',
    source: `import { t } from 'gt-react/unstable';
      export const App = () => t\`"It's" \\\`a\\\` \\\${b} \\\\ {c}\\n\\u00e9 #\`;`,
    translation: '« C\'est » `a` ${b} \\ {c}\n\u00e9 "#"',
    renders: [{}],
    expected: 'replaced',
    literal: '« C\'est » `a` ${b} \\ {c}\n\u00e9 "#"',
    sourceLiteral: '"It\'s" `a` ${b} \\ {c}\n\u00e9 #',
  },
  {
    name: 'an empty translation',
    source: `import { t } from 'gt-react/unstable';
      export const App = () => t\`Optional note\`;`,
    translation: '',
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Optional note'],
    literal: '',
    sourceLiteral: 'Optional note',
  },
  {
    name: 'an empty template',
    source: `import { t } from 'gt-react/unstable';
      export const App = () => t\`\`;`,
    translation: undefined,
    renders: [{}],
    expected: 'kept',
    sourceLiteral: '',
  },
  {
    name: 'requiresReview',
    source: `import { t } from 'gt-react/unstable';
      export const App = () => t({ requiresReview: true })\`Terms\`;`,
    translation: 'Conditions',
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Terms'],
    literal: 'Conditions',
    sourceLiteral: 'Terms',
  },
  {
    name: 'named variables the translation reorders',
    source: `import { t } from 'gt-react/unstable';
      export const App = ({ from, to }) => t\`From \${{ from }} to \${{ to }}\`;`,
    translation: ['Vers ', ['to'], ' depuis ', ['from']],
    renders: [{ from: 'Paris', to: 'Lyon' }],
    expected: 'replaced',
    sourceText: ['From '],
  },
  {
    name: 'a variable the translation repeats',
    source: `import { t } from 'gt-react/unstable';
      export const App = ({ user }) => t\`Hi \${{ name: user.name }}\`;`,
    translation: ['Salut ', ['name'], ' (', ['name'], ')'],
    renders: [{ user: { name: 'Ada' } }],
    expected: 'replaced',
    sourceText: ['Hi '],
  },
  {
    name: 'a number formatted in the target locale',
    source: `import { t } from 'gt-react/unstable';
      export const App = ({ count }) => t\`\${{ count }} files\`;`,
    translation: [['count'], ' fichiers'],
    renders: [{ count: 1234.5 }],
    expected: 'replaced',
    sourceText: [' files'],
  },
  {
    name: 'context',
    source: `import { t } from 'gt-react/unstable';
      export const App = () => t({ context: 'navigation' })\`Home\`;`,
    translation: 'Accueil',
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Home'],
    literal: 'Accueil',
    sourceLiteral: 'Home',
  },
  {
    name: 'maxChars',
    source: `import { t } from 'gt-react/unstable';
      export const App = () => t({ maxChars: 8 })\`Read the whole story\`;`,
    translation: "Lire toute l'histoire",
    renders: [{}],
    expected: 'replaced',
    sourceText: ['Read the whole story'],
  },
  {
    name: 'text with template syntax',
    source: `import { t } from 'gt-react/unstable';
      export const App = ({ name }) => t\`Use \\\`code\\\` for \${{ name }}\`;`,
    translation: ['Utilisez `code`, ${x} et \\ pour ', ['name'], '\r\n'],
    renders: [{ name: 'Ada' }],
    expected: 'replaced',
    sourceText: ['Use '],
  },
  // Templates that keep their source and embedded translation
  {
    name: 'a translation with ICU syntax beyond {name}',
    source: `import { t } from 'gt-react/unstable';
      export const App = ({ count }) => t\`\${{ count }} files\`;`,
    translation: [
      ['count', 'plural', { one: [0, ' fichier'], other: [0, ' fichiers'] }],
    ],
    renders: [{ count: 1 }, { count: 4 }],
    expected: 'kept',
  },
  {
    name: 'a variable in the translation of a template without any',
    source: `import { t } from 'gt-react/unstable';
      export const App = () => t\`Hi there\`;`,
    translation: ['Salut ', ['nom']],
    renders: [{}],
    expected: 'kept',
    sourceLiteral: 'Hi there',
  },
  {
    name: 'a variable the source lacks',
    source: `import { t } from 'gt-react/unstable';
      export const App = ({ name }) => t\`Hi \${{ name }}\`;`,
    translation: ['Salut ', ['nom']],
    renders: [{ name: 'Ada' }],
    expected: 'kept',
  },
  {
    name: 'a repeated variable that binds a new object each time',
    source: `import { t } from 'gt-react/unstable';
      export const App = ({ a }) => t\`Hi \${{ name: [a].join('') }}\`;`,
    translation: ['Salut ', ['name'], ' ', ['name']],
    renders: [{ a: 'Ada' }],
    expected: 'kept',
  },
  {
    name: 'variables with side effects the translation reorders',
    source: `import { t } from 'gt-react/unstable';
      const up = (s) => s.toUpperCase();
      export const App = ({ a, b }) => t\`\${{ a: up(a) }} then \${{ b: up(b) }}\`;`,
    translation: [['b'], ' puis ', ['a']],
    renders: [{ a: 'x', b: 'y' }],
    expected: 'kept',
  },
  {
    name: 'a variable the translation moves across one with side effects',
    source: `import { t } from 'gt-react/unstable';
      export const App = () => {
        let x = 0;
        return t\`\${{ a: x }} then \${{ b: x++ }}\`;
      };`,
    translation: [['b'], ' puis ', ['a']],
    renders: [{}],
    expected: 'kept',
  },
];

/** A build for a locale that renders the source: `en`, or its dialect `en-GB`. */
function sourceLocaleOptions(
  locale: string,
  options: { replaceSource: boolean; gtConfig?: GTConfig }
): GTUnpluginOptions {
  return {
    ...buildOptions(
      {},
      {
        ...options,
        gtConfig: { locales: ['en-GB', STATIC_LOCALE], ...options.gtConfig },
      }
    ),
    experimentalStaticLocale: locale,
  };
}

describe('experimentalReplaceSource', () => {
  let runtime: GTRuntime;

  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    runtime = await loadGTRuntime(STATIC_LOCALE);
  });

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GT_STATIC_LOCALE', '');
    vi.stubEnv('GT_REPLACE_SOURCE', '');
    clearInlineTranslationsCache();
  });

  async function renderAll(
    code: string,
    renders: Case['renders'],
    asText = false
  ) {
    const { App } = evaluateModule(code, runtime.modules);
    return Promise.all(
      renders.map((props) =>
        asText
          ? String((App as (props: unknown) => unknown)(props))
          : runtime.render(App, props)
      )
    );
  }

  /**
   * Builds the case both ways and checks the replaced build renders the same
   * HTML; returns both outputs.
   */
  async function checkCase(
    { source, translation, renders, expected, sourceText = [], gtConfig }: Case,
    asText = false
  ) {
    const code = compileJsx(source);
    const { embedded, replaced } = await buildBothWays(code, translation, {
      gtConfig,
    });
    if (expected === 'kept') {
      expect(replaced).toBe(embedded);
    } else {
      expect(replaced).not.toBe(embedded);
      for (const text of sourceText) expect(replaced).not.toContain(text);
    }
    const [before, after] = await Promise.all([
      renderAll(embedded, renders, asText),
      renderAll(replaced, renders, asText),
    ]);
    expect(after).toEqual(before);
    return { embedded, replaced, html: after };
  }

  describe('renders <T> as it renders the embedded translation', () => {
    it.each(JSX_CASES.map((testCase) => [testCase.name, testCase] as const))(
      '%s',
      async (_name, testCase) => {
        const { replaced, html } = await checkCase(testCase);
        if (testCase.expected === 'replaced') {
          expect(replaced).not.toMatch(/inline:|_hash:|jsxs?\(T,/);
          // The embedded translation renders, not the source
          for (const text of testCase.sourceText ?? []) {
            for (const rendered of html) expect(rendered).not.toContain(text);
          }
        }
      }
    );
  });

  describe('renders unstable templates as they render the embedded translation', () => {
    it.each(
      TEMPLATE_CASES.map((testCase) => [testCase.name, testCase] as const)
    )('%s', async (_name, testCase) => {
      const { replaced, html } = await checkCase(testCase, true);
      if (testCase.literal !== undefined) {
        // No call is left: the template is the text it renders
        expect(replaced).toContain(
          `() => ${JSON.stringify(testCase.literal)};`
        );
        expect(replaced).not.toMatch(/_hash|inline|t\(|t`/);
        expect(html).toEqual([testCase.literal]);
      } else if (testCase.expected === 'replaced') {
        // The runtime renders the embedded translation, with no lookup
        expect(replaced).toMatch(/\$_hash: "[0-9a-f]+", inline: \(locale\) =>/);
      }
      if (testCase.expected === 'replaced') {
        for (const text of testCase.sourceText ?? []) {
          for (const rendered of html) expect(rendered).not.toContain(text);
        }
      }
    });

    describe.each(['en', 'en-GB'])('in a build for %s', (locale) => {
      beforeAll(() => runtime.setLocale(locale));
      afterAll(() => runtime.setLocale(STATIC_LOCALE));

      const sources = new Map(
        TEMPLATE_CASES.map((testCase) => [testCase.source, testCase] as const)
      );
      it.each(
        [...sources.values()].map((testCase) => [testCase.name, testCase])
      )('%s', async (_name, { source, renders, sourceLiteral }) => {
        const code = compileJsx(source);
        const [kept, replaced] = await Promise.all(
          [false, true].map((replaceSource) =>
            transformWithPlugin(
              sourceLocaleOptions(locale, { replaceSource }),
              code
            )
          )
        );
        const [before, after] = await Promise.all([
          renderAll(kept!, renders, true),
          renderAll(replaced!, renders, true),
        ]);
        expect(after).toEqual(before);
        if (sourceLiteral === undefined) {
          // Variables and maxChars are formatted at runtime
          expect(replaced).toBe(kept);
        } else {
          expect(replaced).toContain(`() => ${JSON.stringify(sourceLiteral)};`);
          expect(replaced).not.toMatch(/_hash|t\(|t`/);
          expect(after).toEqual([sourceLiteral]);
        }
      });
    });

    // The runtime loads nothing here, so a translation can only come from
    // the call site.
    it.each([
      [
        'plural() with parts and the count',
        'plural({ count }, { one: part`${n} file`, other: part`${n} files` })',
        [
          [
            'count',
            'plural',
            { one: [0, ' fichier'], other: [0, ' fichiers'] },
          ],
        ],
        [{ count: 1 }, { count: 2 }, { count: 1234.5 }],
        ['1 fichier', '2 fichiers', '1\u202f234,5 fichiers'],
      ],
      [
        'select() inside text',
        "`Signed in as ${select({ role }, { admin: 'an admin', other: 'a member' })}`",
        [
          'Connecté en tant que ',
          ['role', 'select', { admin: 'administrateur', other: 'membre' }],
        ],
        [{ role: 'admin' }, { role: 'guest' }],
        ['Connecté en tant que administrateur', 'Connecté en tant que membre'],
      ],
      [
        'selectordinal() and a named variable in a part',
        'selectordinal({ place }, { one: part`${n}st for ${{ name }}`, other: part`${n}th for ${{ name }}` })',
        [
          [
            'place',
            'selectordinal',
            {
              one: [0, 'er pour ', ['name']],
              other: [0, 'e pour ', ['name']],
            },
          ],
        ],
        [
          { place: 1, name: 'Ada' },
          { place: 3, name: 'Ada' },
        ],
        ['1er pour Ada', '3e pour Ada'],
      ],
      [
        'number() with a style and a currency',
        "`Total: ${number({ price }, { style: 'currency', currency })}`",
        ['Total : ', ['price', 'number', 'currency']],
        [{ price: 1234.5, currency: 'EUR' }],
        ['Total : 1\u202f234,50\u00a0€'],
      ],
      [
        'date() with a style and a time zone',
        "`Due ${date({ due }, { style: 'long', timeZone: 'UTC' })}`",
        ['Échéance le ', ['due', 'date', 'long']],
        [{ due: DATE }],
        ['Échéance le 15 janvier 2024'],
      ],
    ])(
      'renders a template with %s from the translation embedded at its call',
      async (_name, hole, translation, renders, expected) => {
        const code =
          compileJsx(`import { t, plural, select, selectordinal, number, date, part, n } from 'gt-react/unstable';
          export const App = ({ count, role, place, name, price, currency, due }) =>
            ${hole.startsWith('`') ? `t${hole}` : `t\`\${${hole}}\``};`);
        const { embedded, replaced } = await buildBothWays(code, translation, {
          gtConfig: {
            files: {
              gt: {
                inlineTranslations: { locales: [STATIC_LOCALE], helpers: true },
              },
            },
          },
        });
        expect(embedded).toContain('inline: (locale) => locale === "fr" ?');
        expect(await renderAll(embedded, renders, true)).toEqual(expected);
        expect(await renderAll(replaced, renders, true)).toEqual(expected);
      }
    );

    it('useGT()', async () => {
      const code = compileJsx(`import { useGT } from 'gt-react/unstable';
        export function App({ name }) {
          const gt = useGT();
          return <span title={gt\`Greeting\`}>{gt\`Hello \${{ name }}\`}</span>;
        }`);
      const output = await transformWithPlugin(undefined, code);
      const [greeting, hello] = [
        ...(output ?? '').matchAll(/\$_hash: "([^"]+)"/g),
      ].map((match) => match[1]);
      const translations = {
        [greeting]: 'Salutation',
        [hello]: ['Bonjour ', ['name']],
      };
      const embedded = await transformWithPlugin(
        buildOptions(translations, { replaceSource: false }),
        code
      );
      const replaced = await transformWithPlugin(
        buildOptions(translations, { replaceSource: true }),
        code
      );
      expect(replaced).toContain('title: "Salutation"');
      expect(replaced).toContain('`Bonjour ${{ name }}`');
      expect(replaced).not.toMatch(/Greeting|Hello/);
      const [before, after] = await Promise.all([
        renderAll(embedded!, [{ name: 'Ada' }]),
        renderAll(replaced!, [{ name: 'Ada' }]),
      ]);
      expect(after).toEqual(['<span title="Salutation">Bonjour Ada</span>']);
      expect(after).toEqual(before);

      runtime.setLocale('en');
      onTestFinished(() => runtime.setLocale(STATIC_LOCALE));
      const [source, sourceReplaced] = await Promise.all(
        [false, true].map((replaceSource) =>
          transformWithPlugin(
            sourceLocaleOptions('en', { replaceSource }),
            code
          )
        )
      );
      expect(sourceReplaced).toContain('title: "Greeting"');
      expect(sourceReplaced).toMatch(/gt\(\{ \$_hash: "[0-9a-f]+" \}\)`Hello /);
      expect(await renderAll(sourceReplaced!, [{ name: 'Ada' }])).toEqual(
        await renderAll(source!, [{ name: 'Ada' }])
      );
    });
  });

  describe.each(['en', 'en-GB'])(
    'renders <T> as it renders its source in a build for %s',
    (locale) => {
      beforeAll(() => runtime.setLocale(locale));
      afterAll(() => runtime.setLocale(STATIC_LOCALE));

      const sources = new Map(
        JSX_CASES.map((testCase) => [testCase.source, testCase] as const)
      );
      it.each(
        [...sources.values()].map((testCase) => [testCase.name, testCase])
      )('%s', async (_name, { source, renders, gtConfig, sourceLocale }) => {
        const code = compileJsx(source);
        const [kept, replaced] = await Promise.all(
          [false, true].map((replaceSource) =>
            transformWithPlugin(
              sourceLocaleOptions(locale, { replaceSource, gtConfig }),
              code
            )
          )
        );
        if (sourceLocale === 'kept') {
          expect(replaced).toBe(kept);
        } else {
          expect(kept).toMatch(/[^$]_hash:/);
          expect(replaced).not.toMatch(/[^$]_hash:|jsxs?\(T,/);
        }
        const [before, after] = await Promise.all([
          renderAll(kept!, renders),
          renderAll(replaced!, renders),
        ]);
        expect(after).toEqual(before);
        for (const html of after) expect(html).not.toBe('');
      });
    }
  );

  describe.each(Object.entries(PLACEMENTS))(
    'renders a replaced <T> that is %s as <T> renders there',
    (_placement, place) => {
      const placed = placeCases(JSX_CASES, place);

      it('in a translated build', async () => {
        for (const { name, source, translation, renders, gtConfig } of placed) {
          const { embedded, replaced } = await buildBothWays(
            compileJsx(source),
            translation,
            { gtConfig }
          );
          expect(
            await renderAll(replaced, renders),
            `${name}\n${replaced}`
          ).toEqual(await renderAll(embedded, renders));
        }
      });

      it('in a build for the source locale', async () => {
        runtime.setLocale('en');
        onTestFinished(() => runtime.setLocale(STATIC_LOCALE));
        for (const { name, source, renders, gtConfig } of placed) {
          const code = compileJsx(source);
          const [kept, replaced] = await Promise.all(
            [false, true].map((replaceSource) =>
              transformWithPlugin(
                sourceLocaleOptions('en', { replaceSource, gtConfig }),
                code
              )
            )
          );
          expect(
            await renderAll(replaced!, renders),
            `${name}\n${replaced}`
          ).toEqual(await renderAll(kept!, renders));
        }
      });
    }
  );

  it('rewrites <T> as the JSX its translation renders', async () => {
    const { replaced } = await checkCase(
      JSX_CASES.find(
        (testCase) =>
          testCase.name ===
          '<Plural> with elements and variables in its branches'
      )!
    );
    expect(replaced).toMatchInlineSnapshot(`
      "import { Fragment, jsx, jsxs } from "react/jsx-runtime";
      import { T, Num, Plural } from "gt-react";
      function App({ n }) {
        return /* @__PURE__ */jsxs(Fragment, { children: ["Vous avez ", /* @__PURE__ */jsx(

            Plural, { n, one: /* @__PURE__ */jsxs(Fragment, { children: [/* @__PURE__ */jsx(
                  "b", { children: "un" }), " message"] }), other: /* @__PURE__ */jsxs(

                Fragment, { children: [
                  /* @__PURE__ */jsx(Num, { children: n }), " messages"] }), many: /* @__PURE__ */jsxs(Fragment, { children: [/* @__PURE__ */jsx(Num, { children: n }), " de messages"] }) })] }


        );
      }
      export {
        App };"
    `);
  });

  it('rewrites a template as its translation, keeping its variables and inline option', async () => {
    const { replaced } = await checkCase(
      TEMPLATE_CASES.find(
        (testCase) => testCase.name === 'text with template syntax'
      )!,
      true
    );
    expect(replaced).toMatchInlineSnapshot(`
      "import { t } from "gt-react/unstable";
      const App = ({ name }) => t({ $_hash: "728c62f6bce558d1", inline: (locale) => locale === "fr" ? ["Utilisez \`code\`, \${x} et \\\\ pour ", ["name"], "\\r\\n"] : void 0 })\`Utilisez \\\`code\\\`, \\\${x} et \\\\ pour \${{ name }}\\r
      \`;export {
        App };"
    `);
  });

  it('compiles a template without variables to the text it renders', async () => {
    const code = compileJsx(`import { t, useGT } from 'gt-react/unstable';
      export const title = () => t\`Settings\`;
      export function App({ name }) {
        const gt = useGT();
        return <button title={gt({ context: 'tooltip' })\`Save\`}>{t\`Save\`} {gt\`Hi \${{ name }}\`}</button>;
      }`);
    const output = (await transformWithPlugin(undefined, code))!;
    const [settings, tooltip, save, hi] = [
      ...output.matchAll(/\$_hash: "([^"]+)"/g),
    ].map((match) => match[1]);
    const translated = await transformWithPlugin(
      buildOptions(
        {
          [settings]: 'Paramètres',
          [tooltip]: 'Enregistrer les modifications',
          [save]: 'Enregistrer',
          [hi]: ['Salut ', ['name']],
        },
        { replaceSource: true }
      ),
      code
    );
    expect(translated).toMatchInlineSnapshot(`
      "import { jsxs } from "react/jsx-runtime";
      import { t, useGT } from "gt-react/unstable";
      const title = () => "Paramètres";
      function App({ name }) {
        const gt = useGT();
        return /* @__PURE__ */jsxs("button", { title: "Enregistrer les modifications", children: ["Enregistrer",

          " ",
          gt({ $_hash: "982bebc72bdeffdf", inline: (locale) => locale === "fr" ? ["Salut ", ["name"]] : void 0 })\`Salut \${{ name }}\`]
        });
      }
      export {
        App,
        title };"
    `);
    expect(
      await transformWithPlugin(
        sourceLocaleOptions('en', { replaceSource: true }),
        code
      )
    ).toMatchInlineSnapshot(`
      "import { jsxs } from "react/jsx-runtime";
      import { t, useGT } from "gt-react/unstable";
      const title = () => "Settings";
      function App({ name }) {
        const gt = useGT();
        return /* @__PURE__ */jsxs("button", { title: "Save", children: ["Save",

          " ",
          gt({ $_hash: "982bebc72bdeffdf" })\`Hi \${{ name }}\`]
        });
      }
      export {
        App,
        title };"
    `);
  });

  it('replaces each call site that shares a hash', async () => {
    const code = compileJsx(`${IMPORTS}
      import { t } from 'gt-react/unstable';
      export function App() {
        return <><T>Save</T><T>Save</T><span>{t\`Save\`}{t\`Save\`}</span></>;
      }`);
    const output = await transformWithPlugin(undefined, code);
    const [jsxHash, templateHash] = [
      ...new Set(
        [...(output ?? '').matchAll(/\$?_hash: "([^"]+)"/g)].map(
          (match) => match[1]
        )
      ),
    ];
    const replaced = await transformWithPlugin(
      buildOptions(
        { [jsxHash]: 'Enregistrer', [templateHash]: 'Sauvegarder' },
        { replaceSource: true }
      ),
      code
    );
    expect(replaced).not.toContain('Save');
    expect(replaced?.match(/"Enregistrer"/g)).toHaveLength(2);
    expect(replaced?.match(/"Sauvegarder"/g)).toHaveLength(2);
    const [html] = await renderAll(replaced!, [{}]);
    expect(html).toBe(
      'EnregistrerEnregistrer<span>SauvegarderSauvegarder</span>'
    );
  });

  it.each([
    ['', ''],
    ['<div>', '<p>{gt("Third")}</p></div>'],
  ])(
    'keeps the hashes of translation calls in and after a <T> the translation reorders, inside "%s"',
    async (open, close) => {
      const code = compileJsx(`import { T, useGT } from 'gt-react';
      export function App() {
        const gt = useGT();
        return ${open}<T><button onClick={() => gt('First')}>A</button> <button onClick={() => gt('Second')}>B</button></T>${close};
      }`);
      const output = (await transformWithPlugin(undefined, code))!;
      const [, hash] = output.match(/[^$]_hash: "([^"]+)"/)!;
      const replaced = (await transformWithPlugin(
        buildOptions(
          {
            [hash]: [
              { t: 'button', i: 2, c: 'Deux' },
              ' ',
              { t: 'button', i: 1, c: 'Un' },
            ],
          },
          { replaceSource: true }
        ),
        code
      ))!;
      const calls = (text: string) =>
        [...text.matchAll(/gt\("(\w+)", \{ "\$_hash": "(\w+)" \}\)/g)]
          .map(([, message, messageHash]) => `${message} ${messageHash}`)
          .sort();
      expect(replaced).toContain('"Deux"');
      expect(calls(output)).toHaveLength(open ? 3 : 2);
      expect(calls(replaced)).toEqual(calls(output));
      expect(
        calls(
          (await transformWithPlugin(
            sourceLocaleOptions('en', { replaceSource: true }),
            code
          ))!
        )
      ).toEqual(calls(output));
    }
  );

  it('puts what a replaced <T> renders among the children of its element', async () => {
    const code = compileJsx(`import { T, Num } from 'gt-react';
      const Box = ({ children }) => <div>{children}</div>;
      export function App({ n, open, items }) {
        return (
          <ul>
            <li><T>Save</T></li>
            <li>Count: <T><Num>{n}</Num> files</T>!</li>
            <li><T><Num>{n}</Num> files</T></li>
            <li>{open ? <T>Save</T> : null}{open && <T><Num>{n}</Num> files</T>}</li>
            {items.map((item) => <T key={item}>Save</T>)}
            <Box><T>Save</T></Box>
          </ul>
        );
      }`);
    const output = (await transformWithPlugin(undefined, code))!;
    const [save, files] = [
      ...new Set(
        [...output.matchAll(/[^$]_hash: "([^"]+)"/g)].map((match) => match[1])
      ),
    ];
    const translated = await transformWithPlugin(
      buildOptions(
        {
          [save]: 'Enregistrer',
          [files]: [{ k: '_gt_n_1', i: 1, v: 'n' }, ' fichiers'],
        },
        { replaceSource: true }
      ),
      code
    );
    expect(translated).toMatchInlineSnapshot(`
      "import { Fragment as _Fragment } from "react/jsx-runtime";import { jsx, jsxs } from "react/jsx-runtime";
      import { T, Num } from "gt-react";
      const Box = ({ children }) => /* @__PURE__ */jsx("div", { children });
      function App({ n, open, items }) {
        return /* @__PURE__ */jsxs("ul", { children: [
          /* @__PURE__ */jsx("li", { children: "Enregistrer" }),
          /* @__PURE__ */jsxs("li", { children: [
            "Count: ",

            /* @__PURE__ */jsx(Num, { children: n }), " fichiers",


            "!"]
          }),
          /* @__PURE__ */jsxs("li", { children: [
            /* @__PURE__ */jsx(Num, { children: n }), " fichiers"]

          }),
          /* @__PURE__ */jsxs("li", { children: [
            open ? "Enregistrer" : null,
            open && /* @__PURE__ */jsxs(_Fragment, { children: [
              /* @__PURE__ */jsx(Num, { children: n }), " fichiers"] }

            )]
          }),
          items.map((item) => /* @__PURE__ */jsx(_Fragment, { children: "Enregistrer" }, item)),
          /* @__PURE__ */jsx(Box, { children: /* @__PURE__ */jsx(_Fragment, { children: "Enregistrer" }) })]
        });
      }
      export {
        App };"
    `);
    expect(
      await transformWithPlugin(
        sourceLocaleOptions('en', { replaceSource: true }),
        code
      )
    ).toMatchInlineSnapshot(`
      "import { Fragment as _Fragment } from "react/jsx-runtime";import { jsx, jsxs } from "react/jsx-runtime";
      import { T, Num } from "gt-react";
      const Box = ({ children }) => /* @__PURE__ */jsx("div", { children });
      function App({ n, open, items }) {
        return /* @__PURE__ */jsxs("ul", { children: [
          /* @__PURE__ */jsx("li", { children: "Save" }),
          /* @__PURE__ */jsxs("li", { children: [
            "Count: ",

            /* @__PURE__ */jsx(Num, { children: n }),
            " files",

            "!"]
          }),
          /* @__PURE__ */jsxs("li", { children: [
            /* @__PURE__ */jsx(Num, { children: n }),
            " files"]
          }),
          /* @__PURE__ */jsxs("li", { children: [
            open ? "Save" : null,
            open && /* @__PURE__ */jsxs(_Fragment, { children: [
              /* @__PURE__ */jsx(Num, { children: n }),
              " files"] }
            )]
          }),
          items.map((item) => /* @__PURE__ */jsx(_Fragment, { children: "Save" }, item)),
          /* @__PURE__ */jsx(Box, { children: /* @__PURE__ */jsx(_Fragment, { children: "Save" }) })]
        });
      }
      export {
        App };"
    `);
  });

  it('leaves a <T> inside another <T> alone', async () => {
    const code = compileJsx(
      app(
        '<T>Outer <T><Var name="a">{a}</Var> and <Var name="b">{b}</Var></T></T>',
        '{ a, b }'
      )
    );
    const output = (await transformWithPlugin(undefined, code))!;
    const [inner, outer] = [...output.matchAll(/[^$]_hash: "([^"]+)"/g)].map(
      (match) => match[1]
    );
    const innerTranslation = [
      { k: 'b', i: 2, v: 'v' },
      ' puis ',
      { k: 'a', i: 1, v: 'v' },
    ];
    for (const translations of [
      { [inner]: innerTranslation },
      {
        [outer]: [
          'Extérieur ',
          {
            t: 'T',
            i: 1,
            c: [{ k: 'a', i: 2, v: 'v' }, ' et ', { k: 'b', i: 3, v: 'v' }],
          },
        ],
        [inner]: innerTranslation,
      },
    ]) {
      const [embedded, replaced] = await Promise.all(
        [false, true].map((replaceSource) =>
          transformWithPlugin(
            buildOptions(translations, { replaceSource }),
            code
          )
        )
      );
      expect(replaced).toBe(embedded);
    }
  });

  it('imports Fragment where the file lacks it', async () => {
    const code = `
      import { jsx as _jsx } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      const Fragment = 'shadowed';
      export const App = () => _jsx(T, { children: "Hello" });
    `;
    const hash = await getInjectedHash(code);
    const replaced = await transformWithPlugin(
      buildOptions({ [hash]: 'Bonjour' }, { replaceSource: true }),
      code
    );
    expect(replaced).toContain(
      'import { Fragment as _Fragment } from "react/jsx-runtime";'
    );
    expect(replaced).toContain('_jsx(_Fragment, { children: "Bonjour" })');
  });

  it('leaves msg() and derive content alone', async () => {
    const code = compileJsx(`${IMPORTS}
      import { msg, t, derive } from 'gt-react/unstable';
      import { Derive } from 'gt-react';
      export const message = msg\`Hello\`;
      export const derived = (x) => t\`Hi \${derive(x)}\`;
      export function App({ x }) { return <T>Hi <Derive>{x}</Derive></T>; }`);
    const embedded = await transformWithPlugin(
      buildOptions({}, { replaceSource: false }),
      code
    );
    const replaced = await transformWithPlugin(
      buildOptions({}, { replaceSource: true }),
      code
    );
    expect(replaced).toBe(embedded);
  });

  it('keeps <T> a component when _tagIds needs its hash on the DOM', async () => {
    const code = compileJsx(`${IMPORTS}
      import { t } from 'gt-react/unstable';
      export const App = () => <T>Hello</T>;
      export const label = () => t\`Hello\`;`);
    const output = await transformWithPlugin(undefined, code);
    const translations = Object.fromEntries(
      [...(output ?? '').matchAll(/\$?_hash: "([^"]+)"/g)].map((match) => [
        match[1],
        'Bonjour',
      ])
    );
    const replaced = await transformWithPlugin(
      buildOptions(translations, {
        replaceSource: true,
        gtConfig: { _tagIds: true },
      }),
      code
    );
    expect(replaced).toMatch(/jsx\(T, \{ children: "Hello", inline:/);
    expect(replaced).toContain('const label = () => "Bonjour";');
  });

  it.each(['physical', 'virtual'] as const)(
    'needs no message module for a replaced <T> or text with %s modules',
    async (modules) => {
      const code = compileJsx(`${IMPORTS}
        import { t } from 'gt-react/unstable';
        export const App = () => <T>Hello</T>;
        export const label = () => t\`Hello\`;
        export const greeting = (name) => t\`Hello \${{ name }}\`;`);
      const output = await transformWithPlugin(undefined, code);
      const [jsxHash, textHash, templateHash] = [
        ...(output ?? '').matchAll(/\$?_hash: "([^"]+)"/g),
      ].map((match) => match[1]);
      const options = buildOptions(
        {
          [jsxHash]: 'Bonjour (T)',
          [textHash]: 'Bonjour (t)',
          [templateHash]: ['Bonjour ', ['name']],
        },
        { replaceSource: true }
      );
      options.gtConfig!.files!.gt!.inlineTranslations!.modules = modules;
      const replaced = await transformWithPlugin(options, code);
      expect(replaced).toMatch(
        /jsx\(_Fragment, \{ children: "Bonjour \(T\)" \}\)/
      );
      expect(replaced).toContain('const label = () => "Bonjour (t)";');
      expect(replaced).not.toContain(`__gt_inline_${jsxHash}`);
      expect(replaced).not.toContain(`__gt_inline_${textHash}`);
      // A template with variables still reads its translation from its module
      expect(replaced).toContain(`inline: __gt_inline_${templateHash}`);
      expect(replaced).toContain('`Bonjour ${{ name }}`');
    }
  );

  it('rewrites <T> as the JSX of its children in a build for the source locale', async () => {
    const code = compileJsx(
      app(
        '<T id="inbox">You have <Plural n={n} one={<><b>one</b> message</>} other={<><Num>{n}</Num> messages</>} /></T>',
        '{ n }'
      )
    );
    // Without translations to embed, as the source locale needs none
    const replaced = await transformWithPlugin(
      {
        experimentalStaticLocale: 'en',
        experimentalReplaceSource: true,
        gtConfig: { defaultLocale: 'en', locales: ['fr'] },
      },
      code
    );
    expect(replaced).toMatchInlineSnapshot(`
      "import { Fragment, jsx, jsxs } from "react/jsx-runtime";
      import { T, Num, Plural } from "gt-react";
      function App({ n }) {
        return /* @__PURE__ */jsxs(Fragment, { children: [
          "You have ",
          /* @__PURE__ */jsx(Plural, { n, one: /* @__PURE__ */jsxs(Fragment, { children: [
              /* @__PURE__ */jsx("b", { children: "one" }),
              " message"]
            }), other: /* @__PURE__ */jsxs(Fragment, { children: [
              /* @__PURE__ */jsx(Num, { children: n }),
              " messages"]
            }) })] }
        );
      }
      export {
        App };"
    `);
  });

  it('leaves <T> with _tagIds and templates with variables alone in a build for the source locale', async () => {
    const code = compileJsx(`${IMPORTS}
      import { t } from 'gt-react/unstable';
      export const App = () => <T>Hello</T>;
      export const label = (name) => t\`Hello \${{ name }}\`;`);
    const options = (replaceSource: boolean, gtConfig?: GTConfig) =>
      sourceLocaleOptions('en', { replaceSource, gtConfig });
    const kept = await transformWithPlugin(options(false), code);
    const replaced = await transformWithPlugin(options(true), code);
    expect(replaced).toContain('jsx(_Fragment, { children: "Hello" })');
    expect(replaced).toContain('t({ $_hash: "');
    expect(
      await transformWithPlugin(options(true, { _tagIds: true }), code)
    ).toBe(kept);
  });

  it('changes nothing for a static locale that is not embedded', async () => {
    const code = compileJsx(app('<T>Hello</T>'));
    const options = (replaceSource: boolean) => ({
      ...buildOptions(
        {},
        { replaceSource, gtConfig: { locales: ['fr', 'de'] } }
      ),
      experimentalStaticLocale: 'de',
    });
    expect(await transformWithPlugin(options(true), code)).toBe(
      await transformWithPlugin(options(false), code)
    );
  });

  it('changes nothing outside production builds', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const code = compileJsx(app('<T>Hello</T>'));
    const hash = await getInjectedHash(code);
    const replaced = await transformWithPlugin(
      buildOptions({ [hash]: 'Bonjour' }, { replaceSource: true }),
      code
    );
    expect(replaced).toContain('"Hello"');
    expect(replaced).not.toContain('Bonjour');
    expect(
      await transformWithPlugin(
        sourceLocaleOptions('en', { replaceSource: true }),
        code
      )
    ).toMatch(/jsx\(T, \{ children: "Hello", _hash:/);
  });

  describe('options', () => {
    function createPlugin(options: GTUnpluginOptions) {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        return gtUnplugin.raw(options, { framework: 'vite' });
      } finally {
        warn.mockRestore();
      }
    }

    function runBuildStart(options: GTUnpluginOptions) {
      const { buildStart } = createPlugin(options);
      return () => (buildStart as () => void).call({});
    }

    it('throws in production builds without a static locale', () => {
      const options = buildOptions({}, { replaceSource: true });
      delete options.experimentalStaticLocale;
      expect(runBuildStart(options)).toThrow(
        '@generaltranslation/compiler Error: experimentalReplaceSource is set, but this build has no static locale'
      );
    });

    it('allows development builds without a static locale', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const options = buildOptions({}, { replaceSource: true });
      delete options.experimentalStaticLocale;
      expect(runBuildStart(options)).not.toThrow();
    });

    it.each([
      ['true', true],
      ['1', true],
      [' TRUE ', true],
      ['false', false],
      ['0', false],
      ['', false],
    ])('reads GT_REPLACE_SOURCE=%j', async (value, replaces) => {
      vi.stubEnv('GT_REPLACE_SOURCE', value);
      const code = compileJsx(app('<T>Hello</T>'));
      const hash = await getInjectedHash(code);
      const options = buildOptions(
        { [hash]: 'Bonjour' },
        { replaceSource: false }
      );
      delete options.experimentalReplaceSource;
      const output = await transformWithPlugin(options, code);
      expect(output?.includes('jsx(_Fragment')).toBe(replaces);
    });

    it('lets the option override GT_REPLACE_SOURCE', async () => {
      vi.stubEnv('GT_REPLACE_SOURCE', 'true');
      const code = compileJsx(app('<T>Hello</T>'));
      const hash = await getInjectedHash(code);
      const output = await transformWithPlugin(
        buildOptions({ [hash]: 'Bonjour' }, { replaceSource: false }),
        code
      );
      expect(output).toContain('inline:');
    });

    it('rejects a GT_REPLACE_SOURCE that is not a boolean', () => {
      vi.stubEnv('GT_REPLACE_SOURCE', 'yes');
      const options = buildOptions({}, { replaceSource: false });
      delete options.experimentalReplaceSource;
      expect(() => createPlugin(options)).toThrow(
        '@generaltranslation/compiler Error: GT_REPLACE_SOURCE is set to "yes", which is not a boolean'
      );
    });

    it('reports call sites that keep their source at debug level', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const code = compileJsx(app('<T>Hello, <b>World!</b></T>'));
      const hash = await getInjectedHash(code);
      const options = buildOptions(
        { [hash]: ['Bonjour, ', { t: 'b', i: 9, c: 'le Monde !' }] },
        { replaceSource: true, logLevel: 'debug' }
      );
      const plugin = createPlugin(options);
      const build = async () => {
        (plugin.buildStart as () => void).call({});
        await (plugin.transform as (code: string, id: string) => unknown).call(
          { addWatchFile() {} },
          code,
          '/app/App.tsx'
        );
        (plugin.buildEnd as () => void).call({});
      };
      await build();
      // A watch rebuild reports its own call sites
      await build();
      const messages = log.mock.calls.map(([message]) => String(message));
      log.mockRestore();
      expect(messages.slice(2)).toEqual(messages.slice(0, 2));
      expect(messages.slice(0, 2)).toEqual([
        expect.stringMatching(
          new RegExp(
            `Kept the source of <T> ${hash}, with its embedded translation: the translation does not match the source children /app/App.tsx:\\d+:\\d+$`
          )
        ),
        expect.stringContaining(
          'In the modules this build transformed, replaced the source content of 0 call sites with their "fr" translations; 1 call sites kept their source and embedded translation'
        ),
      ]);
    });

    it('reports the call sites a build for the source locale keeps at debug level', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const code = compileJsx(`${IMPORTS}
        import { t } from 'gt-react/unstable';
        export const App = ({ date }) => <>
          <T>Hello</T><T>Posted <RelativeTime>{date}</RelativeTime></T>
          {t\`Save\`}{t({ maxChars: 3 })\`Cancel\`}
        </>;`);
      const plugin = createPlugin({
        ...sourceLocaleOptions('en', { replaceSource: true }),
        logLevel: 'debug',
      });
      (plugin.buildStart as () => void).call({});
      await (plugin.transform as (code: string, id: string) => unknown).call(
        { addWatchFile() {} },
        code,
        '/app/App.tsx'
      );
      (plugin.buildEnd as () => void).call({});
      const messages = log.mock.calls.map(([message]) => String(message));
      log.mockRestore();
      expect(messages).toEqual([
        expect.stringMatching(
          /Kept <T> [0-9a-f]+ as a component: <RelativeTime> has props it formats differently outside <T> \/app\/App.tsx:\d+:\d+$/
        ),
        expect.stringMatching(
          /Kept template [0-9a-f]+ as a call: maxChars cuts its text off at runtime \/app\/App.tsx:\d+:\d+$/
        ),
        expect.stringContaining(
          'In the modules this build transformed, replaced 2 call sites with the source content they render; 2 call sites were kept as they are'
        ),
      ]);
    });
  });
});

describe('selectPluralForm', () => {
  const FORM_SETS = [
    ['one', 'other'],
    ['one', 'few', 'many', 'other'],
    ['zero', 'one', 'two', 'few', 'many', 'other'],
    ['singular', 'plural'],
    ['singular', 'dual', 'plural'],
    ['zero', 'other'],
    ['two', 'other'],
    ['few'],
    [],
  ];
  const LOCALES = ['en', 'fr', 'ru', 'pl', 'ar', 'cy', 'ja', 'sl', 'ga'];
  const COUNTS = [
    0, 1, 2, 3, 4, 5, 6, 7, 11, 12, 21, 22, 100, 101, 1e6, 0.5, 1.5, -1, -2,
  ];

  it('picks the branch getPluralForm picks', () => {
    for (const locale of LOCALES) {
      const rules = new Intl.PluralRules(locale);
      for (const n of COUNTS) {
        const abs = Math.abs(n);
        const scenario = {
          count: abs === 0 || abs === 1 || abs === 2 ? abs : 'other',
          category: rules.select(n),
        } as const;
        for (const forms of FORM_SETS) {
          expect([locale, n, forms, selectPluralForm(scenario, forms)]).toEqual(
            [locale, n, forms, getPluralForm(n, forms as never, [locale])]
          );
        }
      }
    }
  });

  it('covers every scenario a locale can produce', () => {
    const keys = new Set(
      PLURAL_SCENARIOS.map(({ count, category }) => `${count}:${category}`)
    );
    for (const locale of LOCALES) {
      const rules = new Intl.PluralRules(locale);
      for (const n of COUNTS) {
        const abs = Math.abs(n);
        const count = abs === 0 || abs === 1 || abs === 2 ? abs : 'other';
        expect(keys).toContain(`${count}:${rules.select(n)}`);
      }
    }
  });
});
