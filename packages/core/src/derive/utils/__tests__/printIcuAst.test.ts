import { describe, it, expect } from 'vitest';
import {
  parse,
  TYPE,
  type PluralElement,
} from '@formatjs/icu-messageformat-parser';
// Test-only import of the CommonJS subpath the vendored printer replaces;
// vitest runs in Node where CJS interop works.
import { printAST } from '@formatjs/icu-messageformat-parser/printer.js';
import { printIcuAst } from '../printIcuAst';

const MESSAGES = [
  '',
  'Plain text without any variables',
  'Hello {name}',
  'Héllo 🎉 {name}, line\nbreak\tand tab',
  '{a}{b}{c}',
  // simple format elements with and without styles
  '{n, number}',
  '{n, number, percent}',
  '{d, date}',
  '{d, date, full}',
  '{t, time}',
  '{t, time, short}',
  // number and date/time skeletons
  '{n, number, ::percent}',
  '{n, number, ::compact-short currency/GBP}',
  '{n, number, ::percent .00 rounding-mode-floor}',
  '{n, number, ::currency/CAD unit-width-narrow}',
  '{n, number, ::measure-unit/length-meter unit-width-full-name}',
  '{n, number, ::scale/0.01}',
  '{d, date, ::yyyyMMdd}',
  '{t, time, ::HHmm}',
  // select
  '{gender, select, male {He} female {She} other {They}}',
  '{status, select, yes {{name} accepted} other {none}}',
  '{_gt_1, select, other {}}',
  // plural / selectordinal
  '{count, plural, one {# item} other {# items}}',
  '{count, plural, offset:2 =0 {none} =1 {one} other {# left}}',
  '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
  '{place, selectordinal, offset:1 one {a} other {b}}',
  "{count, plural, other {'#' # {name}}}",
  "{count, plural, other {'##' twice}}",
  // nesting
  '{count, plural, one {{status, select, yes {{name}} other {none}}} other {No}}',
  '{status, select, a {{count, plural, one {#} other {## {name}}}} other {b}}',
  // tags
  '<b>Bold <i>italic {name}</i></b>',
  '<link>Click {target}</link>',
  '{count, plural, one {<b># item</b>} other {<b># items</b>}}',
  // literal escaping
  "Cost: '{'price'}'",
  "Show '{'raw'}' and '}'",
  "It''s {name} o''clock",
  "{name}'s book",
  "Hi ''{name}",
  "{name}'' more",
  "Join {_gt_1, select, other {Haas''}}",
  'This literal mentions _gt_1 but has no select',
];

describe('printIcuAst', () => {
  describe('matches FormatJS printAST byte-for-byte', () => {
    it.each(MESSAGES.map((message) => [message]))('for %j', (message) => {
      const ast = parse(message);

      expect(printIcuAst(ast)).toBe(printAST(ast));
    });

    it.each(MESSAGES.map((message) => [message]))(
      'for %j without parsed skeletons',
      (message) => {
        const ast = parse(message, { shouldParseSkeletons: false });

        expect(printIcuAst(ast)).toBe(printAST(ast));
      }
    );
  });

  // FormatJS printAST emits `{_gt_1,select,other{Haas'}}` here; the trailing
  // apostrophe swallows the closing brace on reparse. The vendored printer
  // reproduces upstream output byte-for-byte, so it inherits the quirk.
  // condenseVars never hits it: indexed selects are condensed to plain
  // arguments before printing.
  const UPSTREAM_REPARSE_QUIRKS = new Set([
    "Join {_gt_1, select, other {Haas''}}",
  ]);

  it.each(
    MESSAGES.filter(
      (message) => message !== '' && !UPSTREAM_REPARSE_QUIRKS.has(message)
    ).map((message) => [message])
  )('produces reparseable output for %j', (message) => {
    const printed = printIcuAst(parse(message));

    expect(() => parse(printed)).not.toThrow();
  });
});

describe('escapeAllPounds option', () => {
  const TWO_ESCAPED_POUNDS = "{n, plural, other {'#'a '#'b}}";

  it('escapes every literal # inside plural options so output reparses losslessly', () => {
    const printed = printIcuAst(parse(TWO_ESCAPED_POUNDS), {
      escapeAllPounds: true,
    });
    const reparsed = parse(printed);
    const option = (reparsed[0] as PluralElement).options.other.value;
    expect(option).toHaveLength(1);
    expect(option[0]).toMatchObject({ type: TYPE.literal, value: '#a #b' });
  });

  it('keeps default output byte-identical to upstream (first # only)', () => {
    const ast = parse(TWO_ESCAPED_POUNDS);
    expect(printIcuAst(ast)).toBe(printAST(ast));
  });

  it('threads the option through tags nested in plural options', () => {
    const printed = printIcuAst(
      parse("{n, plural, other {<b>'#'x '#'y</b>}}", { ignoreTag: false }),
      { escapeAllPounds: true }
    );
    expect(() => parse(printed, { ignoreTag: false })).not.toThrow();
    expect(printed).not.toMatch(/[^']#/);
  });
});
