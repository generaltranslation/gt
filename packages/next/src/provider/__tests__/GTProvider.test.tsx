import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GTProvider } from '../GTProvider';

const mockGetI18NConfig = vi.hoisted(() => vi.fn());
const mockGetLocale = vi.hoisted(() => vi.fn());
const mockGetRegion = vi.hoisted(() => vi.fn());
const mockGetDictionary = vi.hoisted(() => vi.fn());
const mockGetDictionaryEntry = vi.hoisted(() => vi.fn());
const mockClientProviderWrapper = vi.hoisted(() => vi.fn());

vi.mock('../../config-dir/getI18NConfig', () => ({
  getI18NConfig: mockGetI18NConfig,
}));

vi.mock('../../request/getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('../../request/getRegion', () => ({
  getRegion: mockGetRegion,
}));

vi.mock('../../dictionary/getDictionary', () => ({
  getDictionary: mockGetDictionary,
  getDictionaryEntry: mockGetDictionaryEntry,
}));

vi.mock('../ClientProviderWrapper', () => ({
  ClientProviderWrapper: mockClientProviderWrapper,
}));

describe('GTProvider', () => {
  beforeEach(() => {
    mockGetI18NConfig.mockReset();
    mockGetLocale.mockReset();
    mockGetRegion.mockReset();
    mockGetDictionary.mockReset();
    mockGetDictionaryEntry.mockReset();
    mockClientProviderWrapper.mockReset();
  });

  it('sets the source dictionary before loading dictionary translations', async () => {
    const order: string[] = [];
    const sourceDictionary = {
      greeting: 'Hello',
    };
    const config = {
      getDefaultLocale: vi.fn(() => 'en'),
      getLocales: vi.fn(() => ['en', 'fr']),
      requiresTranslation: vi.fn(() => [false, false]),
      getDictionaryTranslations: vi.fn(async () => {
        order.push('getDictionaryTranslations');
        return {};
      }),
      getCachedTranslations: vi.fn(async () => ({})),
      setSourceDictionary: vi.fn(() => {
        order.push('setSourceDictionary');
      }),
      getClientSideConfig: vi.fn(() => ({})),
    };

    mockGetI18NConfig.mockReturnValue(config);
    mockGetLocale.mockResolvedValue('en');
    mockGetRegion.mockResolvedValue(undefined);
    mockGetDictionary.mockResolvedValue(sourceDictionary);
    mockClientProviderWrapper.mockReturnValue(null);

    await GTProvider({
      children: null,
    });

    expect(order).toEqual(['setSourceDictionary', 'getDictionaryTranslations']);
    expect(config.setSourceDictionary).toHaveBeenCalledWith(sourceDictionary);
  });
});
