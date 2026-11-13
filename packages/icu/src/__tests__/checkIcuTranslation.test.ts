import { describe, expect, it } from 'vitest';
import {
  checkIcuTranslation,
  checkTranslation,
  icuToMessage,
} from '../convert';

const mismatch = (...problems: string[]) =>
  `The translation does not match its source: ${problems.join('; ')}.`;

const FILES = '{n, plural, one {# file} other {# files}}';
const GENDER = '{g, select, male {He} female {She} other {They}}';
const NO_OTHER = 'A plural, select or selectordinal needs an other branch.';
const datePattern = (pattern: string) =>
  `{d, date, ${pattern}} cannot be part of a message tree: "${pattern}" is not a style name; pass the app's own style names as \`styles\`.`;

/** The tree door's verdict where it differs from the ICU door's. */
type TreeVerdict = { tree: string | undefined } | { throws: string };

// Both doors apply one set of rules. The tree door reads the source's tree
// and the translation as `icuToMessage` reads it.
const CASES: [
  label: string,
  source: string,
  translation: string,
  locale: string,
  icu: string | undefined,
  tree?: TreeVerdict,
][] = [
  [
    'no other branch',
    FILES,
    '{n, plural, one {# fichier}}',
    'fr',
    NO_OTHER,
    { throws: NO_OTHER },
  ],
  ['a kept variable', 'Hello, {name}!', '¡Hola, {name}!', 'es', undefined],
  [
    'a dropped variable',
    'Hello, {name}!',
    '¡Hola!',
    'es',
    mismatch('"name" is missing from the translation'),
  ],
  [
    'a renamed variable',
    'Hello, {name}!',
    '¡Hola, {nombre}!',
    'es',
    mismatch(
      '"nombre" does not exist in the source',
      '"name" is missing from the translation'
    ),
  ],
  [
    'a variable used twice',
    'Hi {name}',
    'Hola {name}, {name}',
    'es',
    undefined,
  ],
  [
    'reordered variables',
    '{a} sent {b} a file',
    '{b} recibió un archivo de {a}',
    'es',
    undefined,
  ],
  [
    'a wrong name inside an added branch',
    '{n, plural, one {# file for {user}} other {# files for {user}}}',
    '{n, plural, one {# файл для {user}} few {# файла для {usr}} many {# файлов для {user}} other {# файла для {user}}}',
    'ru',
    mismatch('"usr" does not exist in the source'),
  ],
  [
    'every category Russian has',
    FILES,
    '{n, plural, one {# файл} few {# файла} many {# файлов} other {# файла}}',
    'ru',
    undefined,
  ],
  [
    'missing few and many',
    FILES,
    '{n, plural, one {# файл} other {# файлов}}',
    'ru',
    mismatch('"n" is missing the plural branches few, many, which ru needs'),
  ],
  [
    'Japanese with only other',
    FILES,
    '{n, plural, other {#件}}',
    'ja',
    undefined,
  ],
  [
    'Japanese with an extra one',
    FILES,
    '{n, plural, one {#件} other {#件}}',
    'ja',
    undefined,
  ],
  [
    'an invented plural key',
    FILES,
    '{n, plural, one {# fichier} lots {beaucoup} many {# de fichiers} other {# fichiers}}',
    'fr',
    mismatch('"n" has the plural branch lots, which is not a plural category'),
  ],
  [
    'a kept exact branch',
    '{n, plural, =0 {No files} one {# file} other {# files}}',
    '{n, plural, =0 {Aucun fichier} one {# fichier} many {# de fichiers} other {# fichiers}}',
    'fr',
    undefined,
  ],
  [
    'a dropped exact branch',
    '{n, plural, =0 {No files} one {# file} other {# files}}',
    '{n, plural, one {# fichier} many {# de fichiers} other {# fichiers}}',
    'fr',
    mismatch('"n" is missing the exact branch =0, which the source has'),
  ],
  [
    'an added exact branch',
    FILES,
    '{n, plural, =0 {Aucun fichier} one {# fichier} many {# de fichiers} other {# fichiers}}',
    'fr',
    undefined,
  ],
  [
    'kept select keys',
    GENDER,
    '{g, select, male {Él} female {Ella} other {Elle}}',
    'es',
    undefined,
  ],
  [
    'translated select keys',
    GENDER,
    '{g, select, masculino {Él} femenino {Ella} other {Elle}}',
    'es',
    mismatch(
      '"g" is missing the select branch male',
      '"g" is missing the select branch female',
      '"g" has the select branch masculino, which the source does not',
      '"g" has the select branch femenino, which the source does not'
    ),
    // A tree's keys are sorted.
    {
      tree: mismatch(
        '"g" is missing the select branch female',
        '"g" is missing the select branch male',
        '"g" has the select branch femenino, which the source does not',
        '"g" has the select branch masculino, which the source does not'
      ),
    },
  ],
  [
    'a removed select key',
    GENDER,
    '{g, select, male {Él} other {Elle}}',
    'es',
    mismatch('"g" is missing the select branch female'),
  ],
  [
    'an added select key',
    '{g, select, male {He} other {They}}',
    '{g, select, male {Él} female {Ella} other {Elle}}',
    'es',
    mismatch('"g" has the select branch female, which the source does not'),
  ],
  [
    'a kept style name',
    'Due {d, date, short}',
    'Fällig {d, date, short}',
    'de',
    undefined,
  ],
  [
    'a changed style name',
    'Due {d, date, short}',
    'Fällig {d, date, long}',
    'de',
    mismatch(
      '"d" uses {d, date, long}, which the source does not',
      '"d" is missing {d, date, short}'
    ),
  ],
  [
    'a kept skeleton',
    'Due {d, date, ::yMMMd}',
    'Fällig {d, date, ::yMMMd}',
    'de',
    undefined,
  ],
  [
    'a currency changed in a skeleton',
    'Total {p, number, ::currency/USD}',
    'Gesamt {p, number, ::currency/EUR}',
    'de',
    mismatch(
      '"p" uses {p, number, ::currency/EUR}, which the source does not',
      '"p" is missing {p, number, ::currency/USD}'
    ),
    // A tree holds the currency style; the currency is formatting context.
    { tree: mismatch('"p" sets currency, which a translation cannot set') },
  ],
  [
    'a kept pattern',
    'Due {d,date,MM/dd/yyyy}',
    'Fällig {d,date,MM/dd/yyyy}',
    'de',
    undefined,
    { throws: datePattern('MM/dd/yyyy') },
  ],
  [
    'a localized pattern',
    'Due {d,date,MM/dd/yyyy}',
    'Fällig {d,date,dd.MM.yyyy}',
    'de',
    undefined,
    { throws: datePattern('MM/dd/yyyy') },
  ],
  [
    'a style name replaced by a pattern',
    'Due {d, date, short}',
    'Fällig {d,date,dd.MM.yyyy}',
    'de',
    mismatch(
      '"d" uses {d, date, dd.MM.yyyy}, which the source does not',
      '"d" is missing {d, date, short}'
    ),
    { throws: datePattern('dd.MM.yyyy') },
  ],
  [
    'selectordinal categories',
    '{n, selectordinal, one {#st} other {#th}}',
    '{n, selectordinal, one {#st} other {#th}}',
    'en',
    mismatch('"n" is missing the ordinal branches two, few, which en needs'),
  ],
  [
    'every selectordinal category',
    '{n, selectordinal, one {#st} other {#th}}',
    '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
    'en',
    undefined,
  ],
  [
    'an invented selectordinal key',
    '{n, selectordinal, other {#.}}',
    '{n, selectordinal, lots {#.} other {#.}}',
    'de',
    mismatch('"n" has the ordinal branch lots, which is not a plural category'),
  ],
  [
    'a select inside a plural branch',
    '{n, plural, one {{g, select, male {his file} other {their file}}} other {{g, select, male {his files} other {their files}}}}',
    '{n, plural, one {{g, select, masc {su archivo} other {su archivo}}} many {{g, select, other {sus archivos}}} other {{g, select, other {sus archivos}}}}',
    'es',
    mismatch(
      '"g" is missing the select branch male',
      '"g" has the select branch masc, which the source does not'
    ),
  ],
  [
    'a variable used only inside a left-out category branch',
    '{n, plural, one {Only {name}, {d, date, long}} other {# files, {d, date, short}}}',
    '{n, plural, other {{d, date, short}に#件}}',
    'ja',
    undefined,
  ],
  [
    'a select and an exact branch only inside a left-out category branch',
    '{n, plural, one {{g, select, male {He} other {They}}, {m, plural, =0 {none} other {#}}} other {#}}',
    '{n, plural, other {#件}}',
    'ja',
    undefined,
  ],
  [
    'keys of a variable kept in a left-out category branch',
    '{n, plural, one {{g, select, male {He} other {They}}} other {{g, select, other {They}}}}',
    '{n, plural, other {{g, select, other {彼ら}}}}',
    'ja',
    undefined,
  ],
  [
    'a pattern replaced by a style name',
    'Due {d, date, MM/dd/yyyy}',
    'Fällig {d, date, long}',
    'de',
    mismatch('"d" uses {d, date, long}, which the source does not'),
    { throws: datePattern('MM/dd/yyyy') },
  ],
  [
    'a pattern beside a skeleton, whose currency changes',
    '{p, number, 0.00} of {p, number, ::currency/USD}',
    '{p, number, 0,00} von {p, number, ::currency/EUR}',
    'de',
    mismatch(
      '"p" uses {p, number, ::currency/EUR}, which the source does not',
      '"p" is missing {p, number, ::currency/USD}'
    ),
    { throws: 'cannot be part of a message tree' },
  ],
  [
    'a pattern source with another kind in the translation',
    'Due {d, date, MM/dd/yyyy}',
    'Fällig {d, time, short}',
    'de',
    mismatch(
      '"d" changed kind or plural offset',
      '"d" is missing from the translation'
    ),
    { throws: datePattern('MM/dd/yyyy') },
  ],
  [
    'an app style name in the source, which reads as a pattern',
    'Total {p, number, compact}',
    'Gesamt {p, number, kompakt}',
    'de',
    undefined,
    {
      throws:
        '{p, number, compact} cannot be part of a message tree: "compact" is not a style name',
    },
  ],
  [
    'plural categories, with a locale Intl has no rules for',
    FILES,
    '{n, plural, other {# файлов}}',
    'zz',
    undefined,
  ],
];

describe('checkIcuTranslation and checkTranslation', () => {
  it.each(CASES)(
    'check %s',
    (_label, source, translation, locale, icu, tree = { tree: icu }) => {
      expect(checkIcuTranslation(source, translation, { locale })).toBe(icu);
      const checkTree = () =>
        checkTranslation(icuToMessage(source).tree, icuToMessage(translation), {
          locale,
        });
      if ('throws' in tree) expect(checkTree).toThrow(tree.throws);
      else expect(checkTree()).toBe(tree.tree);
    }
  );

  it.each([
    ['plural categories', FILES, '{n, plural, other {# файлов}}', undefined],
    [
      'an invented key',
      FILES,
      '{n, plural, lots {#} other {#}}',
      mismatch(
        '"n" has the plural branch lots, which is not a plural category'
      ),
    ],
  ])(
    'checks %s by the rules that need no locale, without one',
    (_label, source, translation, expected) => {
      expect(checkIcuTranslation(source, translation)).toBe(expected);
      expect(
        checkTranslation(icuToMessage(source).tree, icuToMessage(translation))
      ).toBe(expected);
    }
  );
});

describe('checkIcuTranslation', () => {
  it('throws for a source that is not ICU', () => {
    expect(() => checkIcuTranslation('{name', '{name}')).toThrow(SyntaxError);
  });

  it('compares a skeleton by its tokens, so spacing is no change', () => {
    expect(
      checkIcuTranslation(
        '{p, number, ::currency/USD .00} on {d, date, ::yMMMd}',
        '{p, number,   ::currency/USD    .00  } am {d, date,  ::yMMM d }'
      )
    ).toBeUndefined();
  });

  it('reads quoted text in a date skeleton as no field', () => {
    expect(checkIcuTranslation('{d, date, ::yM}', "{d, date, ::y'M'}")).toBe(
      mismatch(
        '"d" uses {d, date, ::y}, which the source does not',
        '"d" is missing {d, date, ::y M}'
      )
    );
  });

  it.each([
    ['::MMMM', "::MM'd'MM"],
    ['::yy', "::y'M'y"],
  ])('keeps the fields of %s apart from those of %s', (source, translation) => {
    expect(
      checkIcuTranslation(`{d, date, ${source}}`, `{d, date, ${translation}}`)
    ).toBeDefined();
  });

  it('reports a problem once when two uses of a variable have it', () => {
    expect(
      checkIcuTranslation(
        '{n, plural, =0 {a} other {b}} {n, plural, offset:1 =0 {a} other {b}}',
        '{n, plural, other {b}} {n, plural, offset:1 other {b}}'
      )
    ).toBe(
      mismatch('"n" is missing the exact branch =0, which the source has')
    );
  });
});
