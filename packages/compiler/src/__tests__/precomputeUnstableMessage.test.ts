/**
 * Precomputed messages: a static unstable `t` template becomes a call that
 * reads its message, built at compile time and declared at module scope. The
 * equivalence table compiles each case with and without `precomputeMessages`
 * and renders both in gt-react: the output must match.
 */
import generateModule from '@babel/generator';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { build } from 'esbuild';
import { hashSource } from 'generaltranslation/id';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  compileJsx,
  evaluateModule,
  loadGTRuntime,
  type GTRuntime,
} from './sourceReplacementHarness';
import { injectUnstableTaggedTemplateHash } from '../transform/injection/injectUnstableTaggedTemplateHash';
import { buildPrecomputedCall } from '../transform/injection/precomputeUnstableMessage';
import { canReplaceMessageTree } from '../transform/injection/replaceMessageTree';
import { transformWithPlugin } from './transformWithPlugin';

const generate =
  (generateModule as unknown as { default?: typeof generateModule }).default ??
  generateModule;
const traverse =
  (traverseModule as unknown as { default?: typeof traverseModule }).default ??
  traverseModule;

const HELPERS =
  't, m, msg, useGT, plural, selectordinal, select, number, date, time, part, derive, n';

const module = (body: string) =>
  `import { ${HELPERS} } from 'gt-react/unstable';\n${body}\n`;

// Generated code keeps source lines, which breaks lines inside a message.
const compile = async (body: string) =>
  (await transformWithPlugin(undefined, module(body)))?.replace(/\s+/g, ' ') ??
  null;

const hashOf = (source: unknown, metadata: Record<string, unknown> = {}) =>
  hashSource({
    source: source as string,
    dataFormat: 'MESSAGE_TREE',
    ...metadata,
  });

// A thrown transform error is logged and returns null; fail on it.
const consoleError = vi.spyOn(console, 'error');
afterEach(() => {
  const { calls } = consoleError.mock;
  consoleError.mockClear();
  expect(calls).toEqual([]);
});

describe('emitted messages', () => {
  it.each([
    [
      'literal options',
      "t({ context: 'greeting', maxChars: -8, requiresReview: true })`Hello, ${{ name }}!`;",
      '{ $_hash: "#", $_tree: ["Hello, ", ["name"], "!"], context: "greeting", maxChars: -8, requiresReview: true }',
      't(_gt, { name });',
      ['Hello, ', ['name'], '!'],
      { context: 'greeting', maxChars: -8, requiresReview: true },
    ],
    [
      'named variables, whose values may be any expression',
      't`Hello, ${{ name }}! Card ${{ card: data.card }}`;',
      '{ $_hash: "#", $_tree: ["Hello, ", ["name"], "! Card ", ["card"]] }',
      't(_gt, { name, card: data.card });',
      ['Hello, ', ['name'], '! Card ', ['card']],
      {},
    ],
    [
      'values without a name, numbered in tree order',
      "const total = 3;\nt`${total} of ${total + 1}: ${select({ role }, { b: part`${'B'}`, a: part`${'A'}` })}`;",
      '{ $_hash: "#", $_tree: [["_gt_1"], " of ", ["_gt_2"], ": ", ["role", "select", { a: [["_gt_3"]], b: [["_gt_4"]], other: "" }]] }',
      // Evaluated in source order, where b comes before a.
      "t(_gt, { _gt_1: total, _gt_2: total + 1, role, _gt_4: 'B', _gt_3: 'A' });",
      [
        ['_gt_1'],
        ' of ',
        ['_gt_2'],
        ': ',
        ['role', 'select', { a: [['_gt_3']], b: [['_gt_4']], other: '' }],
      ],
      {},
    ],
    [
      'plural with part and n',
      't`${plural({ count }, { one: part`${n} item`, other: part`${n} items for ${{ name }}` })}`;',
      '{ $_hash: "#", $_tree: [["count", "plural", { one: [0, " item"], other: [0, " items for ", ["name"]] }]] }',
      't(_gt, { count, name });',
      [
        [
          'count',
          'plural',
          { one: [0, ' item'], other: [0, ' items for ', ['name']] },
        ],
      ],
      {},
    ],
    [
      'selectordinal',
      't`${selectordinal({ place }, { one: part`${n}st`, other: part`${n}th` })}`;',
      '{ $_hash: "#", $_tree: [["place", "selectordinal", { one: [0, "st"], other: [0, "th"] }]] }',
      't(_gt, { place });',
      [['place', 'selectordinal', { one: [0, 'st'], other: [0, 'th'] }]],
      {},
    ],
    [
      'select',
      "t`${select({ role }, { admin: 'Admin', other: 'User' })}`;",
      '{ $_hash: "#", $_tree: [["role", "select", { admin: "Admin", other: "User" }]] }',
      't(_gt, { role });',
      [['role', 'select', { admin: 'Admin', other: 'User' }]],
      {},
    ],
    [
      'number with a literal formatting context',
      "t`Total ${number({ price }, { style: 'currency', maximumFractionDigits: 0, currency: 'USD' })}`;",
      '{ $_hash: "#", $_tree: ["Total ", ["price", "number", "currency"]], $_formats: { price: { currency: \'USD\', maximumFractionDigits: 0 } } }',
      't(_gt, { price });',
      ['Total ', ['price', 'number', 'currency']],
      {},
    ],
    [
      'date and time with a formatting context read at runtime',
      "t`Due ${date({ due }, { style: 'medium', timeZone })} at ${time({ at: due }, { style: 'short', timeZone: zones.user })}`;",
      '{ $_hash: "#", $_tree: ["Due ", ["due", "date", "medium"], " at ", ["at", "time", "short"]] }',
      't(_gt, { due, at: due }, { due: { timeZone }, at: { timeZone: zones.user } });',
      ['Due ', ['due', 'date', 'medium'], ' at ', ['at', 'time', 'short']],
      {},
    ],
    [
      'a variable repeated with the same value',
      't`${{ name }} and ${{ name }}`;',
      '{ $_hash: "#", $_tree: [["name"], " and ", ["name"]] }',
      't(_gt, { name });',
      [['name'], ' and ', ['name']],
      {},
    ],
  ])('precomputes %s', async (_name, body, message, call, tree, metadata) => {
    const output = await compile(body);
    expect(output).toContain(
      `const _gt = ${message.replace('#', hashOf(tree, metadata))};`
    );
    expect(output).toContain(call);
  });

  it.each([
    ['text', 't`Save`;', 't({ $_hash: "#", $_tree: "Save" });', {}],
    [
      'text with literal options',
      "t({ context: 'button', maxChars: -8, requiresReview: true })`Save`;",
      't({ $_hash: "#", $_tree: "Save", context: "button", maxChars: -8, requiresReview: true });',
      { context: 'button', maxChars: -8, requiresReview: true },
    ],
  ])(
    'writes the message of %s at its call',
    async (_name, body, call, metadata) => {
      const output = await compile(body);
      expect(output).toContain(call.replace('#', hashOf('Save', metadata)));
      expect(output).not.toContain('const _gt');
    }
  );

  it('writes a message with values at its call when given nothing to declare it with', () => {
    const call = buildPrecomputedCall({
      callee: t.identifier('t'),
      hash: 'hash',
      metadata: {},
      tree: ['Bonjour, ', ['name']],
      bindings: [{ name: 'name', value: t.identifier('name') }],
      locale: 'fr',
      hoist: undefined,
    });
    expect(generate(call!, { concise: true }).code).toBe(
      't({ $_hash: "hash", $_tree: ["Bonjour, ", ["name"]], $_locale: "fr" }, { name })'
    );
  });

  it('marks every message with the default locale in a build that renders the source', () => {
    const ast = parse(
      `import { t, plural, part, n } from 'gt-react/unstable';
t\`\${plural({ count }, { one: part\`\${n} item\`, other: part\`\${n} items\` })}\`;
t({ maxChars: 8 })\`Save all changes\`;`,
      { sourceType: 'module' }
    );
    const declared: string[] = [];
    traverse(ast, {
      TaggedTemplateExpression(path) {
        injectUnstableTaggedTemplateHash(path, undefined, undefined, {
          hoist: (message) => {
            declared.push(generate(message, { concise: true }).code);
            return t.identifier('_gt');
          },
          replacedLocale: undefined,
          sourceLocale: 'en',
        });
      },
    });
    const tree =
      '[["count", "plural", { one: [0, " item"], other: [0, " items"] }]]';
    expect(declared).toEqual([
      `{ $_hash: "${hashOf([['count', 'plural', { one: [0, ' item'], other: [0, ' items'] }]])}", $_tree: ${tree}, $_locale: "en" }`,
    ]);
    const { code } = generate(ast, { concise: true });
    expect(code).toContain('t(_gt, { count });');
    expect(code).toContain(
      `t({ $_hash: "${hashOf('Save all changes', { maxChars: 8 })}", $_tree: "Save all changes", maxChars: 8, $_locale: "en" });`
    );
  });

  it('precomputes the templates of useGT() and getGT()', async () => {
    const output = await transformWithPlugin(
      undefined,
      `import { useGT } from 'gt-react/unstable';
import { getGT } from 'gt-next/unstable/server';
export function Label({ name }) {
  const gt = useGT();
  return gt\`Hello, \${{ name }}!\`;
}
export async function load() {
  const t = await getGT();
  return t\`Save\`;
}`
    );
    expect(output).toContain('return gt(_gt, { name });');
    expect(output).toContain(
      `return t({ $_hash: "${hashOf('Save')}", $_tree: "Save" });`
    );
  });

  it('declares each message with values once, after the imports', async () => {
    const output = await transformWithPlugin(
      undefined,
      `import { t } from 'gt-react/unstable';
const _gt = 'taken';
export const labels = (a, b) => [t\`Hi \${{ a }}\`, t\`Bye \${{ b }}\`, t\`Hi \${{ a: b }}\`];
import { other } from './other';`
    );
    const hi = `{ $_hash: "${hashOf(['Hi ', ['a']])}", $_tree: ["Hi ", ["a"]] }`;
    const bye = `{ $_hash: "${hashOf(['Bye ', ['b']])}", $_tree: ["Bye ", ["b"]] }`;
    expect(output).toContain(
      `import { other } from './other';const _gt2 = ${hi};const _gt3 = ${bye};`
    );
    expect(output).toContain(
      '[t(_gt2, { a }), t(_gt3, { b }), t(_gt2, { a: b })]'
    );
  });

  it.each([
    ['a msg template', 'msg`Save`;', 'msg({ $_hash: "#" })`Save`'],
    [
      'a name bound to two values',
      't`${{ name }} / ${{ name: other }}`;',
      't({ $_hash: "#" })`${{ name }} / ${{ name: other }}`',
    ],
    [
      'a repeated value with a side effect',
      't`${{ id: next() }} / ${{ id: next() }}`;',
      't({ $_hash: "#" })`${{ id: next() }} / ${{ id: next() }}`',
    ],
    [
      'a variable formatted twice',
      "t`${number({ price })} or ${number({ price }, { currency: 'USD' })}`;",
      't({ $_hash: "#" })`${number({ price })}',
    ],
    [
      'a formatting context that a value with a side effect could change',
      "t`${number({ price }, { style: 'currency', currency })} for ${{ name: next() }}`;",
      't({ $_hash: "#" })`${number({ price }',
    ],
    [
      'a formatting context with a side effect',
      "t`${number({ price }, { style: 'currency', currency: next() })}`;",
      't({ $_hash: "#" })`${number({ price }',
    ],
  ])('only injects the hash for %s', async (_name, body, expected) => {
    const output = await compile(body);
    expect(output).toMatch(/\$_hash: "[0-9a-f]+"/);
    expect(output).toContain(
      expected.replace('#', output!.match(/\$_hash: "([^"]+)"/)![1])
    );
    expect(output).not.toContain('$_tree');
  });

  it.each([
    ['derive()', 't`Role ${derive(role)}`;'],
    ['a dynamic branch', 't`${plural({ count }, { other: label })}`;'],
    ['a value that may be an object', 't`Hi ${props.user}`;'],
  ])('leaves a template with %s to the runtime', async (_name, body) => {
    expect(await compile(body)).toBeNull();
  });

  it('keeps the tagged templates when precomputeMessages is false', async () => {
    const output = await transformWithPlugin(
      { precomputeMessages: false },
      module('t`Hello, ${{ name }}!`;')
    );
    expect(output).toContain(
      `t({ $_hash: "${hashOf(['Hello, ', ['name'], '!'])}" })\`Hello, \${{ name }}!\``
    );
  });

  it('lets a bundler drop the message of an unused call site', async () => {
    const compiled = await transformWithPlugin(
      undefined,
      `import { t } from 'gt-react/unstable';
export const used = (name) => t\`Kept \${{ name }}\`;
export const unused = (n) => [t\`Dropped\`, t({ context: 'x' })\`Dropped \${{ n }} too\`];`
    );
    const { outputFiles } = await build({
      stdin: {
        contents: "import { used } from 'compiled';\nconsole.log(used('Ada'));",
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      external: ['gt-react/unstable'],
      plugins: [
        {
          name: 'compiled',
          setup({ onResolve, onLoad }) {
            onResolve({ filter: /^compiled$/ }, () => ({
              path: 'compiled',
              namespace: 'compiled',
            }));
            onLoad({ filter: /.*/, namespace: 'compiled' }, () => ({
              contents: compiled!,
            }));
          },
        },
      ],
    });
    const [{ text }] = outputFiles;
    expect(text).toContain('$_tree: ["Kept ", ["name"]]');
    expect(text).not.toContain('Dropped');
    expect(text.match(/\$_hash/g)).toHaveLength(1);
  });
});

describe("a translation as a replaced message's tree", () => {
  const source = [
    ['name'],
    ['role', 'select', { admin: 'Admin', other: 'User' }],
    ['count', 'plural', { one: [0, ' item'], other: [0, ' items'] }],
    ['price', 'number', 'currency'],
    ['due', 'date', 'medium'],
  ];

  it.each([
    ['text', 'Bonjour'],
    ['a value it repeats and one it drops', [['name'], ' ', ['name']]],
    ['any variable as a value', [['role'], ['count'], ['price'], ['due']]],
    [
      'a select with other branches',
      [['role', 'select', { admin: 'Admin', invitee: 'Invité', other: 'x' }]],
    ],
    [
      'a plural with other branches, and an ordinal',
      [
        ['count', 'plural', { one: 'un', many: 'des', other: [0] }],
        ['count', 'selectordinal', { one: [0, 'er'], other: [0, 'e'] }],
      ],
    ],
    [
      'a plural of a variable its source formats as a number',
      [['price', 'plural', { one: 'un', other: [0] }]],
    ],
    [
      'a number and a date written as in its source',
      [
        ['price', 'number', 'currency'],
        ['due', 'date', 'medium'],
      ],
    ],
    [
      'a variable inside a branch',
      [
        [
          'role',
          'select',
          { other: [['count', 'plural', { other: [['name']] }]] },
        ],
      ],
    ],
  ])('takes %s', (_name, translation) => {
    expect(canReplaceMessageTree(source as never, translation)).toBe(true);
  });

  it.each([
    ['a value that is not a tree', { text: 'Bonjour' }],
    ['a missing translation', undefined],
    ['a select without other', [['role', 'select', { admin: 'Admin' }]]],
    ['a variable its source lacks', ['Bonjour ', ['nom']]],
    [
      'a select of a value its source prints',
      [['name', 'select', { other: 'x' }]],
    ],
    ['a select of a count', [['count', 'select', { other: 'x' }]]],
    [
      'a plural of a value its source selects on',
      [['role', 'plural', { other: 'x' }]],
    ],
    ['a number its source counts with', [['count', 'number']]],
    ['a number in another style', [['price', 'number', 'percent']]],
    ['a date in another style', [['due', 'date', 'long']]],
    ['a time of a date', [['due', 'time', 'medium']]],
    [
      'a variable its source lacks inside a branch',
      [['role', 'select', { other: [['nom']] }]],
    ],
  ])('leaves %s to the embedded translation', (_name, translation) => {
    expect(canReplaceMessageTree(source as never, translation)).toBe(false);
  });
});

type Case = {
  name: string;
  /** Body of `App`, a function of `props` that returns the rendered text */
  body: string;
  /** Statements before `App` */
  setup?: string;
  translation?: unknown;
  renders?: Record<string, unknown>[];
  /** Whether the call site reads a precomputed message or stays a template */
  expected?: 'precomputed' | 'kept';
};

const DUE = new Date(Date.UTC(2024, 0, 15, 12));
const COUNTS = [0, 1, 2, 1.5, 1000000].map((count) => ({ count }));

const CASES: Case[] = [
  { name: 'text', body: 't`Save`', translation: 'Enregistrer' },
  { name: 'text without a translation', body: 't`Cancel`' },
  { name: 'empty text', body: 't``', translation: '' },
  {
    name: 'context and maxChars',
    body: "t({ context: 'button', maxChars: 8 })`Save all changes`",
    translation: 'Enregistrer toutes les modifications',
  },
  {
    name: 'negative maxChars on the source',
    body: 't({ maxChars: -8 })`Discard all changes`',
  },
  {
    name: 'named variables the translation reorders',
    body: 't`${{ name: props.name }} invited ${{ guest: props.guest }}`',
    translation: [['guest'], ' : invitation de ', ['name']],
    renders: [
      { name: 'Ada', guest: 'Grace' },
      { name: 12.5, guest: null },
      { name: 12n, guest: undefined },
      { name: true, guest: DUE },
    ],
  },
  {
    name: 'a variable repeated with the same value',
    body: 't`${{ name: props.name }} and ${{ name: props.name }}`',
    renders: [{ name: 'Ada' }],
  },
  {
    name: 'values without a name',
    setup: "const total = 3;\nconst label = total > 2 ? 'many' : 'few';",
    body: 't`${total} of ${total + 1}: ${label} ${!total} ${undefined} ${`${total}`}`',
    translation: [
      ['_gt_3'],
      ' : ',
      ['_gt_1'],
      ' sur ',
      ['_gt_2'],
      ['_gt_4'],
      ['_gt_5'],
      ['_gt_6'],
    ],
  },
  {
    name: 'a plural',
    body: 't`You have ${plural({ count: props.count }, { "=0": "no items", one: part`${n} item`, other: part`${n} items` })}.`',
    translation: [
      'Vous avez ',
      [
        'count',
        'plural',
        {
          '=0': 'aucun article',
          one: [0, ' article'],
          many: [0, " d'articles"],
          other: [0, ' articles'],
        },
      ],
      '.',
    ],
    renders: COUNTS,
  },
  {
    name: 'a plural with a select and a variable in its branches',
    body: "t`${plural({ count: props.count }, { one: part`${n} file from ${{ name: props.name }}`, other: part`${n} files for ${select({ role: props.role }, { admin: 'admins', other: 'everyone' })}` })}`",
    translation: [
      [
        'count',
        'plural',
        {
          one: [0, ' fichier de ', ['name']],
          other: [
            0,
            ' fichiers pour ',
            ['role', 'select', { admin: 'les admins', other: 'tous' }],
          ],
        },
      ],
    ],
    renders: [
      { count: 1, name: 'Ada', role: 'admin' },
      { count: 5, name: 'Ada', role: 'admin' },
      { count: 5, name: 'Ada', role: 'guest' },
    ],
  },
  {
    name: 'helper values without a name',
    setup: "const count = 2;\nconst role = count > 1 ? 'admin' : 'member';",
    body: "t`${plural(count, { one: 'One file', other: part`${n} files` })} for ${select(role, { admin: 'admins', member: 'members' })}`",
    translation: [
      ['_gt_2', 'select', { admin: 'Admins', member: 'Membres', other: '' }],
      ' : ',
      ['_gt_1', 'plural', { one: 'un fichier', other: [0, ' fichiers'] }],
    ],
  },
  {
    name: 'a selectordinal',
    body: 't`${selectordinal({ place: props.count }, { one: part`${n}st`, two: part`${n}nd`, few: part`${n}rd`, other: part`${n}th` })} place`',
    translation: [
      ['place', 'selectordinal', { one: [0, 're'], other: [0, 'e'] }],
      ' place',
    ],
    renders: COUNTS.slice(1),
  },
  {
    name: 'a select',
    body: "t`${select({ role: props.role }, { admin: 'Admin', member: 'Member', other: 'Guest' })}`",
    translation: [
      [
        'role',
        'select',
        { admin: 'Administratrice', member: 'Membre', other: 'Invitée' },
      ],
    ],
    renders: [{ role: 'admin' }, { role: 'member' }, { role: 'x' }],
  },
  {
    name: 'a number with a literal formatting context',
    body: "t`Total: ${number({ price: props.price }, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} (${number({ share: props.share }, { style: 'percent' })})`",
    translation: [
      'Total : ',
      ['price', 'number', 'currency'],
      ' (',
      ['share', 'number', 'percent'],
      ')',
    ],
    renders: [{ price: 1234.56, share: 0.256 }],
  },
  {
    name: 'a number with a formatting context read at runtime',
    body: "t`Total: ${number({ price: props.price }, { style: 'currency', currency: props.currency, currencyDisplay: 'code' })} for ${{ name: props.name }}`",
    translation: [['name'], ' : ', ['price', 'number', 'currency']],
    renders: [
      { price: 1234.56, currency: 'USD', name: 'Ada' },
      { price: 0.5, currency: 'JPY', name: 'Grace' },
    ],
  },
  {
    name: 'a date and a time',
    body: "t`Due ${date({ due: props.due }, { style: 'medium', timeZone: 'UTC' })} at ${time({ at: props.due }, { hour: 'numeric', minute: '2-digit', timeZone: props.timeZone })}`",
    translation: [
      'Pour le ',
      ['due', 'date', 'medium'],
      ' à ',
      ['at', 'time', { hour: 'numeric', minute: '2-digit' }],
    ],
    renders: [
      { due: DUE, timeZone: 'UTC' },
      { due: DUE.getTime(), timeZone: 'Asia/Tokyo' },
    ],
  },
  {
    name: 'a translation that fails to format',
    body: 't`Hello, ${{ name: props.name }}!`',
    translation: ['Bonjour, ', ['nom']],
    renders: [{ name: 'Ada' }],
  },
  {
    name: 'a translation that is not a tree',
    body: 't`Malformed`',
    translation: { text: 'Mal formé' },
  },
  {
    name: 'a value of the wrong type',
    body: "t`${plural({ count: props.count }, { other: 'items' })}`",
    renders: [{ count: 'many' }, { count: 2 }],
  },
  {
    name: 'a name bound to two values',
    body: 't`${{ name: props.name }} / ${{ name: props.other }}`',
    renders: [
      { name: 'Ada', other: 'Ada' },
      { name: 'Ada', other: 'Grace' },
    ],
    expected: 'kept',
  },
  {
    name: 'a formatting context with a side effect',
    setup: "const codes = ['USD', 'EUR'];",
    body: "t`${number({ price: props.price }, { style: 'currency', currency: codes.shift() })}`",
    renders: [{ price: 5 }],
    expected: 'kept',
  },
  {
    name: 'a msg template',
    body: 'm(msg`Later, ${{ name: props.name }}`)',
    translation: ['Plus tard, ', ['name']],
    renders: [{ name: 'Ada' }],
    expected: 'kept',
  },
];

const source = ({ setup = '', body }: Case) =>
  module(`${setup}\nexport const App = (props) => ${body};`);

describe.each(['en', 'fr'])('rendering in %s', (locale) => {
  let loading: Promise<GTRuntime> | undefined;

  /** gt-react in `locale`, with every case's translation loaded for fr. */
  const loadRuntime = () =>
    (loading ??= (async () => {
      Reflect.deleteProperty(globalThis, '__generaltranslation');
      const translations: Record<string, unknown> = {
        [hashOf('Save')]: 'Enregistrer',
      };
      for (const testCase of CASES) {
        if (testCase.translation === undefined) continue;
        const output = await transformWithPlugin(
          { precomputeMessages: false },
          source(testCase)
        );
        translations[output!.match(/\$_hash: "([^"]+)"/)![1]] =
          testCase.translation;
      }
      return loadGTRuntime(locale, async (requested) =>
        requested === 'fr' ? translations : {}
      );
    })());

  afterAll(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });

  const renderAll = async (
    code: string,
    renders: Record<string, unknown>[]
  ) => {
    const { App } = evaluateModule(code, (await loadRuntime()).modules);
    // A translation that cannot render is reported once, by either build.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Twice, so the second pass renders what each call site kept.
    const rendered = [...renders, ...renders].map((props) => {
      try {
        return String((App as (props: unknown) => unknown)(props));
      } catch (error) {
        return `threw: ${(error as Error).message}`;
      }
    });
    warn.mockRestore();
    return rendered;
  };

  it.each(CASES.map((testCase) => [testCase.name, testCase] as const))(
    'renders %s like its template',
    async (_name, testCase) => {
      const { renders = [{}], expected = 'precomputed' } = testCase;
      const code = source(testCase);
      const template = await transformWithPlugin(
        { precomputeMessages: false },
        code
      );
      const precomputed = await transformWithPlugin(undefined, code);
      if (expected === 'kept') {
        expect(precomputed).toBe(template);
      } else {
        expect(precomputed).toMatch(
          /export const App = \(props\) => t\((_gt|\{ \$_hash: "[0-9a-f]+", \$_tree: ")/
        );
      }
      const rendered = await renderAll(precomputed!, renders);
      expect(rendered).toEqual(await renderAll(template!, renders));
      // And like the source nothing compiled, which the runtime hashes.
      expect(rendered).toEqual(await renderAll(code, renders));
    }
  );

  it('renders useGT() templates like its templates', async () => {
    const code =
      compileJsx(`import { useGT, plural, part, n } from 'gt-react/unstable';
      export function App({ name, count }) {
        const gt = useGT();
        return <span title={gt\`Save\`}>{gt\`\${{ name }} has \${plural({ count }, { one: part\`\${n} item\`, other: part\`\${n} items\` })}\`}</span>;
      }`);
    const template = await transformWithPlugin(
      { precomputeMessages: false },
      code
    );
    const precomputed = await transformWithPlugin(undefined, code);
    expect(precomputed).toContain('gt(_gt, { name, count })');
    const props = { name: 'Ada', count: 2 };
    const runtime = await loadRuntime();
    const html = await runtime.render(
      evaluateModule(precomputed!, runtime.modules).App,
      props
    );
    expect(html).toBe(
      await runtime.render(
        evaluateModule(template!, runtime.modules).App,
        props
      )
    );
    expect(html).toBe(
      locale === 'fr'
        ? '<span title="Enregistrer">Ada has 2 items</span>'
        : '<span title="Save">Ada has 2 items</span>'
    );
  });
});
