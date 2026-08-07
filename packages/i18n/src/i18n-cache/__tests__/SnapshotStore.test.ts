import { beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { SnapshotStore } from '../SnapshotStore';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

describe('SnapshotStore', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });
  });

  it('resolves target translations and source messages', () => {
    const snapshots = new SnapshotStore();
    snapshots.updateTranslations({ fr: { greeting: 'Bonjour' } });

    expect(
      snapshots.lookupTranslation('fr', 'Hello', {
        $_hash: 'greeting',
        $format: 'ICU',
      })
    ).toBe('Bonjour');
    expect(
      snapshots.lookupTranslation('en', 'Hello', {
        $_hash: 'greeting',
        $format: 'ICU',
      })
    ).toBe('Hello');
  });

  it('merges dictionaries without replacing sibling entries', () => {
    const snapshots = new SnapshotStore({
      navigation: { home: 'Home' },
    });
    snapshots.updateDictionaries({
      en: { navigation: { account: 'Account' } },
      fr: { navigation: { home: 'Accueil' } },
    });

    expect(snapshots.lookupDictionary('en', 'navigation.home')?.entry).toBe(
      'Home'
    );
    expect(snapshots.lookupDictionary('en', 'navigation.account')?.entry).toBe(
      'Account'
    );
    expect(snapshots.lookupDictionary('fr', 'navigation.home')?.entry).toBe(
      'Accueil'
    );
  });

  it('honors locale overrides supplied to a bound lookup', () => {
    const snapshots = new SnapshotStore();
    snapshots.updateTranslations({ fr: { greeting: 'Bonjour' } });

    expect(
      snapshots.lookupTranslation('fr', 'Hello', {
        $_hash: 'greeting',
        $format: 'ICU',
        $locale: 'fr',
      })
    ).toBe('Bonjour');
  });
});
