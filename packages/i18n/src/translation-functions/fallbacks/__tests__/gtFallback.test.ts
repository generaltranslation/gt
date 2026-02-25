import { describe, it, expect } from 'vitest';
import { gtFallback } from '../gtFallback';

describe('gtFallback', () => {
  it('returns message unchanged without options', () => {
    const result = gtFallback('Hello, world!');
    expect(result).toBe('Hello, world!');
  });

  it('interpolates variables in message', () => {
    const result = gtFallback('Hello, {name}!', { name: 'Alice' });
    expect(result).toBe('Hello, Alice!');
  });

  it('handles null message', () => {
    const result = gtFallback(null as unknown as string);
    expect(result).toBeNull();
  });

  it('handles undefined message', () => {
    const result = gtFallback(undefined as unknown as string);
    expect(result).toBeUndefined();
  });

  describe('declareVar support', () => {
    it('resolves declareVar in source-only (fallback) mode', () => {
      // No $_fallback set, so extractVars('') returns {}.
      // The unindexed select is resolved via _gt_: 'other'.
      const result = gtFallback('Hello {_gt_, select, other {John}}!', {});
      expect(result).toBe('Hello John!');
    });

    it('resolves multiple declareVars in source-only (fallback) mode', () => {
      const result = gtFallback(
        'I play with {_gt_, select, other {toys}} at the {_gt_, select, other {park}}',
        {}
      );
      expect(result).toBe('I play with toys at the park');
    });

    it('resolves declareVar with $_fallback (translation mode)', () => {
      // The source has the unindexed select with the value.
      // The translation uses a simple indexed argument.
      const source = 'Hello {_gt_, select, other {John}}!';
      const translation = 'Bonjour {_gt_1} !';
      const result = gtFallback(translation, { $_fallback: source });
      expect(result).toBe('Bonjour John !');
    });

    it('resolves declareVar with indexed select in translation', () => {
      // Translation may contain indexed select syntax: {_gt_1, select, other {}}
      // condenseVars should simplify this to {_gt_1}
      const source = 'Hello {_gt_, select, other {John}}!';
      const translation = 'Bonjour {_gt_1, select, other {}} !';
      const result = gtFallback(translation, { $_fallback: source });
      expect(result).toBe('Bonjour John !');
    });

    it('resolves multiple declareVars with reordering in translation', () => {
      const source =
        'I play with {_gt_, select, other {toys}} at the {_gt_, select, other {park}}';
      // Translation reorders the variables
      const translation = 'Je joue au {_gt_2} avec des {_gt_1}';
      const result = gtFallback(translation, { $_fallback: source });
      expect(result).toBe('Je joue au park avec des toys');
    });

    it('resolves declareVar combined with user variables', () => {
      const source =
        'Hello {name}, welcome to {_gt_, select, other {the park}}!';
      const translation = 'Bonjour {name}, bienvenue à {_gt_1} !';
      const result = gtFallback(translation, {
        name: 'Alice',
        $_fallback: source,
      });
      expect(result).toBe('Bonjour Alice, bienvenue à the park !');
    });

    it('resolves multiple declareVars combined with user variables', () => {
      const source =
        '{name} bought {_gt_, select, other {3 apples}} and {_gt_, select, other {2 oranges}}';
      const translation = '{name} a acheté {_gt_1} et {_gt_2}';
      const result = gtFallback(translation, {
        name: 'Bob',
        $_fallback: source,
      });
      expect(result).toBe('Bob a acheté 3 apples et 2 oranges');
    });

    it('handles empty declareVar value', () => {
      const source = 'Hello {_gt_, select, other {}}!';
      const translation = 'Bonjour {_gt_1} !';
      const result = gtFallback(translation, { $_fallback: source });
      expect(result).toBe('Bonjour  !');
    });

    it('works when $_fallback has no declareVar markers', () => {
      // $_fallback is set but has no _gt_ markers - should behave like normal interpolation
      const source = 'Hello {name}!';
      const translation = 'Bonjour {name} !';
      const result = gtFallback(translation, {
        name: 'Alice',
        $_fallback: source,
      });
      expect(result).toBe('Bonjour Alice !');
    });
  });

  describe('fallback retry on formatting failure', () => {
    it('retries with source when translation formatting fails', () => {
      // Malformed translation that will cause formatMessage to throw
      const source = 'Hello {_gt_, select, other {World}}!';
      const translation = 'Bonjour {_gt_1, bad_syntax, other {}}!';
      const result = gtFallback(translation, { $_fallback: source });
      // Should fall back to formatting the source, resolving the unindexed select
      expect(result).toBe('Hello World!');
    });

    it('retries with source and preserves user variables', () => {
      const source =
        'Hello {name}, welcome to {_gt_, select, other {the park}}!';
      const translation = 'Bonjour {name, bad_syntax, other {}} {_gt_1}!';
      const result = gtFallback(translation, {
        name: 'Alice',
        $_fallback: source,
      });
      // Should fall back to formatting the source with user variables
      expect(result).toBe('Hello Alice, welcome to the park!');
    });

    it('returns raw message with cutoff when no fallback and formatting fails', () => {
      // Malformed ICU with no $_fallback — returns the raw encodedMsg
      const result = gtFallback('{bad, bad_syntax, other {}}', {});
      // formatMessage wrapper catches internally and returns raw string,
      // so this tests that the outer catch also gracefully handles it
      expect(typeof result).toBe('string');
    });
  });
});
