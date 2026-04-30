import { describe, expect, it } from 'vitest';
import { AsyncConditionStore } from '../AsyncConditionStore';

describe('AsyncConditionStore', () => {
  it('throws when reading the locale outside a scoped context', () => {
    const store = new AsyncConditionStore({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    expect(() => store.getLocale()).toThrow(
      'AsyncConditionStore: getLocale() called outside of a withGT() scope.'
    );
  });

  it('returns the scoped locale inside run()', () => {
    const store = new AsyncConditionStore({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    expect(store.run('fr', () => store.getLocale())).toBe('fr');
  });
});
