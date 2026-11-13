import { describe, it, expect } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { hashContent } from '../hashContent';

describe('hashContent', () => {
  // ===== REGRESSION ===== //

  it('produces consistent hashes for same input', () => {
    const hash1 = hashContent('Hello {name}!', {
      $format: 'ICU',
      $context: 'greeting',
    });
    const hash2 = hashContent('Hello {name}!', {
      $format: 'ICU',
      $context: 'greeting',
    });

    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
    expect(hash1.length).toBeGreaterThan(0);
  });

  // ===== NEW BEHAVIOR ===== //

  it('applies indexVars only for ICU format', () => {
    const source = 'Hello {_gt_, select, other {Ada}}!';
    const indexed = indexVars(source);
    expect(indexed).not.toBe(source);

    expect(hashContent(source, { $format: 'ICU' })).toBe(
      hashSource({ source: indexed, dataFormat: 'ICU' })
    );
    expect(hashContent(source, { $format: 'STRING' })).toBe(
      hashSource({ source, dataFormat: 'STRING' })
    );
  });

  it('uses an explicit hash when provided', () => {
    expect(
      hashContent('Hello {name}!', {
        $format: 'ICU',
        $_hash: 'precomputed-hash',
      })
    ).toBe('precomputed-hash');
  });

  it('uses an explicit empty hash when provided', () => {
    expect(
      hashContent('Hello {name}!', {
        $format: 'ICU',
        $_hash: '',
      })
    ).toBe('');
  });

  it('does not include custom id in calculated hashes', () => {
    const hash1 = hashContent('Hello {name}!', {
      $format: 'ICU',
      $id: 'first',
    });
    const hash2 = hashContent('Hello {name}!', {
      $format: 'ICU',
      $id: 'second',
    });

    expect(hash1).toBe(hash2);
  });
});
