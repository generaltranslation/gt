import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectHandle } from 'generaltranslation';
import { getDefaultBranchId } from '../getDefaultBranchId';

const api = {
  listBranches: vi.fn<ProjectHandle['listBranches']>(),
  createOrReuseBranch: vi.fn<ProjectHandle['createOrReuseBranch']>(),
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
    expect(api.createOrReuseBranch).not.toHaveBeenCalled();
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
    expect(api.createOrReuseBranch).not.toHaveBeenCalled();
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
    expect(api.createOrReuseBranch).not.toHaveBeenCalled();
  });

  it('creates main as the default branch when the project has none', async () => {
    vi.mocked(api.listBranches).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    vi.mocked(api.createOrReuseBranch).mockResolvedValue(
      branch('main-id', 'main', true)
    );

    await expect(getDefaultBranchId(project)).resolves.toBe('main-id');
    expect(api.createOrReuseBranch).toHaveBeenCalledWith({
      name: 'main',
      isDefault: true,
    });
  });
});
