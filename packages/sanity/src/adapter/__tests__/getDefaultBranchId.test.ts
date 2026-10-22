import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectHandle } from 'generaltranslation';
import { ApiError } from 'generaltranslation/api';
import { getDefaultBranchId } from '../getDefaultBranchId';

const api = {
  listBranches: vi.fn<ProjectHandle['listBranches']>(),
  createBranch: vi.fn<ProjectHandle['createBranch']>(),
  updateBranch: vi.fn<ProjectHandle['updateBranch']>(),
};
const project = api as unknown as ProjectHandle;

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

    await expect(getDefaultBranchId(project)).resolves.toBe('master-id');
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

    await expect(getDefaultBranchId(project)).resolves.toBe('master-id');
    expect(api.createBranch).not.toHaveBeenCalled();
  });

  it('uses an existing non-default main when the project has no default branch', async () => {
    vi.mocked(api.listBranches).mockImplementation(async (query) => ({
      items: [branch('main-id', 'main', false)].filter(
        ({ isDefault }) => !query?.isDefault || isDefault
      ),
      nextCursor: null,
    }));

    await expect(getDefaultBranchId(project)).resolves.toBe('main-id');
    expect(api.listBranches).toHaveBeenCalledWith({ name: ['main'] });
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

    await expect(getDefaultBranchId(project)).resolves.toBe('main-id');
    expect(api.createBranch).toHaveBeenCalledWith({
      name: 'main',
      isDefault: true,
    });
  });

  it('reuses main created concurrently after an empty lookup', async () => {
    vi.mocked(api.listBranches)
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({
        items: [branch('main-id', 'main', true)],
        nextCursor: null,
      });
    vi.mocked(api.createBranch).mockRejectedValue(
      new ApiError('A branch with the requested name already exists.', 409)
    );

    await expect(getDefaultBranchId(project)).resolves.toBe('main-id');
    expect(api.listBranches).toHaveBeenLastCalledWith({ name: ['main'] });
  });

  it('rethrows a conflict when main is still missing', async () => {
    vi.mocked(api.listBranches).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    const conflict = new ApiError('conflict', 409);
    vi.mocked(api.createBranch).mockRejectedValue(conflict);

    await expect(getDefaultBranchId(project)).rejects.toBe(conflict);
  });
});
