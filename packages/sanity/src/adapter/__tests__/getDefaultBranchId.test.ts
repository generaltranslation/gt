import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../core';
import { getDefaultBranchId } from '../getDefaultBranchId';

vi.mock('../core', () => ({
  api: {
    listBranches: vi.fn(),
    createBranch: vi.fn(),
    updateBranch: vi.fn(),
  },
}));

const branch = (id: string, name: string, isDefault: boolean) => ({
  id,
  name,
  isDefault,
});

describe('getDefaultBranchId', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses a default branch with another name without renaming it', async () => {
    vi.mocked(api.listBranches).mockResolvedValue({
      items: [branch('master-id', 'master', true)],
      nextCursor: null,
    });

    await expect(getDefaultBranchId()).resolves.toBe('master-id');
    expect(api.listBranches).toHaveBeenCalledWith({ isDefault: 'true' });
    expect(api.createBranch).not.toHaveBeenCalled();
    expect(api.updateBranch).not.toHaveBeenCalled();
  });

  it('uses the default branch over a non-default main', async () => {
    vi.mocked(api.listBranches).mockImplementation(async (query) => ({
      items: [
        branch('main-id', 'main', false),
        branch('master-id', 'master', true),
      ].filter(({ isDefault }) => !query?.isDefault || isDefault),
      nextCursor: null,
    }));

    await expect(getDefaultBranchId()).resolves.toBe('master-id');
    expect(api.createBranch).not.toHaveBeenCalled();
  });

  it('creates main as the default branch when the project has none', async () => {
    vi.mocked(api.listBranches).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    vi.mocked(api.createBranch).mockResolvedValue({
      branch: branch('main-id', 'main', true),
    });

    await expect(getDefaultBranchId()).resolves.toBe('main-id');
    expect(api.createBranch).toHaveBeenCalledWith({
      name: 'main',
      isDefault: true,
    });
  });
});
