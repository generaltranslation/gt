import { describe, it, expect } from 'vitest';
import { parse } from '@formatjs/icu-messageformat-parser';
import { indexVars } from '../indexVars';

describe('indexVars', () => {
  it('should add numeric identifiers to GT placeholders', () => {
    const input =
      'Hello {_gt_, select, other {John}} and {_gt_, select, other {Jane}}';
    const result = indexVars(input);

    expect(result).toBe(
      'Hello {_gt_1, select, other {John}} and {_gt_2, select, other {Jane}}'
    );
  });

  it('should maintain gt metadata', () => {
    const input =
      'Hello {_gt_, select, other {John} _gt_var_name {John}} and {_gt_, select, other {Jane}}';
    const result = indexVars(input);

    expect(result).toBe(
      'Hello {_gt_1, select, other {John} _gt_var_name {John}} and {_gt_2, select, other {Jane}}'
    );
  });

  it('should handle single GT placeholder', () => {
    const input = '{_gt_, select, other {Hello World}}';
    const result = indexVars(input);

    expect(result).toBe('{_gt_1, select, other {Hello World}}');
  });

  it('should handle GT placeholders at start and end', () => {
    const input =
      '{_gt_, select, other {Start}} middle text {_gt_, select, other {End}}';
    const result = indexVars(input);

    expect(result).toBe(
      '{_gt_1, select, other {Start}} middle text {_gt_2, select, other {End}}'
    );
  });

  it('should handle nested GT placeholders in plurals', () => {
    const input =
      '{count, plural, one {{_gt_, select, other {item}}} other {{_gt_, select, other {items}}}}';
    const result = indexVars(input);

    expect(result).toBe(
      '{count, plural, one {{_gt_1, select, other {item}}} other {{_gt_2, select, other {items}}}}'
    );
  });

  it('should handle nested GT placeholders in selects', () => {
    const input =
      '{gender, select, male {He has {_gt_, select, other {book}}} female {She has {_gt_, select, other {book}}} other {They have {_gt_, select, other {book}}}}';
    const result = indexVars(input);

    expect(result).toBe(
      '{gender, select, male {He has {_gt_1, select, other {book}}} female {She has {_gt_2, select, other {book}}} other {They have {_gt_3, select, other {book}}}}'
    );
  });

  it('should handle GT placeholders with tags', () => {
    const input =
      '<bold>{_gt_, select, other {important}}</bold> and {_gt_, select, other {normal}}';
    const result = indexVars(input);

    expect(result).toBe(
      '<bold>{_gt_1, select, other {important}}</bold> and {_gt_2, select, other {normal}}'
    );
  });

  it('should preserve other ICU elements unchanged', () => {
    const input =
      '{count, number} items and {date, date, short} with {_gt_, select, other {variable}}';
    const result = indexVars(input);

    expect(result).toBe(
      '{count, number} items and {date, date, short} with {_gt_1, select, other {variable}}'
    );
  });

  it('should handle empty string', () => {
    const input = '';
    const result = indexVars(input);

    expect(result).toBe('');
  });

  it('should handle string with no GT placeholders', () => {
    const input = 'Hello {name} with {count, plural, one {item} other {items}}';
    const result = indexVars(input);

    expect(result).toBe(
      'Hello {name} with {count, plural, one {item} other {items}}'
    );
  });

  it('should handle complex nested scenarios', () => {
    const input = `Welcome {_gt_, select, other {user}}! You have {count, plural, 
      =0 {no {_gt_, select, other {messages}}}
      =1 {one {_gt_, select, other {message}}}
      other {# {_gt_, select, other {messages}}}
    }`;

    const result = indexVars(input);
    const expected = `Welcome {_gt_1, select, other {user}}! You have {count, plural, 
      =0 {no {_gt_2, select, other {messages}}}
      =1 {one {_gt_3, select, other {message}}}
      other {# {_gt_4, select, other {messages}}}
    }`;

    expect(result).toBe(expected);
  });

  it('should produce valid ICU syntax after indexing', () => {
    const input =
      'Hello {_gt_, select, other {World}} and {_gt_, select, other {Universe}}';
    const result = indexVars(input);

    // The result should be parseable as valid ICU
    expect(() => parse(result)).not.toThrow();

    const ast = parse(result);
    expect(ast).toBeDefined();
  });

  it('should not replace random _gt_ strings that are not ICU placeholders', () => {
    const input =
      'This is _gt_ text with {_gt_, select, other {placeholder}} and more _gt_ content';
    const result = indexVars(input);

    expect(result).toBe(
      'This is _gt_ text with {_gt_1, select, other {placeholder}} and more _gt_ content'
    );
  });

  it('should handle _gt_ in ICU placeholder content', () => {
    const input =
      '{_gt_, select, other {This contains _gt_ text}} and {_gt_, select, other {More _gt_ here}}';
    const result = indexVars(input);

    expect(result).toBe(
      '{_gt_1, select, other {This contains _gt_ text}} and {_gt_2, select, other {More _gt_ here}}'
    );
  });

  it('should handle _gt_ as part of other ICU variable names', () => {
    const input =
      '{_gt_user, select, male {Mr} female {Ms} other {}} with {_gt_, select, other {name}} and {user_gt_, number}';
    const result = indexVars(input);

    expect(result).toBe(
      '{_gt_user, select, male {Mr} female {Ms} other {}} with {_gt_1, select, other {name}} and {user_gt_, number}'
    );
  });

  it('should handle mixed scenarios with random _gt_ strings', () => {
    const input =
      '_gt_ prefix {_gt_, select, other {Hello _gt_ world}} _gt_ middle {_gt_, select, other {content}} _gt_ suffix';
    const result = indexVars(input);

    expect(result).toBe(
      '_gt_ prefix {_gt_1, select, other {Hello _gt_ world}} _gt_ middle {_gt_2, select, other {content}} _gt_ suffix'
    );
  });

  it('should handle _gt_ in URLs and other contexts', () => {
    const input =
      'Visit https://example.com/_gt_/page for {_gt_, select, other {info}} about _gt_ systems';
    const result = indexVars(input);

    expect(result).toBe(
      'Visit https://example.com/_gt_/page for {_gt_1, select, other {info}} about _gt_ systems'
    );
  });
});
