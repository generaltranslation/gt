import { beforeEach, describe, expect, it } from 'vitest';
import { getTranslations, initializeGTDictionary } from '../compat';
import { initializeGT } from '../setup/initializeGT';
import { withGT } from '../setup/withGT';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

describe.sequential('gt-node/compat', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeGT({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: async () => ({}),
    });
    initializeGTDictionary({
      dictionary: { greeting: 'Hello, {name}' },
      loadDictionary: async () => ({ greeting: 'Bonjour, {name}' }),
    });
  });

  it('translates dictionary entries for the request locale', async () => {
    const t = await withGT('fr', () => getTranslations());

    expect(t('greeting', { name: 'Ada' })).toBe('Bonjour, Ada');
  });

  it('reads the source dictionary for the default locale', async () => {
    const t = await withGT('en', () => getTranslations());

    expect(t('greeting', { name: 'Ada' })).toBe('Hello, Ada');
  });
});
