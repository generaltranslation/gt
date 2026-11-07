import { describe, it, expect } from 'vitest';
import { hashMessage } from '../hashMessage';

describe('hashMessage', () => {
  // ===== REGRESSION ===== //

  it('produces consistent hashes for same input', () => {
    const hash1 = hashMessage('Hello {name}!', {
      $format: 'ICU',
      $context: 'greeting',
    });
    const hash2 = hashMessage('Hello {name}!', {
      $format: 'ICU',
      $context: 'greeting',
    });

    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
    expect(hash1.length).toBeGreaterThan(0);
  });

  // ===== NEW BEHAVIOR ===== //

  it('applies indexVars only for ICU format (ICU vs STRING hash differs)', () => {
    const icuHash = hashMessage('Hello {name}!', { $format: 'ICU' });
    const stringHash = hashMessage('Hello {name}!', { $format: 'STRING' });

    // ICU format applies indexVars() which transforms {name} → {0}
    // STRING format passes the message as-is
    // So the hashes should be different
    expect(icuHash).not.toBe(stringHash);
  });

  it('uses an explicit hash when provided', () => {
    expect(
      hashMessage('Hello {name}!', {
        $format: 'ICU',
        $_hash: 'precomputed-hash',
      })
    ).toBe('precomputed-hash');
  });

  it('uses an explicit empty hash when provided', () => {
    expect(
      hashMessage('Hello {name}!', {
        $format: 'ICU',
        $_hash: '',
      })
    ).toBe('');
  });

  it('pins hashes for negative maxChars and requiresReview false', () => {
    const hash = hashMessage('Hello {name}!', {
      $format: 'ICU',
      $context: 'greeting',
      $maxChars: -10,
      $requiresReview: false,
    });

    expect(hash).toBe('bbf922aaa31b32e2');
    expect(hash).toBe(
      hashMessage('Hello {name}!', {
        $format: 'ICU',
        $context: 'greeting',
        $maxChars: 10,
      })
    );
  });

  it('does not include custom id in calculated hashes', () => {
    const hash1 = hashMessage('Hello {name}!', {
      $format: 'ICU',
      $id: 'first',
    });
    const hash2 = hashMessage('Hello {name}!', {
      $format: 'ICU',
      $id: 'second',
    });

    expect(hash1).toBe(hash2);
  });
});
