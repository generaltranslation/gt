import {
  createLookupOptions,
  hashMessage,
  ReadonlyConditionStore,
} from 'gt-i18n/internal';
import { msg } from 'gt-i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { setReadonlyConditionStore } from '../../../condition-store/singleton-operations';
import { setClientSnapshots } from '../../../context/clientSnapshots';
import { isReactI18nCacheInitialized } from '../../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../../setup/i18nConfig';
import {
  getSnapshotGT,
  getSnapshotMessages,
  getSnapshotTranslations,
} from '../snapshotRuntime';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

describe('snapshot translation runtime', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    setReadonlyConditionStore(
      new ReadonlyConditionStore({ locale: 'fr', enableI18n: true })
    );

    const message = 'Hello {name}!';
    const lookupOptions = createLookupOptions('fr', {}, 'ICU');
    setClientSnapshots(
      {
        fr: {
          [hashMessage(message, lookupOptions)]: 'Bonjour {name} !',
        },
      },
      {
        en: {
          metadata: {
            greeting: message,
            profile: { name: 'Name', title: 'Title' },
          },
        },
        fr: {
          metadata: {
            greeting: 'Bonjour {name} !',
            profile: { name: 'Nom' },
          },
        },
      }
    );
  });

  it('resolves strings, messages, and dictionaries without an I18nCache', async () => {
    expect(isReactI18nCacheInitialized()).toBe(false);

    const gt = await getSnapshotGT();
    expect(gt('Hello {name}!', { name: 'Ada' })).toBe('Bonjour Ada !');

    const m = await getSnapshotMessages();
    expect(m(msg('Hello {name}!', { name: 'Ada' }))).toBe('Bonjour Ada !');

    const t = await getSnapshotTranslations('metadata');
    expect(t('greeting', { name: 'Ada' })).toBe('Bonjour Ada !');
    expect(t.obj('profile')).toEqual({ name: 'Nom', title: 'Title' });
  });
});
