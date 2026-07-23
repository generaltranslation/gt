import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetI18nConfig,
  mockGetLocale,
  mockResolveSupportedLocale,
  mockRscT,
  mockRscTx,
} = vi.hoisted(() => ({
  mockGetI18nConfig: vi.fn(),
  mockGetLocale: vi.fn(),
  mockResolveSupportedLocale: vi.fn(),
  mockRscT: vi.fn(),
  mockRscTx: vi.fn(),
}));

vi.mock('gt-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('gt-i18n')>()),
  getLocale: mockGetLocale,
}));

vi.mock('gt-i18n/internal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('gt-i18n/internal')>()),
  getI18nConfig: mockGetI18nConfig,
}));

vi.mock(
  '@generaltranslation/react-core/components-rsc',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@generaltranslation/react-core/components-rsc')
    >()),
    T: mockRscT,
    Tx: mockRscTx,
  })
);

describe('gt-react RSC translate wrappers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetLocale.mockReturnValue('fr');
    mockResolveSupportedLocale.mockImplementation((locale: string) => locale);
    mockGetI18nConfig.mockReturnValue({
      resolveSupportedLocale: mockResolveSupportedLocale,
    });
    mockRscT.mockResolvedValue('translated T');
    mockRscTx.mockResolvedValue('translated Tx');
  });

  it('passes locale conditions to T', async () => {
    const { T } = await import('../index.rsc');

    await expect(T({ children: 'Hello' })).resolves.toBe('translated T');

    expect(mockGetLocale).toHaveBeenCalledOnce();
    expect(mockResolveSupportedLocale).toHaveBeenCalledWith('fr');
    expect(mockRscT).toHaveBeenCalledWith({
      children: 'Hello',
      _locale: 'fr',
      _enableI18n: true,
    });
    expect(T._gtt).toBe('translate-server');
  });

  it('passes locale conditions to Tx', async () => {
    const { Tx } = await import('../index.rsc');

    await expect(
      Tx({ children: 'Hello', context: 'greeting', locale: 'es' })
    ).resolves.toBe('translated Tx');

    expect(mockGetLocale).not.toHaveBeenCalled();
    expect(mockResolveSupportedLocale).toHaveBeenCalledWith('es');
    expect(mockRscTx).toHaveBeenCalledWith({
      children: 'Hello',
      context: 'greeting',
      _locale: 'es',
      _enableI18n: true,
    });
    expect(Tx._gtt).toBe('translate-runtime');
  });
});
