import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetRequestConditions, mockRscT } = vi.hoisted(() => ({
  mockGetRequestConditions: vi.fn(),
  mockRscT: vi.fn(),
}));

vi.mock('@generaltranslation/react-core/components-rsc', () => ({
  T: mockRscT,
}));

vi.mock('../renderPipeline', () => ({ renderPreparedT: vi.fn() }));

vi.mock('../../../request/getRequestConditions', () => ({
  getRequestConditions: mockGetRequestConditions,
}));

describe('buildtime translation helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestConditions.mockResolvedValue({
      _locale: 'fr',
      _enableI18n: false,
    });
  });

  it('T passes request conditions to the RSC T', async () => {
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
    expect(T._gtt).toEqual({ kind: 'translate' });
  });
});
