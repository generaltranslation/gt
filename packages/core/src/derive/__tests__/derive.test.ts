import { describe, it, expect } from 'vitest';
import { formatIcu, parse } from '@generaltranslation/icu/parser';
import { GTIntl } from '../../index';
import { declareVar } from '../declareVar';
import { decodeVars } from '../decodeVars';
import { extractVars } from '../extractVars';
import { indexVars } from '../indexVars';
import { sanitizeVar } from '../utils/sanitizeVar';

const U2019 = String.fromCharCode(0x2019);

describe('sanitizeVar', () => {
  it.each([
    ['empty string', '', ''],
    ['plain text', 'just normal text', 'just normal text'],
    ['hash is not ICU syntax here', 'count: #5', 'count: #5'],
    ['single quotes are doubled', "text'with'quotes", "text''with''quotes"],
    ['consecutive quotes', "test''combo", "test''''combo"],
    [
      'only the ASCII quote is doubled, not U+2019',
      `Don't forget the café${U2019}s menu`,
      `Don''t forget the café${U2019}s menu`,
    ],
    ['special region is quoted', 'hello{world}test', "hello'{world}'test"],
    [
      'one region spans first to last special',
      '{start}middle<end>',
      "'{start}middle<end>'",
    ],
    ['only special characters', '{}<>', "'{}<>'"],
    [
      'quotes around a special region',
      "before'{middle}'after",
      "before'''{middle}'''after",
    ],
    [
      'quotes before and after a special region',
      "test'before{middle}'after",
      "test''before'{middle}'''after",
    ],
  ])('%s', (_name, input, expected) => {
    expect(sanitizeVar(input)).toBe(expected);
  });
});

describe('declareVar', () => {
  it.each([
    [undefined, undefined, '{_gt_, select, other {}}'],
    [null, undefined, '{_gt_, select, other {}}'],
    [
      '',
      'variable name',
      '{_gt_, select, other {} _gt_var_name {variable name}}',
    ],
    [
      'test value',
      'test{name}',
      "{_gt_, select, other {test value} _gt_var_name {test'{name}'}}",
    ],
  ])('encodes %j named %j', (variable, $name, expected) => {
    const encoded = declareVar(variable, $name ? { $name } : undefined);

    expect(encoded).toBe(expected);
    expect(() => parse(encoded)).not.toThrow();
  });

  // Whatever the value contains, it must survive as one literal: rendered by
  // ICU, decoded back, and extracted as the first variable.
  it.each([
    ['plain text', 'hello world'],
    ['single space', ' '],
    ['whitespace characters', '\n\t\r'],
    ['braces', 'hello{world}'],
    ['single quote', "hello'world"],
    ['consecutive quotes', "''''"],
    ['hashes', '####'],
    ['tags', 'hello<bold>world</bold>'],
    ['ICU plural syntax', '{count, plural, one{# dog} other{# dogs}}'],
    ['formatted argument', '{date, date, short}'],
    ['unbalanced nesting', '{{{{}}}}'],
    ['angle bracket run', '<><><>'],
    ['every special character', "{}#<>'"],
    ['quotes next to braces and tags', "start'middle{complex}end'final<tag>"],
    ['quoted words after braces', "User's data: {id} and 'settings'"],
    ['adversarial nesting', "{{{{''''}}}}<<<>>>"],
    ['script tag', '<script>alert("XSS with {malicious} code")</script>'],
    ['JSON-like text', 'Error: {code: 500, message: "Internal server error"}'],
    ['template literal syntax', 'Price: ${price} (including {taxRate}% tax)'],
    ['unicode with special characters', '中文{变量}和<标签>测试 🎉{party}🎈'],
  ])('round-trips %s', (_name, value) => {
    const encoded = declareVar(value);

    expect(
      formatIcu(encoded, 'en', { _gt_: 'placeholder' }, { timeZone: 'UTC' })
    ).toBe(value);
    expect(decodeVars(`before ${encoded} after`)).toBe(`before ${value} after`);
    expect(extractVars(encoded)).toEqual({ _gt_1: value });
  });
});

describe('extractVars', () => {
  it.each([
    ['empty string', '', {}],
    ['plain text', 'Plain text without any variables', {}],
    ['regular select', 'Hello {name, select, other {World}}', {}],
    ['select with another _gt_ name', '{_gt_a, select, other {value}}', {}],
    ['indexed select', '{_gt_1x, select, other {value}}', {}],
    ['_gt_ argument', 'Hello {_gt_1}', {}],
    ['_gt_ plural', '{_gt_1, plural, other {items}}', {}],
    ['non-literal other option', '{_gt_, select, other {{name}}}', {}],
    [
      'single variable',
      'Hello {_gt_, select, other {World}}',
      { _gt_1: 'World' },
    ],
    ['empty other option', '{_gt_, select, other {}}', { _gt_1: '' }],
    [
      'sequential indexes',
      '{_gt_, select, other {first}} then {_gt_, select, other {second}} then {_gt_, select, other {third}}',
      { _gt_1: 'first', _gt_2: 'second', _gt_3: 'third' },
    ],
    [
      'other option among several',
      '{_gt_, select, zero {no items} one {one item} other {many items}}',
      { _gt_1: 'many items' },
    ],
    [
      'quoted ICU syntax in the value',
      "{_gt_, select, other {'{name}' says hello}}",
      { _gt_1: '{name} says hello' },
    ],
    [
      'variables between regular arguments and selects',
      'User {username} has {name, select, other {Hello}} {_gt_, select, other {World}} {count} {_gt_, select, other {!}}',
      { _gt_1: 'World', _gt_2: '!' },
    ],
    [
      'unicode text and newlines',
      '我在{_gt_, select, other {公园}}\n跟{_gt_, select, other {玩具 café}}去玩儿',
      { _gt_1: '公园', _gt_2: '玩具 café' },
    ],
  ])('%s', (_name, input, expected) => {
    expect(extractVars(input)).toEqual(expected);
  });

  it('supplies the variables a condensed translation needs', () => {
    const source =
      'I play with my friend {_gt_, select, other {Brian}} at the {_gt_, select, other {}}';
    const target = 'Je joue avec mon ami {_gt_1} au {_gt_2}';

    expect(
      new GTIntl().formatMessage(target, {
        locales: ['fr'],
        variables: extractVars(source),
      })
    ).toBe('Je joue avec mon ami Brian au ');
  });
});

describe('indexVars', () => {
  it.each([
    ['empty string', '', ''],
    [
      'no GT placeholders',
      'Hello {name} with {count, plural, one {item} other {items}}',
      'Hello {name} with {count, plural, one {item} other {items}}',
    ],
    [
      'single placeholder',
      '{_gt_, select, other {Hello World}}',
      '{_gt_1, select, other {}}',
    ],
    [
      'placeholders at start and end',
      '{_gt_, select, other {Start}} middle text {_gt_, select, other {End}}',
      '{_gt_1, select, other {}} middle text {_gt_2, select, other {}}',
    ],
    [
      'variable names are kept',
      'Welcome {_gt_, select, other {user} _gt_var_name {username}}! You have {_gt_, select, other {5 messages}} in your {_gt_, select, other {inbox} _gt_var_name {some name}}',
      'Welcome {_gt_1, select, other {} _gt_var_name {username}}! You have {_gt_2, select, other {}} in your {_gt_3, select, other {} _gt_var_name {some name}}',
    ],
    [
      'placeholders nested in plurals',
      '{count, plural, =0 {No {_gt_, select, other {messages}}} =1 {One {_gt_, select, other {message}}} other {# {_gt_, select, other {messages}}}}',
      '{count, plural, =0 {No {_gt_1, select, other {}}} =1 {One {_gt_2, select, other {}}} other {# {_gt_3, select, other {}}}}',
    ],
    [
      'placeholders nested in selects',
      '{gender, select, male {He has {_gt_, select, other {book}}} female {She has {_gt_, select, other {book}}} other {They have {_gt_, select, other {book}}}}',
      '{gender, select, male {He has {_gt_1, select, other {}}} female {She has {_gt_2, select, other {}}} other {They have {_gt_3, select, other {}}}}',
    ],
    [
      'placeholders inside tags',
      '<bold>{_gt_, select, other {important}}</bold> and {_gt_, select, other {normal}}',
      '<bold>{_gt_1, select, other {}}</bold> and {_gt_2, select, other {}}',
    ],
    [
      'other ICU elements are untouched',
      '{count, number} items: {_gt_, select, other {dynamic content}} and {type, select, urgent {URGENT} other {Unknown}} on {date, date, short}',
      '{count, number} items: {_gt_1, select, other {}} and {type, select, urgent {URGENT} other {Unknown}} on {date, date, short}',
    ],
    [
      'placeholders after FormatJS-style argument braces',
      '{n, number, foo{bar} {_gt_, select, other {X}}}',
      '{n, number, foo{bar} {_gt_1, select, other {}}}',
    ],
    [
      'source whitespace and newlines',
      `Welcome {_gt_, select, other {user}}! You have {count, plural,
      =0 {no {_gt_, select, other {messages}}}
      other {# {_gt_, select, other {messages}}}
    }`,
      `Welcome {_gt_1, select, other {}}! You have {count, plural,
      =0 {no {_gt_2, select, other {}}}
      other {# {_gt_3, select, other {}}}
    }`,
    ],
    [
      'literal _gt_ text outside and inside placeholders',
      '_gt_ prefix https://example.com/_gt_/page {_gt_, select, other {Hello _gt_ world}} _gt_ suffix',
      '_gt_ prefix https://example.com/_gt_/page {_gt_1, select, other {}} _gt_ suffix',
    ],
    [
      'other argument names containing _gt_',
      '{_gt_user, select, male {Mr} female {Ms} other {}} with {_gt_, select, other {name}} and {user_gt_, number}',
      '{_gt_user, select, male {Mr} female {Ms} other {}} with {_gt_1, select, other {}} and {user_gt_, number}',
    ],
    [
      'declared values holding ICU syntax and quotes',
      `Status: ${declareVar("Text with 'quotes' and {braces}")} Cart: ${declareVar('{count, plural, one{# item} other{# items}}', { $name: 'item_count' })} 🚀`,
      'Status: {_gt_1, select, other {}} Cart: {_gt_2, select, other {} _gt_var_name {item_count}} 🚀',
    ],
  ])('%s', (_name, input, expected) => {
    const result = indexVars(input);

    expect(result).toBe(expected);
    expect(() => parse(result)).not.toThrow();
  });
});

describe('decodeVars', () => {
  it.each([
    ['empty string', '', ''],
    [
      'no GT variables',
      'Hello {name} with {count, plural, one {item} other {items}}',
      'Hello {name} with {count, plural, one {item} other {items}}',
    ],
    ['single variable', '{_gt_, select, other {Hello World}}', 'Hello World'],
    ['empty variable', '{_gt_, select, other {}}', ''],
    [
      'variables at start and end',
      '{_gt_, select, other {Start}} middle text {_gt_, select, other {End}}',
      'Start middle text End',
    ],
    [
      'surrounding and inner whitespace',
      '  {_gt_, select, other {  spaced content  }}  ',
      '    spaced content    ',
    ],
    [
      'other ICU elements are untouched',
      '{count, number} items and {_gt_, select, other {variable}} with {date, date, short}',
      '{count, number} items and variable with {date, date, short}',
    ],
    [
      'escaped quotes, braces and tags',
      "{_gt_, select, other {User''s ''data'': '{id: 123} <status>active</status>'}}",
      "User's 'data': {id: 123} <status>active</status>",
    ],
    [
      'variables nested in plurals',
      `{count, plural,
      =0 {No {_gt_, select, other {messages}}}
      other {# {_gt_, select, other {messages}}}
    }`,
      `{count, plural,
      =0 {No messages}
      other {# messages}
    }`,
    ],
    [
      'variables nested in selects',
      '{gender, select, male {He has {_gt_, select, other {book}}} other {They have {_gt_, select, other {books}}}}',
      '{gender, select, male {He has book} other {They have books}}',
    ],
    [
      'variables inside tags',
      '<bold>{_gt_, select, other {important}}</bold> and {_gt_, select, other {normal}}',
      '<bold>important</bold> and normal',
    ],
    [
      'unicode content',
      '{_gt_, select, other {你好世界 🌍 café naïve}}',
      '你好世界 🌍 café naïve',
    ],
    [
      'named variables',
      `Navigate to ${declareVar('User Profile', { $name: 'profile_section' })} page`,
      'Navigate to User Profile page',
    ],
  ])('%s', (_name, input, expected) => {
    expect(decodeVars(input)).toBe(expected);
  });

  it('decodes thousands of captured variables', () => {
    const count = 2_000;
    const input = Array.from(
      { length: count },
      (_, index) => `{_gt_, select, other {value${index}}}`
    ).join(' ');
    const expected = Array.from(
      { length: count },
      (_, index) => `value${index}`
    ).join(' ');

    expect(decodeVars(input)).toBe(expected);
  });
});
