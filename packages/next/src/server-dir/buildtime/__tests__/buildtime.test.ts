import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetGTInternal,
  mockGetMessagesInternal,
  mockGetRequestConditions,
  mockGetTranslationsInternal,
  mockRscT,
  mockUse,
} = vi.hoisted(() => ({
  mockGetGTInternal: vi.fn(),
  mockGetMessagesInternal: vi.fn(),
  mockGetRequestConditions: vi.fn(),
  mockGetTranslationsInternal: vi.fn(),
  mockRscT: vi.fn(),
  mockUse: vi.fn(),
}));

// Each test re-imports the modules, so this memo stands in for one server render.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <A, R>(fn: (arg: A) => R) => {
    const memo = new Map<A, R>();
    return (arg: A) => {
      if (!memo.has(arg)) memo.set(arg, fn(arg));
      return memo.get(arg) as R;
    };
  },
}));

vi.mock('gt-react', () => ({
  createRenderPipeline: vi.fn(() => ({ renderPreparedT: vi.fn() })),
  T: mockRscT,
}));

vi.mock('gt-i18n/internal', () => ({
  getGTInternal: mockGetGTInternal,
  getMessagesInternal: mockGetMessagesInternal,
  getTranslationsInternal: mockGetTranslationsInternal,
}));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('../../../utils/use', () => ({
  use: mockUse,
}));

describe('buildtime translation helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });
  });

  it('T passes request conditions to gt-react T', async () => {
    mockRscT.mockResolvedValue('Bonjour');
    const { T } = await import('../T');

    await expect(T({ children: 'Hello', id: 'greeting' })).resolves.toBe(
      'Bonjour'
    );

    expect(mockRscT).toHaveBeenCalledWith({
      children: 'Hello',
      id: 'greeting',
      _locale: 'fr',
      _enableI18n: false,
      _renderPreparedT: expect.any(Function),
    });
    expect(T._gtt).toBe('translate-server');
  });

  it.each([
    ['without compiler messages', undefined],
    [
      'with compiler messages',
      [{ message: 'A server-translated string from getGT.' }],
    ],
  ])('getGT passes request conditions to gt-i18n %s', async (_, messages) => {
    const gt = vi.fn();
    mockGetGTInternal.mockReturnValue(gt);
    const { getGT } = await import('../strings');

    await expect(getGT(messages)).resolves.toBe(gt);

    expect(mockGetGTInternal).toHaveBeenCalledWith(
      { locale: 'fr', enableI18n: false },
      messages
    );
  });

  it('getMessages passes request conditions to gt-i18n', async () => {
    const messages = vi.fn();
    mockGetMessagesInternal.mockReturnValue(messages);
    const { getMessages } = await import('../strings');

    await expect(getMessages()).resolves.toBe(messages);

    expect(mockGetMessagesInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
    });
  });

  it('getTranslations passes request conditions to gt-i18n', async () => {
    const translations = vi.fn();
    mockGetTranslationsInternal.mockReturnValue(translations);
    const { getTranslations } = await import('../strings');

    await expect(getTranslations()).resolves.toBe(translations);

    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
      rootId: undefined,
    });
  });

  it('getTranslations forwards root id to gt-i18n', async () => {
    const translations = vi.fn();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: true,
    });
    mockGetTranslationsInternal.mockReturnValue(translations);
    const { getTranslations } = await import('../strings');

    await expect(getTranslations('metadata')).resolves.toBe(translations);

    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: true,
      rootId: 'metadata',
    });
  });

  it.each([
    ['useGT', 'getGT', mockGetGTInternal],
    ['useMessages', 'getMessages', mockGetMessagesInternal],
    ['useTranslations', 'getTranslations', mockGetTranslationsInternal],
  ] as const)(
    '%s returns the resolved promise through use()',
    async (_, __, mock) => {
      const value = vi.fn();
      mock.mockReturnValue(value);
      mockUse.mockReturnValue(value);
      const module = await import('../strings');

      const result = module[_]();

      expect(result).toBe(value);
      expect(mockUse).toHaveBeenCalledWith(expect.any(Promise));
    }
  );

  it('useGT forwards compiler messages through getGT', async () => {
    const value = vi.fn();
    const messages = [{ message: 'A server-translated string from useGT.' }];
    mockGetGTInternal.mockReturnValue(value);
    mockUse.mockReturnValue(value);
    const { useGT } = await import('../strings');

    const result = useGT(messages);

    expect(result).toBe(value);
    expect(mockUse).toHaveBeenCalledWith(expect.any(Promise));
    expect(mockGetGTInternal).not.toHaveBeenCalled();

    await expect(mockUse.mock.calls[0][0]).resolves.toBe(value);

    expect(mockGetGTInternal).toHaveBeenCalledWith(
      {
        locale: 'fr',
        enableI18n: false,
      },
      messages
    );
  });

  it('useTranslations forwards root id through getTranslations', async () => {
    const value = vi.fn();
    mockGetTranslationsInternal.mockReturnValue(value);
    mockUse.mockReturnValue(value);
    const { useTranslations } = await import('../strings');

    const result = useTranslations('metadata');

    expect(result).toBe(value);
    expect(mockUse).toHaveBeenCalledWith(expect.any(Promise));
    expect(mockGetTranslationsInternal).not.toHaveBeenCalled();

    await expect(mockUse.mock.calls[0][0]).resolves.toBe(value);

    expect(mockGetTranslationsInternal).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
      rootId: 'metadata',
    });
  });

  it.each([
    ['useGT', mockGetGTInternal],
    ['useMessages', mockGetMessagesInternal],
    ['useTranslations', mockGetTranslationsInternal],
  ] as const)(
    '%s shares one settled promise across calls in a request',
    async (hook, mock) => {
      const value = vi.fn();
      mock.mockReturnValue(value);
      const module = await import('../strings');

      module[hook]();
      module[hook]();
      const [[first], [second]] = mockUse.mock.calls;

      expect(second).toBe(first);
      await expect(first).resolves.toBe(value);
      expect(first).toMatchObject({ status: 'fulfilled', value });
      expect(mock).toHaveBeenCalledTimes(1);
      expect(mockGetRequestConditions).toHaveBeenCalledTimes(1);
    }
  );

  it('keeps per-call loading for compiler messages outside production', async () => {
    const messages = [{ message: 'A server-translated string from useGT.' }];
    const { getGT } = await import('../strings');

    expect(getGT(messages)).not.toBe(getGT(messages));
    expect(getGT()).toBe(getGT());
  });
});
