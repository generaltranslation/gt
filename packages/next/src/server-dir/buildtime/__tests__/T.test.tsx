import { describe, expect, it, vi } from 'vitest';

const { mockGetLocale, mockRscT } = vi.hoisted(() => ({
  mockGetLocale: vi.fn(),
  mockRscT: vi.fn(),
}));

vi.mock('../../../request/getLocale', () => ({
  getLocale: mockGetLocale,
}));

vi.mock('gt-react/context', () => ({
  RscT: mockRscT,
}));

describe('buildtime T', () => {
  it('passes the request locale to RscT', async () => {
    mockGetLocale.mockResolvedValue('fr');
    mockRscT.mockResolvedValue('Bonjour');

    const { T } = await import('../T');
    await expect(T({ children: 'Hello', id: 'greeting' })).resolves.toBe(
      'Bonjour'
    );

    expect(mockGetLocale).toHaveBeenCalled();
    expect(mockRscT).toHaveBeenCalledWith({
      children: 'Hello',
      id: 'greeting',
      locale: 'fr',
    });
    expect(T._gtt).toBe('translate-server');
  });
});
