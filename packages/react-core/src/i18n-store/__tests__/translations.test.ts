import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { I18nStore } from '../I18nStore';
import type { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
import type { Translation } from 'gt-i18n/types';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('translation snapshots', () => {
  beforeEach(() => {
    resetGTGlobals();
  });

  it('treats cached null translations as known snapshot results', () => {
    const lookupTranslation = vi.fn(() => 'cache fallback');
    setReactI18nCache({
      lookupTranslation,
    } as unknown as ReactI18nCache);

    const store = new I18nStore();
    const result = store.getTranslateSnapshot(
      {
        locale: 'fr',
        message: 'Source',
        options: {
          $format: 'JSX',
          $_hash: 'known-null',
        },
      },
      {
        fr: {
          'known-null': null as unknown as Translation,
        },
      }
    );

    expect(result).toBeNull();
    expect(lookupTranslation).not.toHaveBeenCalled();
  });
});
