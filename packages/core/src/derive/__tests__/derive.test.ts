import { describe, it, expect } from 'vitest';
import { formatIcu, parse } from '@generaltranslation/icu/parser';
import { declareVar } from '../declareVar';
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

  // Whatever the value contains, it must survive as one literal when ICU
  // renders it.
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
