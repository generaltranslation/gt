import { describe, it, expect } from 'vitest';
import { parse } from '@generaltranslation/icu';
import { condenseVars } from '../condenseVars';

const expectParseableIcu = (icuString: string) => {
  expect(() => parse(icuString)).not.toThrow();
};

describe('static condenseVars', () => {
  describe('source strings without indexed GT variables', () => {
    it.each([
      ['empty string', ''],
      ['plain text', 'Plain text without any variables'],
      ['normal argument', 'Hello {name}'],
      ['single unindexed declareVar', 'Hello {_gt_, select, other {Alice}}'],
      [
        'multiple unindexed declareVars',
        'Hey {_gt_, select, other {Alice}}, {_gt_, select, other {Bob}}',
      ],
      [
        'source sms invite with trailing apostrophe',
        "Hey {_gt_, select, other {Alice}}, {_gt_, select, other {Bob}} invited you to {_gt_, select, other {Haas''}}",
      ],
      ['trailing apostrophe', "Join {_gt_, select, other {Haas''}}"],
      ['internal apostrophe', "Hello {_gt_, select, other {O''Brien}}"],
      [
        'multiple internal apostrophes',
        "Hello {_gt_, select, other {Bob''s and Alice''s party}}",
      ],
      ['double trailing apostrophes', "Hello {_gt_, select, other {Haas''''}}"],
      [
        'apostrophe before punctuation',
        "Hello {_gt_, select, other {Haas''}}!",
      ],
      [
        'apostrophe before comma',
        "Hello {_gt_, select, other {Haas''}}, welcome",
      ],
      ['empty unindexed declareVar', 'Hello {_gt_, select, other {}}'],
      ['quoted braces', "Hello {_gt_, select, other {'{eventId}'}}"],
      ['quoted angle text', "Hello {_gt_, select, other {'<event>'}}"],
      [
        'regular select plus unindexed declareVar',
        '{name, select, other {Hello}} {_gt_, select, other {World}}',
      ],
      [
        'regular plural plus unindexed declareVar',
        '{count, plural, one {One} other {Many}} {_gt_, select, other {items}}',
      ],
      [
        'nested unindexed declareVar inside plural',
        '{count, plural, one {{_gt_, select, other {Alice}} invited you} other {No invites}}',
      ],
      [
        'nested unindexed trailing apostrophe inside plural',
        "{count, plural, one {{_gt_, select, other {Haas''}} invited you} other {No invites}}",
      ],
      [
        'deeply nested unindexed trailing apostrophe',
        "{count, plural, one {{status, select, yes {{_gt_, select, other {Haas''}}} other {none}}} other {No invites}}",
      ],
      [
        'plain indexed-looking text',
        'This literal mentions _gt_1 but has no ICU select',
      ],
      [
        'plain indexed-looking argument',
        'This literal mentions {_gt_1} but has no select',
      ],
    ])('returns the original source for %s', (_name, input) => {
      const result = condenseVars(input);

      expect(result).toBe(input);
      expectParseableIcu(result);
    });
  });

  describe('strings that look indexed but have no indexed GT select', () => {
    it.each([
      [
        'select without gt prefix',
        '{gt_1, select, other {value}}',
        '{gt_1, select, other {value}}',
      ],
      [
        'invalid gt suffix',
        '{_gt_a, select, other {value}}',
        '{_gt_a, select, other {value}}',
      ],
      [
        'extra characters after gt index',
        '{_gt_1x, select, other {value}}',
        '{_gt_1x,select,other{value}}',
      ],
      ['indexed argument only', 'Hello {_gt_1}', 'Hello {_gt_1}'],
      [
        'indexed plural',
        '{_gt_1, plural, other {items}}',
        '{_gt_1,plural,other{items}}',
      ],
      [
        'indexed selectordinal',
        '{_gt_1, selectordinal, one {first} other {other}}',
        '{_gt_1,selectordinal,one{first} other{other}}',
      ],
      ['indexed number format', '{_gt_1, number}', '{_gt_1, number}'],
      [
        'indexed select with non-literal other branch',
        '{_gt_1, select, other {{count, plural, one {item} other {items}}}}',
        '{_gt_1,select,other{{count,plural,one{item} other{items}}}}',
      ],
    ])('returns the expected string for %s', (_name, input, expected) => {
      const result = condenseVars(input);

      expect(result).toBe(expected);
      expectParseableIcu(result);
    });

    // We intentionally do not test messages that mix `_gt_` and `_gt_#`.
    // Source strings use `_gt_`; translated strings use `_gt_#`; the two forms
    // should not appear in the same real input.
  });

  describe('indexed translation variables', () => {
    it.each([
      [
        'single empty indexed select',
        'Hello {_gt_1, select, other {}}',
        'Hello {_gt_1}',
      ],
      [
        'multiple empty indexed selects',
        'I play with {_gt_1, select, other {}} at the {_gt_2, select, other {}}',
        'I play with {_gt_1} at the {_gt_2}',
      ],
      ['single digit index', '{_gt_5, select, other {}}', '{_gt_5}'],
      ['multi-digit index', '{_gt_123, select, other {}}', '{_gt_123}'],
      ['zero index', '{_gt_0, select, other {}}', '{_gt_0}'],
      [
        'translation with regular argument',
        'User {username} has {_gt_1, select, other {}} {count} tasks',
        'User {username} has {_gt_1} {count} tasks',
      ],
      [
        'translation with regular select',
        '{name, select, other {Hello}} {_gt_1, select, other {}}',
        '{name,select,other{Hello}} {_gt_1}',
      ],
      [
        'translation with regular plural',
        '{count, plural, one {One invite} other {Many invites}} {_gt_1, select, other {}}',
        '{count,plural,one{One invite} other{Many invites}} {_gt_1}',
      ],
      [
        'translation with date format',
        '{date, date, short} {_gt_1, select, other {}}',
        '{date, date, short} {_gt_1}',
      ],
      [
        'translation with number format',
        '{count, number} {_gt_1, select, other {}}',
        '{count, number} {_gt_1}',
      ],
      [
        'translation with newline formatting',
        'Line 1\nHas {_gt_1, select, other {}}\n  with spacing',
        'Line 1\nHas {_gt_1}\n  with spacing',
      ],
      [
        'translation with tag',
        '{_gt_1, select, other {}} <b>bold</b>',
        '{_gt_1} <b>bold</b>',
      ],
      [
        'translation with multiple select options and empty other',
        '{_gt_1, select, one {one} other {}}',
        '{_gt_1}',
      ],
    ])('condenses %s', (_name, input, expected) => {
      const result = condenseVars(input);

      expect(result).toBe(expected);
      expectParseableIcu(result);
    });
  });

  describe('nested indexed translation variables', () => {
    it.each([
      [
        'indexed variable inside plural one branch',
        '{count, plural, one {Invite {_gt_1, select, other {}}} other {Invites}}',
        '{count,plural,one{Invite {_gt_1}} other{Invites}}',
      ],
      [
        'indexed variable inside plural other branch',
        '{count, plural, one {Invite} other {Invites {_gt_1, select, other {}}}}',
        '{count,plural,one{Invite} other{Invites {_gt_1}}}',
      ],
      [
        'indexed variables in multiple plural branches',
        '{count, plural, one {{_gt_1, select, other {}} invite} other {{_gt_2, select, other {}} invites}}',
        '{count,plural,one{{_gt_1} invite} other{{_gt_2} invites}}',
      ],
      [
        'indexed variable inside select branch',
        '{status, select, invited {{_gt_1, select, other {}} is invited} other {No invite}}',
        '{status,select,invited{{_gt_1} is invited} other{No invite}}',
      ],
      [
        'indexed variables in nested select inside plural',
        '{count, plural, one {{status, select, yes {{_gt_1, select, other {}}} other {none}}} other {{status, select, yes {{_gt_2, select, other {}}} other {none}}}}',
        '{count,plural,one{{status,select,yes{{_gt_1}} other{none}}} other{{status,select,yes{{_gt_2}} other{none}}}}',
      ],
      [
        'indexed variable inside tag in plural branch',
        '{count, plural, one {<b>{_gt_1, select, other {}}</b>} other {<i>{_gt_2, select, other {}}</i>}}',
        '{count,plural,one{<b>{_gt_1}</b>} other{<i>{_gt_2}</i>}}',
      ],
      [
        'nested plural with offset',
        '{count, plural, offset:1 =0 {Nobody} one {{_gt_1, select, other {}}} other {{_gt_2, select, other {}}}}',
        '{count,plural,offset:1 =0{Nobody} one{{_gt_1}} other{{_gt_2}}}',
      ],
      [
        'nested selectordinal',
        '{place, selectordinal, one {{_gt_1, select, other {}}} two {{_gt_2, select, other {}}} other {{_gt_3, select, other {}}}}',
        '{place,selectordinal,one{{_gt_1}} two{{_gt_2}} other{{_gt_3}}}',
      ],
      [
        'nested pound in plural remains valid',
        '{count, plural, one {# {_gt_1, select, other {}}} other {# {_gt_2, select, other {}}}}',
        '{count,plural,one{# {_gt_1}} other{# {_gt_2}}}',
      ],
    ])('condenses %s', (_name, input, expected) => {
      const result = condenseVars(input);

      expect(result).toBe(expected);
      expectParseableIcu(result);
    });
  });
});
