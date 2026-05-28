import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GtInternalTranslateJsx, T } from '../T';
import { T as ServerT } from '../ServerT';

const {
  mockGetLookupTranslation,
  mockGetShouldTranslate,
  mockRequiresTranslation,
  mockResolver,
  mockUseLocale,
  mockUseSyncExternalStore,
  mockUseTranslate,
} = vi.hoisted(() => ({
  mockGetLookupTranslation: vi.fn(),
  mockGetShouldTranslate: vi.fn(),
  mockRequiresTranslation: vi.fn(),
  mockResolver: vi.fn(),
  mockUseLocale: vi.fn(),
  mockUseSyncExternalStore: vi.fn(),
  mockUseTranslate: vi.fn(),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useMemo: (factory: () => unknown) => factory(),
    useSyncExternalStore: mockUseSyncExternalStore,
  };
});

vi.mock('gt-i18n/internal', () => ({
  getI18nConfig: () => ({
    getDefaultLocale: () => 'en',
    requiresTranslation: mockRequiresTranslation,
  }),
}));

vi.mock('../../../hooks/condition-store', () => ({
  useLocale: mockUseLocale,
}));

vi.mock('../../../hooks/external-store', () => ({
  useTranslate: mockUseTranslate,
}));

vi.mock('../../../hooks/utils', () => ({
  getShouldTranslate: mockGetShouldTranslate,
}));

vi.mock('../../../i18n-cache/singleton-operations', () => ({
  getReactI18nCache: () => ({
    getGTClass: () => ({
      formatCurrency: vi.fn(),
      formatDateTime: vi.fn(),
      formatNum: vi.fn(),
      formatRelativeTime: vi.fn(),
      formatRelativeTimeFromDate: vi.fn(),
    }),
    getLookupTranslation: mockGetLookupTranslation,
  }),
}));

describe('<T>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetShouldTranslate.mockReturnValue(true);
    mockRequiresTranslation.mockReturnValue(true);
    mockUseLocale.mockReturnValue('fr');
    mockUseTranslate.mockReturnValue('Bonjour');
    mockGetLookupTranslation.mockResolvedValue(mockResolver);
    mockResolver.mockReturnValue('Bonjour');
  });

  it('uses useLocale and useTranslate for the normal client implementation', () => {
    const result = T({ $maxChars: -12, children: 'Hello', id: 'greeting' });

    expect(result).toBe('Bonjour');
    expect(mockUseLocale).toHaveBeenCalledTimes(1);
    expect(mockUseTranslate).toHaveBeenCalledWith({
      locale: 'fr',
      message: 'Hello',
      options: expect.objectContaining({
        $format: 'JSX',
        $id: 'greeting',
        $locale: 'fr',
        $maxChars: 12,
      }),
    });
  });

  it('provides an automatic client wrapper around T', () => {
    const result = GtInternalTranslateJsx({ children: 'Hello' });

    expect(result).toBe('Bonjour');
    expect(GtInternalTranslateJsx._gtt).toBe('translate-client-automatic');
    expect(mockUseTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'fr',
        message: 'Hello',
      })
    );
  });

  it('accepts an explicit locale for the server implementation', async () => {
    await expect(
      ServerT({
        $maxChars: -12,
        children: 'Hello',
        id: 'greeting',
        locale: 'fr',
      })
    ).resolves.toBe('Bonjour');

    expect(mockRequiresTranslation).toHaveBeenCalledWith('fr');
    expect(mockGetLookupTranslation).toHaveBeenCalledWith('fr');
    expect(mockResolver).toHaveBeenCalledWith(
      'Hello',
      expect.objectContaining({
        $format: 'JSX',
        $id: 'greeting',
        $locale: 'fr',
        $maxChars: 12,
      })
    );
  });

  it('loads server translations without useLocale or useSyncExternalStore', async () => {
    mockUseLocale.mockImplementation(() => {
      throw new Error('useLocale should not be called');
    });
    mockUseSyncExternalStore.mockImplementation(() => {
      throw new Error('useSyncExternalStore should not be called');
    });

    await expect(ServerT({ children: 'Hello', locale: 'fr' })).resolves.toBe(
      'Bonjour'
    );

    expect(mockUseLocale).not.toHaveBeenCalled();
    expect(mockUseSyncExternalStore).not.toHaveBeenCalled();
  });
});
