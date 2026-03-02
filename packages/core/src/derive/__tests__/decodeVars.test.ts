import { describe, it, expect } from 'vitest';
import { decodeVars } from '../decodeVars';

describe('decodeVars', () => {
  it('should decode a single GT variable', () => {
    const input = '{_gt_, select, other {Hello World}}';
    const result = decodeVars(input);

    expect(result).toBe('Hello World');
  });

  it('should decode multiple GT variables', () => {
    const input =
      'Hello {_gt_, select, other {John}}, you are a {_gt_, select, other {Developer}}!';
    const result = decodeVars(input);

    expect(result).toBe('Hello John, you are a Developer!');
  });

  it('should preserve non-GT ICU elements unchanged', () => {
    const input =
      '{count, number} items and {_gt_, select, other {variable}} with {date, date, short}';
    const result = decodeVars(input);

    expect(result).toBe(
      '{count, number} items and variable with {date, date, short}'
    );
  });

  it('should handle empty string', () => {
    const input = '';
    const result = decodeVars(input);

    expect(result).toBe('');
  });

  it('should handle string with no GT variables', () => {
    const input = 'Hello {name} with {count, plural, one {item} other {items}}';
    const result = decodeVars(input);

    expect(result).toBe(
      'Hello {name} with {count, plural, one {item} other {items}}'
    );
  });

  it('should decode GT variables with complex content', () => {
    const input =
      "{_gt_, select, other {User''s data: '{id: 123} <status>active</status>'}}";
    const result = decodeVars(input);

    expect(result).toBe("User's data: {id: 123} <status>active</status>");
  });

  it('should handle GT variables at different positions', () => {
    const input =
      '{_gt_, select, other {Start}} middle text {_gt_, select, other {End}}';
    const result = decodeVars(input);

    expect(result).toBe('Start middle text End');
  });

  it('should decode GT variables with escaped content', () => {
    const input =
      "{_gt_, select, other {Text with ''quotes'' and '{' braces '}'}}";
    const result = decodeVars(input);

    expect(result).toBe("Text with 'quotes' and { braces }");
  });

  it('should handle GT variables inside ICU plurals', () => {
    const input =
      '{count, plural, =0 {No {_gt_, select, other {messages}}} =1 {One {_gt_, select, other {message}}} other {# messages}}';
    const result = decodeVars(input);

    expect(result).toBe(
      '{count, plural, =0 {No messages} =1 {One message} other {# messages}}'
    );
  });

  it('should handle GT variables inside ICU selects', () => {
    const input =
      '{gender, select, male {He has {_gt_, select, other {book}}} female {She has {_gt_, select, other {book}}} other {They have {_gt_, select, other {book}}}}';
    const result = decodeVars(input);

    expect(result).toBe(
      '{gender, select, male {He has book} female {She has book} other {They have book}}'
    );
  });

  it('should handle GT variables with tags and formatting', () => {
    const input =
      '<bold>{_gt_, select, other {important}}</bold> and {_gt_, select, other {normal}}';
    const result = decodeVars(input);

    expect(result).toBe('<bold>important</bold> and normal');
  });

  it('should handle complex nested scenarios', () => {
    const input = `Welcome {_gt_, select, other {user}}! You have {count, plural, 
      =0 {no {_gt_, select, other {messages}}}
      =1 {one {_gt_, select, other {message}}}
      other {# {_gt_, select, other {messages}}}
    }`;

    const result = decodeVars(input);
    const expected = `Welcome user! You have {count, plural, 
      =0 {no messages}
      =1 {one message}
      other {# messages}
    }`;

    expect(result).toBe(expected);
  });

  describe('edge cases and error handling', () => {
    it('should handle empty GT variable content', () => {
      const input = '{_gt_, select, other {}}';
      const result = decodeVars(input);

      expect(result).toBe('');
    });

    it('should produce valid ICU syntax after decoding mixed content', () => {
      const input =
        '{count, number} {_gt_, select, other {items}} and {date, date, short}';
      const result = decodeVars(input);

      expect(result).toBe('{count, number} items and {date, date, short}');
      // The result should still be parseable as ICU (though it may not be complete)
    });

    it('should handle whitespace in GT variables', () => {
      const input = '  {_gt_, select, other {  spaced content  }}  ';
      const result = decodeVars(input);

      expect(result).toBe('    spaced content    ');
    });

    it('should handle unicode content in GT variables', () => {
      const input = '{_gt_, select, other {你好世界 🌍 café naïve}}';
      const result = decodeVars(input);

      expect(result).toBe('你好世界 🌍 café naïve');
    });
  });
});
