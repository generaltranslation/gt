import { describe, expect, it } from 'vitest';
import type { GTContextType } from '../../../context/context';
import { createSRALookupAdapter } from '../factories';

function createContext(): GTContextType {
  return {
    translationsSnapshot: {},
    dictionariesSnapshot: {},
    i18nStore: {} as GTContextType['i18nStore'],
    conditionStore: {} as GTContextType['conditionStore'],
  };
}

describe('createSRALookupAdapter', () => {
  it('returns stable empty translation snapshots', () => {
    const adapter = createSRALookupAdapter(createContext());
    const lookups = [];

    const firstServerSnapshot = adapter.getServerTranslations(lookups);
    const secondServerSnapshot = adapter.getServerTranslations(lookups);
    const resolvedSnapshot = adapter.resolveTranslations(lookups, []);

    expect(secondServerSnapshot).toBe(firstServerSnapshot);
    expect(resolvedSnapshot).toBe(firstServerSnapshot);
  });
});
