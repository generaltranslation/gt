import { beforeEach, describe, expect, it } from 'vitest';
import {
  getClientDictionariesSnapshot,
  getClientTranslationsSnapshot,
  setClientSnapshots,
} from '../clientSnapshots';

describe('clientSnapshots', () => {
  beforeEach(() => {
    setClientSnapshots({}, {});
  });

  it('shares SPA translations and dictionaries', () => {
    setClientSnapshots(
      { fr: { greeting: 'Bonjour' } },
      { en: { greeting: 'Hello' } }
    );

    expect(getClientTranslationsSnapshot()).toEqual({
      fr: { greeting: 'Bonjour' },
    });
    expect(getClientDictionariesSnapshot()).toEqual({
      en: { greeting: 'Hello' },
    });
  });
});
