import { describe, expect, it, vi } from 'vitest';

const { mockGetRequestConditions, mockRscT, mockRenderPreparedT } = vi.hoisted(
  () => ({
    mockGetRequestConditions: vi.fn(),
    mockRscT: vi.fn(),
    mockRenderPreparedT: vi.fn(),
  })
);

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

vi.mock('gt-react/context', () => ({
  createRenderPipeline: vi.fn(() => ({
    renderPreparedT: mockRenderPreparedT,
  })),
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
      _locale: 'fr',
      _enableI18n: false,
      _renderPreparedT: expect.any(Function),
    });
    expect(T._gtt).toBe('translate-server');
  });
});
