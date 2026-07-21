import { describe, it, expect } from 'vitest';
import { formatMessage, parse } from '@generaltranslation/icu';
import { condenseVars } from '../condenseVars';

// Pins the serialized output used by condenseVars. Existing FormatJS output
// stays byte-identical unless it was not safely reparseable; corrected cases
// use the canonical, round-trippable form because condensed strings feed into
// hashing and later parsing.
describe('condenseVars printer regression', () => {
  it.each([
    ['single indexed select', '{_gt_1, select, other {}}', '{_gt_1}'],
    [
      'leading and trailing literals',
      'Start {_gt_1, select, other {}} end.',
      'Start {_gt_1} end.',
    ],
    ['plain argument', '{name} {_gt_1, select, other {}}', '{name} {_gt_1}'],
    [
      'number without style',
      '{n, number} {_gt_1, select, other {}}',
      '{n, number} {_gt_1}',
    ],
    [
      'number with percent style',
      '{n, number, percent} {_gt_1, select, other {}}',
      '{n, number, percent} {_gt_1}',
    ],
    [
      'number with simple skeleton',
      '{n, number, ::percent} {_gt_1, select, other {}}',
      '{n, number, ::percent} {_gt_1}',
    ],
    [
      'number skeleton with token option',
      '{n, number, ::compact-short currency/GBP} {_gt_1, select, other {}}',
      '{n, number, ::compact-short currency/GBP} {_gt_1}',
    ],
    [
      'number skeleton with multiple tokens',
      '{n, number, ::percent .00 rounding-mode-floor} {_gt_1, select, other {}}',
      '{n, number, ::percent .00 rounding-mode-floor} {_gt_1}',
    ],
    [
      'number skeleton with multiple options',
      '{n, number, ::currency/CAD unit-width-narrow} {_gt_1, select, other {}}',
      '{n, number, ::currency/CAD unit-width-narrow} {_gt_1}',
    ],
    [
      'date without style',
      '{d, date} {_gt_1, select, other {}}',
      '{d, date} {_gt_1}',
    ],
    [
      'date with full style',
      '{d, date, full} {_gt_1, select, other {}}',
      '{d, date, full} {_gt_1}',
    ],
    [
      'date with skeleton',
      '{d, date, ::yyyyMMdd} {_gt_1, select, other {}}',
      '{d, date, ::yyyyMMdd} {_gt_1}',
    ],
    [
      'time with short style',
      '{t, time, short} {_gt_1, select, other {}}',
      '{t, time, short} {_gt_1}',
    ],
    [
      'time with skeleton',
      '{t, time, ::HHmm} {_gt_1, select, other {}}',
      '{t, time, ::HHmm} {_gt_1}',
    ],
    [
      'select with multiple options',
      '{gender, select, male {He} female {She} other {They}} {_gt_1, select, other {}}',
      '{gender,select,male{He} female{She} other{They}} {_gt_1}',
    ],
    [
      'plural with pound',
      '{count, plural, one {# item} other {# items}} {_gt_1, select, other {}}',
      '{count,plural,one{# item} other{# items}} {_gt_1}',
    ],
    [
      'plural with offset and exact matches',
      '{count, plural, offset:2 =0 {none} =1 {one} other {# left}} {_gt_1, select, other {}}',
      '{count,plural,offset:2 =0{none} =1{one} other{# left}} {_gt_1}',
    ],
    [
      'plural with lexically distinct exact matches',
      '{count, plural, =1 {canonical} =01 {leading} =+1 {positive} other {other}} {_gt_1, select, other {}}',
      '{count,plural,=1{canonical} =01{leading} =+1{positive} other{other}} {_gt_1}',
    ],
    [
      'selectordinal with pound',
      '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} {_gt_1, select, other {}}',
      '{place,selectordinal,one{#st} two{#nd} few{#rd} other{#th}} {_gt_1}',
    ],
    [
      'indexed vars nested in plural with pound',
      '{count, plural, one {# {_gt_1, select, other {}}} other {# {_gt_2, select, other {}}}}',
      '{count,plural,one{# {_gt_1}} other{# {_gt_2}}}',
    ],
    [
      'deeply nested indexed var',
      '{count, plural, one {{status, select, yes {{_gt_1, select, other {}}} other {none}}} other {No}}',
      '{count,plural,one{{status,select,yes{{_gt_1}} other{none}}} other{No}}',
    ],
    [
      'nested tags',
      '<b>Bold <i>italic {_gt_1, select, other {}}</i></b>',
      '<b>Bold <i>italic {_gt_1}</i></b>',
    ],
    [
      'tag with argument sibling',
      '<link>Click {target} {_gt_1, select, other {}}</link>',
      '<link>Click {target} {_gt_1}</link>',
    ],
    [
      'quoted braces',
      "Cost: '{'price'}' {_gt_1, select, other {}}",
      "Cost: '{price}' {_gt_1}",
    ],
    [
      'quoted brace run',
      "Show '{'raw'}' and '}' {_gt_1, select, other {}}",
      "Show '{raw} and }' {_gt_1}",
    ],
    [
      'apostrophe inside quoted braces',
      "'{isn''t}' {_gt_1, select, other {}}",
      "'{isn''t}' {_gt_1}",
    ],
    [
      'escaped apostrophes',
      "It''s {_gt_1, select, other {}} o''clock",
      "It's {_gt_1} o'clock",
    ],
    [
      'lone apostrophe after select',
      "{_gt_1, select, other {}}'s book",
      "{_gt_1}''s book",
    ],
    [
      'even apostrophe run before quoted braces',
      "{_gt_1,select,other{}}'''{}'#",
      "{_gt_1}'''{}'#",
    ],
    [
      'even apostrophe run before closing braces',
      "{_gt_1, select, other {Ada}}''}}",
      "{_gt_1}'''}}'",
    ],
    [
      'tag-like text in a named style',
      '{_gt_1, select, other {Ada}} {n, number, custom<a>}',
      '{_gt_1} {n, number, custom<a>}',
    ],
    [
      'paired braces in a named style',
      '{_gt_1, select, other {Ada}} {n, number, custom{nested}}',
      '{_gt_1} {n, number, custom{nested}}',
    ],
    [
      'quoted braces in a named style',
      "{_gt_1, select, other {Ada}} {n, number, custom'{nested}'}",
      "{_gt_1} {n, number, custom'{nested}'}",
    ],
    [
      'apostrophe at a closing tag boundary',
      "<b>{_gt_1, select, other {Ada}}''</b>",
      "<b>{_gt_1}''</b>",
    ],
    [
      'escaped pound inside plural',
      "{count, plural, other {'#' # {_gt_1, select, other {}}}}",
      "{count,plural,other{'#' # {_gt_1}}}",
    ],
    [
      'multiple escaped pounds inside plural',
      "{_gt_1, select, other {Ada}} {count, plural, other {'##'}}",
      "{_gt_1} {count,plural,other{'##'}}",
    ],
    [
      'unicode and emoji',
      'Héllo 🎉 {_gt_1, select, other {}}',
      'Héllo 🎉 {_gt_1}',
    ],
    [
      'newlines and indentation',
      'Line 1\nHas {_gt_1, select, other {}}\n  indented',
      'Line 1\nHas {_gt_1}\n  indented',
    ],
    [
      'adjacent indexed vars and argument',
      '{_gt_1, select, other {}}{name}{_gt_2, select, other {}}',
      '{_gt_1}{name}{_gt_2}',
    ],
    [
      'indexed select with non-empty options',
      '{_gt_1, select, one {won} other {lost}} trailing',
      '{_gt_1} trailing',
    ],
  ])('serializes %s exactly as before', (_name, input, expected) => {
    const result = condenseVars(input);

    expect(result).toBe(expected);
    expect(() => parse(result)).not.toThrow();
  });

  it('preserves multiple literal pounds through condense and runtime formatting', () => {
    const condensed = condenseVars(
      "{_gt_1, select, other {Ada}} {count, plural, other {'##'}}"
    );

    expect(formatMessage(condensed, 'en', { _gt_1: 'Ada', count: 7 })).toBe(
      'Ada ##'
    );
  });

  it.each([
    ["{_gt_1,select,other{}}'''{}'#", "Ada'{}#"],
    ["{_gt_1, select, other {Ada}}''}}", "Ada'}}"],
  ])('preserves apostrophe-boundary rendering for %j', (message, expected) => {
    const condensed = condenseVars(message);

    expect(formatMessage(condensed, 'en', { _gt_1: 'Ada' })).toBe(expected);
  });
});
