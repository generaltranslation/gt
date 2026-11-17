import { describe, expect, it } from 'vitest';
import type { MessageTree } from '@generaltranslation/icu';
import { icuToMessage } from '@generaltranslation/icu/convert';
import { templateToMessage } from '@generaltranslation/icu/internal';
import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { legacySourceCandidates } from '../candidates.js';
import {
  convertLegacyValue,
  gtjsxToMessage,
  legacyIcuToMessage,
} from '../legacy.js';
import {
  fillTranslationBranches,
  migrateTranslation,
  validateMigratedTranslation,
} from '../translation.js';
import {
  alphaRenameMap,
  canonicalizeTree,
  renameFormats,
  renameVariables,
  treeShape,
} from '../tree.js';

const FILES = icuToMessage('{n, plural, one {# file} other {# files}}').tree;

describe('canonicalizeTree', () => {
  it.each<[string, MessageTree, MessageTree]>([
    ['one text node', ['Save'], 'Save'],
    ['no nodes', [], ''],
    [
      'adjacent and empty text',
      ['a', '', 'b', ['x'], '', 'c'],
      ['ab', ['x'], 'c'],
    ],
    [
      'branches, offsets and styles',
      [
        [
          'n',
          'plural',
          { other: ['x', 'y'], one: [], '=2': [[0], 'z'] as never },
          0,
        ],
        ['d', 'date', { year: 'numeric', month: 'short' }],
      ],
      [
        ['n', 'plural', { '=2': [[0], 'z'] as never, one: '', other: 'xy' }],
        ['d', 'date', { month: 'short', year: 'numeric' }],
      ],
    ],
    ['tag children', [['b', 'tag', ['bold']]], [['b', 'tag', 'bold']]],
  ])('canonicalizes %s', (_name, tree, expected) => {
    expect(JSON.stringify(canonicalizeTree(tree))).toBe(
      JSON.stringify(expected)
    );
  });

  it('builds the JSON templateToMessage and icuToMessage build', () => {
    const template = templateToMessage(
      ['', ' left'],
      [
        {
          kind: 'plural',
          name: 'count',
          branches: { other: 'Many', one: 'One', '=0': 'None' },
        },
      ]
    );
    const handBuilt: MessageTree = [
      ['count', 'plural', { other: ['Ma', 'ny'], '=0': ['None'], one: 'One' }],
      ' ',
      'left',
    ];
    expect(JSON.stringify(canonicalizeTree(handBuilt))).toBe(
      JSON.stringify(template.tree)
    );
    expect(JSON.stringify(canonicalizeTree(handBuilt))).toBe(
      JSON.stringify(
        icuToMessage('{count, plural, other {Many} =0 {None} one {One}} left')
          .tree
      )
    );
  });
});

describe('treeShape and alphaRenameMap', () => {
  it('numbers variables by first use with branch keys sorted', () => {
    expect(
      treeShape([
        ['n', 'plural', { other: [['who'], ' ', 0], one: [['name']] }],
        ' ',
        ['b', 'tag', [['name']]],
        ['when', 'date', 'short'],
      ])
    ).toEqual({
      shape:
        '[[0,"plural",[["one",[[1]]],["other",[[2]," ",0]]],0]," ",["b","tag",[[1]]],[3,"date","short"]]',
      variables: ['n', 'name', 'who', 'when'],
    });
  });

  it.each<
    [string, MessageTree, MessageTree, Record<string, string> | undefined]
  >([
    [
      'renamed argument',
      ['Hi ', ['name']],
      ['Hi ', ['_gt_1']],
      { name: '_gt_1' },
    ],
    ['same names', ['Hi ', ['name']], ['Hi ', ['name']], {}],
    ['swapped names', [['x'], ['y']], [['y'], ['x']], { x: 'y', y: 'x' }],
    [
      'branch key order',
      [['n', 'plural', { other: [0], one: 'one' }]],
      [['count', 'plural', { one: 'one', other: [0] }]],
      { n: 'count' },
    ],
    ['different text', ['Hi ', ['name']], ['Hey ', ['name']], undefined],
    ['different kind', [['n']], [['n', 'number']], undefined],
    ['one name for two', [['a'], ['b']], [['a'], ['a']], undefined],
    ['different tag', [['b', 'tag', 'x']], [['i', 'tag', 'x']], undefined],
  ])('maps %s', (_name, from, to, expected) => {
    expect(alphaRenameMap(from, to)).toEqual(expected);
  });
});

describe('renameVariables and renameFormats', () => {
  it('renames every variable at every depth and leaves tags', () => {
    const tree: MessageTree = [
      ['a'],
      ['b', 'number', 'percent'],
      ['c', 'date'],
      ['d', 'time', 'short'],
      [
        'a',
        'tag',
        [
          [
            'e',
            'select',
            { other: [['f', 'selectordinal', { other: [0] }, 2]] },
          ],
        ],
      ],
    ];
    expect(
      renameVariables(tree, { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F' })
    ).toEqual([
      ['A'],
      ['B', 'number', 'percent'],
      ['C', 'date'],
      ['D', 'time', 'short'],
      [
        'a',
        'tag',
        [
          [
            'E',
            'select',
            { other: [['F', 'selectordinal', { other: [0] }, 2]] },
          ],
        ],
      ],
    ]);
  });

  it('renames formats by variable', () => {
    expect(
      renameFormats(
        { p: { currency: 'EUR' }, q: { timeZone: 'UTC' } },
        { p: 'price' }
      )
    ).toEqual({ price: { currency: 'EUR' }, q: { timeZone: 'UTC' } });
  });
});

describe('legacyIcuToMessage', () => {
  it.each<[string, MessageTree, Record<string, unknown>]>([
    ['Hello {name}', ['Hello ', ['name']], {}],
    ['Hi {_gt_, select, other {Ann}}!', ['Hi ', ['_gt_1'], '!'], {}],
    ['Hi {_gt_1, select, other {}}!', ['Hi ', ['_gt_1'], '!'], {}],
    ['{_gt_, select, other {Ann} _gt_var_name {user}}', [['_gt_1']], {}],
    [
      '{n, plural, one {{_gt_, select, other {A}}} other {{_gt_, select, other {B}}}}',
      [['n', 'plural', { one: [['_gt_1']], other: [['_gt_2']] }]],
      {},
    ],
    [
      '{_gt_1, select, a {y} other {x}}',
      [['_gt_1', 'select', { a: 'y', other: 'x' }]],
      {},
    ],
    ['{g, select, other {x}}', [['g', 'select', { other: 'x' }]], {}],
    [
      '{n, number, integer}',
      [['n', 'number']],
      { n: { maximumFractionDigits: 0 } },
    ],
  ])('converts %s', (icu, tree, formats) => {
    expect(legacyIcuToMessage(icu)).toEqual({ ok: true, tree, formats });
  });

  it.each([
    [
      '{n, plural, one {# file}}',
      'A plural, select or selectordinal needs an other branch.',
    ],
    ['Hi {name', 'A placeholder is not closed: add }.'],
    [
      '{p, date, yyyy}',
      '{p, date, yyyy} cannot be part of a message tree: "yyyy" is not a style name; pass the app\'s own style names as `styles`.',
    ],
  ])('rejects %s', (icu, reason) => {
    expect(legacyIcuToMessage(icu)).toEqual({ ok: false, reason });
  });
});

describe('gtjsxToMessage', () => {
  it.each<[string, unknown, MessageTree]>([
    ['text', 'Hello', 'Hello'],
    ['empty children', ['a', null, true, 'b'], 'ab'],
    [
      'typed variables',
      [
        { k: 'name', i: 1 },
        { k: 'v', v: 'v' },
        { k: 'count', i: 2, v: 'n' },
        { k: 'cost', v: 'c' },
        { k: 'due', i: 3, v: 'd' },
      ],
      [
        ['name'],
        ['v'],
        ['count', 'number'],
        ['cost', 'number', 'currency'],
        ['due', 'date'],
      ],
    ],
    [
      'a Branch with its children as other',
      [
        'Hi ',
        {
          t: 'Branch',
          i: 1,
          d: { t: 'b', b: { formal: ['Sir ', { k: 'name', i: 2 }] } },
          c: 'there',
        },
      ],
      [
        'Hi ',
        [
          '_gt_branch_1',
          'select',
          { formal: ['Sir ', ['name']], other: 'there' },
        ],
      ],
    ],
    [
      'a Branch with its own other',
      { i: 4, d: { t: 'b', b: { a: 'A', other: 'O' } }, c: 'ignored' },
      [['_gt_branch_4', 'select', { a: 'A', other: 'O' }]],
    ],
    [
      'a Plural with a Branch inside',
      [
        {
          t: 'Plural',
          i: 1,
          d: {
            t: 'p',
            b: { one: { t: 'Branch', i: 2, d: { t: 'b', b: { x: 'X' } } } },
          },
          c: ['Many ', { k: '_gt_n_3', i: 3, v: 'n' }],
        },
      ],
      [
        [
          '_gt_plural_1',
          'plural',
          {
            one: [['_gt_branch_2', 'select', { other: '', x: 'X' }]],
            other: ['Many ', ['_gt_n_3', 'number']],
          },
        ],
      ],
    ],
  ])('converts %s', (_name, jsx, tree) => {
    expect(gtjsxToMessage(jsx)).toEqual({ ok: true, tree, formats: {} });
  });

  it.each<[string, unknown, string]>([
    [
      'a tag',
      ['Hi ', { t: 'b', i: 1, c: 'x' }],
      'It contains <b>; only <Plural> and <Branch> elements have a message tree form',
    ],
    [
      'an element without a tag name',
      { i: 1, c: 'x' },
      'It contains an element; only <Plural> and <Branch> elements have a message tree form',
    ],
    [
      'RelativeTime',
      { k: 'when', v: 'rt' },
      '<RelativeTime> variable "when" has no message tree form',
    ],
    [
      'an unknown variable type',
      { k: 'x', v: 'q' },
      'Variable "x" has the unknown type "q"',
    ],
    [
      'attributes',
      { t: 'input', i: 1, d: { pl: 'Name' } },
      'It contains <input>; only <Plural> and <Branch> elements have a message tree form',
    ],
    [
      'attributes on a Branch',
      { t: 'Branch', i: 1, d: { t: 'b', b: {}, ti: 'x' } },
      'It contains an element with translatable attributes (ti)',
    ],
    [
      'a Plural form ICU lacks',
      { i: 1, d: { t: 'p', b: { several: 'x' } } },
      '<Plural> branch "several" is not an ICU plural category',
    ],
    [
      'a Branch without an id',
      { d: { t: 'b', b: {} } },
      'It contains a <Plural> or <Branch> without an id',
    ],
    ['a number', 5, 'Unsupported JSX content 5'],
    ['a nested array', [['x']], 'Unsupported JSX content ["x"]'],
    [
      'an invalid variable name',
      { k: 'a b' },
      'Not a valid message tree at [0,0]: expected an ICU variable name',
    ],
  ])('rejects %s', (_name, jsx, reason) => {
    expect(gtjsxToMessage(jsx)).toEqual({ ok: false, reason });
  });
});

describe('convertLegacyValue', () => {
  it.each<[unknown, 'ICU' | 'JSX' | 'STRING' | 'MESSAGE_TREE', unknown]>([
    ['Hi {name}', 'ICU', { ok: true, tree: ['Hi ', ['name']], formats: {} }],
    [['Hi'], 'ICU', { ok: false, reason: 'An ICU message must be a string' }],
    ['Hi {name}', 'STRING', { ok: true, tree: 'Hi {name}', formats: {} }],
    [5, 'STRING', { ok: false, reason: 'A STRING message must be a string' }],
    ['Hi', 'JSX', { ok: true, tree: 'Hi', formats: {} }],
    [
      ['Hi ', { k: 'x' }],
      'JSX',
      { ok: true, tree: ['Hi ', ['x']], formats: {} },
    ],
    [
      [['g', 'select', { other: 'b', a: 'a' }]],
      'MESSAGE_TREE',
      {
        ok: true,
        tree: [['g', 'select', { a: 'a', other: 'b' }]],
        formats: {},
      },
    ],
    [
      ['Save'],
      'MESSAGE_TREE',
      {
        ok: false,
        reason:
          'Not a valid message tree at []: expected a string for text without placeholders',
      },
    ],
    [
      5,
      'MESSAGE_TREE',
      {
        ok: false,
        reason:
          'Not a valid message tree at []: expected text or an array of nodes',
      },
    ],
  ])('converts %j as %s', (value, dataFormat, expected) => {
    expect(convertLegacyValue(value, dataFormat)).toEqual(expected);
  });
});

describe('fillTranslationBranches', () => {
  it.each<[string, MessageTree, MessageTree, MessageTree, number]>([
    [
      'fr',
      FILES,
      [['n', 'plural', { one: [0, ' fichier'], other: [0, ' fichiers'] }]],
      [
        [
          'n',
          'plural',
          {
            many: [0, ' fichiers'],
            one: [0, ' fichier'],
            other: [0, ' fichiers'],
          },
        ],
      ],
      1,
    ],
    [
      'ru',
      FILES,
      [['n', 'plural', { one: [0, ' файл'], other: [0, ' файлов'] }]],
      [
        [
          'n',
          'plural',
          {
            few: [0, ' файлов'],
            many: [0, ' файлов'],
            one: [0, ' файл'],
            other: [0, ' файлов'],
          },
        ],
      ],
      2,
    ],
    [
      'ar',
      FILES,
      [['n', 'plural', { one: 'ملف', other: [0, ' ملفات'] }]],
      [
        [
          'n',
          'plural',
          {
            few: [0, ' ملفات'],
            many: [0, ' ملفات'],
            one: 'ملف',
            other: [0, ' ملفات'],
            two: [0, ' ملفات'],
            zero: [0, ' ملفات'],
          },
        ],
      ],
      4,
    ],
    [
      'ja',
      FILES,
      [['n', 'plural', { one: [0, 'ファイル'], other: [0, 'ファイル'] }]],
      [['n', 'plural', { one: [0, 'ファイル'], other: [0, 'ファイル'] }]],
      0,
    ],
    [
      'en',
      [['p', 'selectordinal', { one: [0, 'st'], other: [0, 'th'] }]],
      [['p', 'selectordinal', { other: [0, 'th'] }]],
      [
        [
          'p',
          'selectordinal',
          { few: [0, 'th'], one: [0, 'th'], other: [0, 'th'], two: [0, 'th'] },
        ],
      ],
      3,
    ],
  ])(
    'adds the plural categories %s needs from other',
    (locale, source, translation, filled, categories) => {
      const result = fillTranslationBranches(source, translation, locale);
      expect(result).toEqual({
        tree: filled,
        counts: { categories, keys: 0, dropped: 0 },
      });
      expect(
        validateMigratedTranslation(source, result.tree, locale)
      ).toBeUndefined();
    }
  );

  it.each<[string, MessageTree, MessageTree, MessageTree]>([
    [
      'fr',
      [['n', 'plural', { '=0': 'None', one: 'One', other: [0] }]],
      [['n', 'plural', { many: 'Beaucoup', one: 'Un', other: [0] }]],
      [
        [
          'n',
          'plural',
          { '=0': 'Un', many: 'Beaucoup', one: 'Un', other: [0] },
        ],
      ],
    ],
    [
      'en',
      [['n', 'plural', { '=0': 'None', one: 'One', other: [0] }]],
      [['n', 'plural', { one: 'One!', other: [0, '!'] }]],
      [['n', 'plural', { '=0': [0, '!'], one: 'One!', other: [0, '!'] }]],
    ],
    [
      'ru',
      [['n', 'plural', { '=1': 'just you', other: ['you and ', 0] }, 1]],
      [['n', 'plural', { few: 'f', many: 'm', one: 'o', other: 'x' }, 1]],
      [
        [
          'n',
          'plural',
          { '=1': 'm', few: 'f', many: 'm', one: 'o', other: 'x' },
          1,
        ],
      ],
    ],
  ])(
    'copies a missing =N from its category branch in %s',
    (locale, source, translation, filled) => {
      expect(fillTranslationBranches(source, translation, locale)).toEqual({
        tree: filled,
        counts: { categories: 0, keys: 1, dropped: 0 },
      });
      expect(
        validateMigratedTranslation(source, filled, locale)
      ).toBeUndefined();
    }
  );

  it('adds missing select keys from other and drops extra ones at any depth', () => {
    const source: MessageTree = [
      ['g', 'select', { a: 'A', b: 'B', other: 'O' }],
      [
        'n',
        'plural',
        { one: [['g', 'select', { a: 'A', c: 'C', other: 'O' }]], other: 'x' },
      ],
    ];
    const translation: MessageTree = [
      [
        'n',
        'plural',
        { one: [['g', 'select', { d: 'D', other: 'o' }]], other: 'y' },
      ],
    ];
    expect(fillTranslationBranches(source, translation, 'en')).toEqual({
      tree: [
        [
          'n',
          'plural',
          {
            one: [['g', 'select', { a: 'o', b: 'o', c: 'o', other: 'o' }]],
            other: 'y',
          },
        ],
      ],
      counts: { categories: 0, keys: 3, dropped: 1 },
    });
  });

  it('adds no categories for a locale Intl has no rules for', () => {
    const translation: MessageTree = [['n', 'plural', { other: [0] }]];
    expect(fillTranslationBranches(FILES, translation, 'zz')).toEqual({
      tree: translation,
      counts: { categories: 0, keys: 0, dropped: 0 },
    });
  });
});

describe('validateMigratedTranslation', () => {
  it.each<[string, unknown, string | undefined]>([
    [
      'a matching tree',
      [['n', 'plural', { many: [0], one: [0], other: [0] }]],
      undefined,
    ],
    [
      'a non-canonical tree',
      ['Save'],
      'Not a valid message tree at []: expected a string for text without placeholders',
    ],
    [
      'a non-tree',
      5,
      'Not a valid message tree at []: expected text or an array of nodes',
    ],
    [
      'missing categories',
      [['n', 'plural', { one: [0], other: [0] }]],
      'The translation does not match its source: "n" is missing the plural branch many, which fr needs.',
    ],
    [
      'an ICU string',
      '{n, plural, one {#} other {#}}',
      'The translation does not match its source: "n" is missing from the translation.',
    ],
  ])('checks %s', (_name, value, expected) => {
    expect(validateMigratedTranslation(FILES, value, 'fr')).toBe(expected);
  });

  it('reports an invalid locale instead of throwing', () => {
    let engineMessage: string | undefined;
    try {
      new Intl.PluralRules('not a locale!');
    } catch (error) {
      engineMessage = (error as Error).message;
    }
    expect(validateMigratedTranslation('x', 'y', 'not a locale!')).toBe(
      engineMessage
    );
  });
});

describe('migrateTranslation', () => {
  const COUNT_FILES = icuToMessage(
    '{count, plural, one {# file} other {# files}}'
  ).tree;
  const base = {
    sourceTree: COUNT_FILES,
    sourceFormats: {},
    oldValue: '{n, plural, one {# fichier} other {# fichiers}}',
    oldDataFormat: 'ICU' as const,
    renameMap: { n: 'count' },
    locale: 'fr',
    fill: true,
  };

  it('renames, fills and canonicalizes', () => {
    expect(migrateTranslation(base)).toEqual({
      ok: true,
      tree: [
        [
          'count',
          'plural',
          {
            many: [0, ' fichiers'],
            one: [0, ' fichier'],
            other: [0, ' fichiers'],
          },
        ],
      ],
      filled: { categories: 1, keys: 0, dropped: 0 },
    });
  });

  it.each<[string, Partial<typeof base> & Record<string, unknown>, unknown]>([
    [
      'without fill',
      { fill: false },
      {
        ok: false,
        reason:
          'The translation does not match its source: "count" is missing the plural branch many, which fr needs.',
      },
    ],
    [
      'nothing to fill',
      { oldValue: '{n, plural, one {un} many {beaucoup} other {#}}' },
      {
        ok: true,
        tree: [
          ['count', 'plural', { many: 'beaucoup', one: 'un', other: [0] }],
        ],
      },
    ],
    [
      'a declared variable',
      {
        sourceTree: ['Hello ', ['_gt_1']],
        renameMap: {},
        oldValue: 'Bonjour {_gt_1, select, other {}}',
      },
      { ok: true, tree: ['Bonjour ', ['_gt_1']] },
    ],
    [
      'equal formats',
      {
        sourceTree: ['Total ', ['price', 'number', 'currency']],
        sourceFormats: { p: { currency: 'EUR' } },
        renameMap: { p: 'price' },
        oldValue: 'Total : {p, number, ::currency/EUR}',
      },
      { ok: true, tree: ['Total : ', ['price', 'number', 'currency']] },
    ],
    [
      'different formats',
      {
        sourceTree: ['Total ', ['price', 'number', 'currency']],
        sourceFormats: { p: { currency: 'EUR' } },
        renameMap: { p: 'price' },
        oldValue: 'Total : {p, number, ::currency/USD}',
      },
      {
        ok: false,
        reason: 'The translation formats "p" differently from its source',
      },
    ],
    [
      'a JSX translation',
      {
        sourceTree: ['Hi ', ['name']],
        renameMap: {},
        oldValue: ['Salut ', { k: 'name', i: 1 }],
        oldDataFormat: 'JSX',
      },
      { ok: true, tree: ['Salut ', ['name']] },
    ],
    [
      'an ICU string stored as a tree',
      {
        sourceTree: ['Hi ', ['name']],
        renameMap: {},
        oldValue: 'Salut {name}',
        oldDataFormat: 'MESSAGE_TREE',
      },
      {
        ok: false,
        reason:
          'The translation does not match its source: "name" is missing from the translation.',
      },
    ],
    [
      'an unconvertible translation',
      { oldValue: '{n, plural, one {#} other {#}' },
      { ok: false, reason: 'A placeholder is not closed: add }.' },
    ],
  ])('handles %s', (_name, overrides, expected) => {
    expect(
      migrateTranslation({ ...base, ...overrides } as typeof base)
    ).toEqual(expected);
  });
});

describe('legacySourceCandidates', () => {
  const sources = (tree: MessageTree, formats?: Record<string, never>) =>
    legacySourceCandidates(tree, formats).map(
      ({ source, dataFormat }) => `${dataFormat} ${source}`
    );

  it('adds a JSX candidate for plain text', () => {
    expect(sources('Save')).toEqual(['ICU Save', 'JSX Save']);
  });

  it('spells branches compactly and conventionally, in canonical and CLDR order', () => {
    expect(
      sources(
        icuToMessage(
          '{n, plural, =0 {none} one {# file} other {# files}} for {g, select, other {all} admin {admins}}'
        ).tree
      )
    ).toEqual([
      'ICU {n,plural,=0{none} one{# file} other{# files}} for {g,select,admin{admins} other{all}}',
      'ICU {n, plural, =0 {none} one {# file} other {# files}} for {g, select, admin {admins} other {all}}',
    ]);
    expect(
      sources(
        icuToMessage(
          '{p, selectordinal, few {#rd} one {#st} two {#nd} other {#th}}'
        ).tree
      )
    ).toEqual([
      'ICU {p,selectordinal,few{#rd} one{#st} other{#th} two{#nd}}',
      'ICU {p, selectordinal, few {#rd} one {#st} other {#th} two {#nd}}',
      'ICU {p, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
      'ICU {p,selectordinal,one{#st} two{#nd} few{#rd} other{#th}}',
    ]);
  });

  it('spells anonymous arguments as indexed declared variables', () => {
    expect(sources([['_gt_1'], ' meets ', ['_gt_2']])).toEqual([
      'ICU {_gt_1} meets {_gt_2}',
      'ICU {_gt_1, select, other {}} meets {_gt_2, select, other {}}',
    ]);
  });

  it('spells formatting context that ICU can write', () => {
    expect(
      legacySourceCandidates(['Total ', ['p', 'number', 'currency']], {
        p: { currency: 'EUR' },
      }).map(({ source }) => source)
    ).toEqual([
      'Total {p, number, currency}',
      'Total {p, number, ::currency/EUR}',
    ]);
  });

  it.each([
    [
      '{_gt_, select, other {Ann}} meets {_gt_, select, other {Bob}}',
      [['_gt_1'], ' meets ', ['_gt_2']],
    ],
    [
      '{count, plural, one {# file} other {# files}}',
      icuToMessage('{count, plural, other {# files} one {# file}}').tree,
    ],
    [
      '{n, plural, =1 {one} =10 {ten} other {#}}',
      icuToMessage('{n, plural, other {#} =10 {ten} =1 {one}}').tree,
    ],
  ])('predicts the legacy hash of %s', (legacy, tree) => {
    const meta = { context: 'ctx', maxChars: 20 };
    const oldHash = hashSource({
      source: indexVars(legacy),
      dataFormat: 'ICU',
      ...meta,
    });
    expect(
      legacySourceCandidates(tree as MessageTree).some(
        ({ source, dataFormat }) =>
          hashSource({ source, dataFormat, ...meta }) === oldHash
      )
    ).toBe(true);
  });
});

describe('legacy plural and percent semantics', () => {
  const plural = (b: Record<string, unknown>) => ({
    t: 'Plural',
    i: 1,
    d: { t: 'p', b },
  });

  it.each<
    [
      string,
      Record<string, unknown>,
      string | undefined,
      Record<string, unknown>,
    ]
  >([
    [
      'singular wins over one, and other stays other',
      { singular: 'S', one: 'O', plural: 'P', other: 'X' },
      undefined,
      { one: 'S', other: 'X' },
    ],
    [
      'plural fills the categories ru lacks, before other',
      { one: 'O', plural: 'P', other: 'X' },
      'ru',
      { one: 'O', few: 'P', many: 'P', other: 'X' },
    ],
    [
      'plural becomes other when there is none',
      { one: 'O', plural: 'P' },
      undefined,
      { one: 'O', other: 'P' },
    ],
    [
      'dual becomes two',
      { dual: 'D', other: 'X' },
      undefined,
      { two: 'D', other: 'X' },
    ],
  ])('maps legacy aliases: %s', (_name, b, locale, expected) => {
    expect(gtjsxToMessage(plural(b), { locale })).toEqual({
      ok: true,
      tree: [['_gt_plural_1', 'plural', expected]],
      formats: {},
    });
  });

  it.each<[string, 'add' | 'replace', Record<string, unknown>]>([
    ['fr', 'add', { zero: 'Z', '=0': 'Z', one: 'O', other: 'X' }],
    [
      'ja',
      'add',
      { zero: 'Z', '=0': 'Z', one: 'O', '=1': 'O', '=-1': 'O', other: 'X' },
    ],
    ['en', 'replace', { '=0': 'Z', one: 'O', other: 'X' }],
  ])(
    'keeps exact-value branches for %s (%s)',
    (locale, exactValues, expected) => {
      expect(
        gtjsxToMessage(plural({ zero: 'Z', one: 'O', other: 'X' }), {
          locale,
          exactValues,
        })
      ).toEqual({
        ok: true,
        tree: [['_gt_plural_1', 'plural', expected]],
        formats: {},
      });
    }
  );

  it('rejects one variable formatted with two contexts across percent occurrences', () => {
    expect(
      legacyIcuToMessage('{n, number, ::.00} ({n, number, ::percent .0})')
    ).toEqual({
      ok: false,
      reason:
        'Message variable "n" is formatted with different formatting context in one message; give each its own variable name.',
    });
  });

  it.each<[string, unknown]>([
    ['{n, number, ::percent}', [['n', 'number', 'percent']]],
    [
      '{n, number, ::unit/percent}',
      [['n', 'number', { style: 'unit', unit: 'percent' }]],
    ],
    ['{n, number, ::%}', [['n', 'number', 'percent']]],
    [
      '{n, number} = {n, number, ::percent}',
      [['n', 'number'], ' = ', ['n', 'number', 'percent']],
    ],
    [
      "{n, plural, one {'{'#'}' {n, number, ::percent}} other {x}}",
      [
        [
          'n',
          'plural',
          { one: ['{', 0, '} ', ['n', 'number', 'percent']], other: 'x' },
        ],
      ],
    ],
    [
      '{p, number, ::percent} {q, number, ::unit/percent}',
      [
        ['p', 'number', 'percent'],
        ' ',
        ['q', 'number', { style: 'unit', unit: 'percent' }],
      ],
    ],
  ])('converts %s', (icu, tree) => {
    expect(legacyIcuToMessage(icu)).toEqual({ ok: true, tree, formats: {} });
  });

  it('inlines the text of a <Derive> variant', () => {
    expect(
      gtjsxToMessage(['Your ', { t: 'Derive', i: 1, c: 'admin' }, ' page'])
    ).toEqual({ ok: true, tree: 'Your admin page', formats: {} });
  });
});
