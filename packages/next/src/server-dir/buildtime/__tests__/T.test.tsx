import { describe, expect, it, vi } from 'vitest';

const { mockCoreT, mockGetRequestConditions } = vi.hoisted(() => ({
  mockCoreT: vi.fn(),
  mockGetRequestConditions: vi.fn(),
}));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('gt-react/context', () => ({
  T: mockCoreT,
}));

describe('buildtime T', () => {
  it('passes request conditions to gt-react/context T', async () => {
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });
    mockCoreT.mockResolvedValue('Bonjour');

    const { T } = await import('../T');
    await expect(T({ children: 'Hello', id: 'greeting' })).resolves.toBe(
      'Bonjour'
    );

    expect(mockGetRequestConditions).toHaveBeenCalled();
    expect(mockCoreT).toHaveBeenCalledWith({
      children: 'Hello',
      id: 'greeting',
      locale: 'fr',
      enableI18n: false,
    });
    expect(T._gtt).toBe('translate-server');
  });
});
