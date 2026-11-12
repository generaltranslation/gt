import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetGTInternal,
  mockGetMessagesInternal,
  mockGetRequestConditions,
  mockRscT,
  mockUse,
} = vi.hoisted(() => ({
  mockGetGTInternal: vi.fn(),
  mockGetMessagesInternal: vi.fn(),
  mockGetRequestConditions: vi.fn(),
  mockRscT: vi.fn(),
  mockUse: vi.fn(),
}));

vi.mock('gt-react', () => ({ T: mockRscT }));

vi.mock('../renderPipeline', () => ({ renderPreparedT: vi.fn() }));

vi.mock('gt-i18n/internal', () => ({
  getGTInternal: mockGetGTInternal,
  getMessagesInternal: mockGetMessagesInternal,
}));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('../../../utils/use', () => ({
  use: mockUse,
}));

describe('buildtime translation helpers', () => {
  beforeEach(() => {
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

  it.each([
    ['useGT', 'getGT', mockGetGTInternal],
    ['useMessages', 'getMessages', mockGetMessagesInternal],
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
});
