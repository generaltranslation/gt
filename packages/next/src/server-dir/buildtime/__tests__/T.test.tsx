import { describe, expect, it, vi } from 'vitest';

const { mockGetEnableI18n, mockGetLocale, mockRscT } = vi.hoisted(() => ({
  mockGetEnableI18n: vi.fn(),
  mockGetLocale: vi.fn(),
  mockRscT: vi.fn(),
}));

vi.mock('../../../request/getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('../../../request/getEnableI18n', () => ({
  getEnableI18n: mockGetEnableI18n,
}));

vi.mock('gt-react/context', () => ({
  RscT: mockRscT,
}));

describe('buildtime T', () => {
  it('passes request conditions to RscT', async () => {
    mockGetLocale.mockResolvedValue('fr');
    mockGetEnableI18n.mockResolvedValue(false);
    mockRscT.mockResolvedValue('Bonjour');

    const { T } = await import('../T');
    await expect(T({ children: 'Hello', id: 'greeting' })).resolves.toBe(
      'Bonjour'
    );

    expect(mockGetLocale).toHaveBeenCalled();
    expect(mockGetEnableI18n).toHaveBeenCalled();
    expect(mockRscT).toHaveBeenCalledWith({
      children: 'Hello',
      id: 'greeting',
      locale: 'fr',
      enableI18n: false,
    });
    expect(T._gtt).toBe('translate-server');
  });
});
