import { describe, expect, it, vi } from 'vitest';

const { mockGetRequestConditions, mockRscT } = vi.hoisted(() => ({
  mockGetRequestConditions: vi.fn(),
  mockRscT: vi.fn(),
}));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('gt-react/context', () => ({
  T: mockRscT,
}));

describe('buildtime T', () => {
  it('passes request conditions to gt-react/context T', async () => {
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });
    mockRscT.mockResolvedValue('Bonjour');

    const { T } = await import('../T');
    await expect(T({ children: 'Hello', id: 'greeting' })).resolves.toBe(
      'Bonjour'
    );

    expect(mockGetRequestConditions).toHaveBeenCalled();
    expect(mockRscT).toHaveBeenCalledWith({
      children: 'Hello',
      id: 'greeting',
      locale: 'fr',
      enableI18n: false,
    });
    expect(T._gtt).toBe('translate-server');
  });
});
