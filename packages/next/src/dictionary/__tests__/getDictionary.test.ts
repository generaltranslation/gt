import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateDictionaries = vi.hoisted(() => vi.fn());
const mockLoadDictionary = vi.hoisted(() => vi.fn());
const mockLookupDictionaryObj = vi.hoisted(() => vi.fn());

vi.mock('../../config-dir/getI18NConfig', () => ({
  getI18NConfig: () => ({
    getDefaultLocale: () => 'en',
    updateDictionaries: mockUpdateDictionaries,
    loadDictionary: mockLoadDictionary,
    lookupDictionaryObj: mockLookupDictionaryObj,
  }),
}));

describe('getDictionary', () => {
  beforeEach(async () => {
    mockUpdateDictionaries.mockReset();
    mockLoadDictionary.mockReset();
    mockLookupDictionaryObj.mockReset();
    mockLoadDictionary.mockResolvedValue({ greeting: 'Hello' });
    mockLookupDictionaryObj.mockReturnValue(undefined);

    const { _setDictionary } = await import('../getDictionary');
    _setDictionary({});
    mockUpdateDictionaries.mockClear();
  });

  it('syncs set dictionaries into i18n cache', async () => {
    const { _setDictionary } = await import('../getDictionary');
    const dictionary = { greeting: 'Hello' };

    _setDictionary(dictionary);

    expect(mockUpdateDictionaries).toHaveBeenCalledWith({
      en: dictionary,
    });
  });

  it('reads cached dictionary entries before falling back to the singleton', async () => {
    mockLookupDictionaryObj.mockReturnValue('Bonjour');
    const { _setDictionary, getDictionaryEntry } =
      await import('../getDictionary');

    _setDictionary({ greeting: 'Hello' });

    expect(getDictionaryEntry('greeting')).toBe('Bonjour');
  });

  it('returns dictionaries through the i18n cache', async () => {
    const { _setDictionary, getDictionary } = await import('../getDictionary');
    _setDictionary({ greeting: 'Hello' });

    await expect(getDictionary()).resolves.toEqual({ greeting: 'Hello' });
    expect(mockLoadDictionary).toHaveBeenCalledWith('en');
  });
});
