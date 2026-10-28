import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, ErrorCode } from '@generaltranslation/api';
import { BranchStep } from '../BranchStep.js';

// Mock git branch detection
vi.mock('../../../git/branches.js', () => ({
  getCurrentBranch: vi.fn(),
  getIncomingBranches: vi.fn(),
  getCheckedOutBranches: vi.fn(),
}));

// Mock logger
vi.mock('../../../console/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    createSpinner: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    }),
  },
}));

// Mock logErrorAndExit to throw instead of process.exit
vi.mock('../../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((msg: string) => {
    throw new Error(msg);
  }),
}));

import {
  getCurrentBranch,
  getIncomingBranches,
  getCheckedOutBranches,
} from '../../../git/branches.js';
import { logger } from '../../../console/logger.js';

const mockGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockGetIncomingBranches = vi.mocked(getIncomingBranches);
const mockGetCheckedOutBranches = vi.mocked(getCheckedOutBranches);

const mockGt = {
  listBranches: vi.fn(),
  createBranch: vi.fn(),
  updateBranch: vi.fn(),
};

const defaultBranch = { id: 'default-id', name: 'main', isDefault: true };
const featureBranch = { id: 'feature-id', name: 'feature-x', isDefault: false };

// Answers the default-branch query and the name query like the API would.
function mockBranchLists({
  branches,
  defaultBranch,
}: {
  branches: (typeof featureBranch)[];
  defaultBranch: typeof featureBranch | null;
}) {
  mockGt.listBranches.mockImplementation(
    async (query: { isDefault?: string; name?: string[] }) => ({
      items:
        query.isDefault === 'true'
          ? defaultBranch
            ? [defaultBranch]
            : []
          : branches.filter((b) => query.name?.includes(b.name)),
      nextCursor: null,
    })
  );
}

function makeSettings(
  overrides: {
    enabled?: boolean;
    autoDetectBranches?: boolean;
    currentBranch?: string;
  } = {}
) {
  return {
    branchOptions: {
      enabled: overrides.enabled ?? true,
      autoDetectBranches: overrides.autoDetectBranches ?? true,
      remoteName: 'origin',
      currentBranch: overrides.currentBranch,
    },
  };
}

describe('BranchStep', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.VERCEL_GIT_COMMIT_REF;

    mockGetIncomingBranches.mockResolvedValue([]);
    mockGetCheckedOutBranches.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('git auto-detection succeeds', () => {
    it('should use the detected branch', async () => {
      mockGetCurrentBranch.mockResolvedValue({
        currentBranchName: 'feature-x',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      mockBranchLists({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(mockGt, makeSettings());
      const result = await step.run();

      expect(result?.currentBranch).toEqual(featureBranch);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(mockGt.listBranches).toHaveBeenCalledWith({ name: ['feature-x'] });
      expect(mockGt.listBranches).toHaveBeenCalledWith({ isDefault: 'true' });
    });
  });

  describe('git detection fails, no VERCEL_GIT_COMMIT_REF, no --branch', () => {
    it('should warn and fall back to default branch', async () => {
      mockGetCurrentBranch.mockResolvedValue(null);
      mockBranchLists({
        branches: [],
        defaultBranch,
      });

      const step = new BranchStep(mockGt, makeSettings());
      const result = await step.run();

      expect(result?.currentBranch).toEqual(defaultBranch);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('auto-detection failed')
      );
    });
  });

  describe('git detection fails, VERCEL_GIT_COMMIT_REF set', () => {
    it('should use the Vercel env var branch', async () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'feature-x';
      mockGetCurrentBranch.mockResolvedValue(null);
      mockBranchLists({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(mockGt, makeSettings());
      const result = await step.run();

      expect(result?.currentBranch).toEqual(featureBranch);
    });

    it('should set checkedOutBranch to default for non-default Vercel branch', async () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'feature-x';
      mockGetCurrentBranch.mockResolvedValue(null);
      mockBranchLists({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(mockGt, makeSettings());
      const result = await step.run();

      expect(result?.checkedOutBranch).toEqual(defaultBranch);
    });
  });

  describe('git detection fails, --branch specified', () => {
    it('should use the manual branch', async () => {
      mockGetCurrentBranch.mockResolvedValue(null);
      mockBranchLists({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(
        mockGt,
        makeSettings({ currentBranch: 'feature-x' })
      );
      const result = await step.run();

      expect(result?.currentBranch).toEqual(featureBranch);
    });

    it('should set checkedOutBranch to default', async () => {
      mockGetCurrentBranch.mockResolvedValue(null);
      mockBranchLists({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(
        mockGt,
        makeSettings({ currentBranch: 'feature-x' })
      );
      const result = await step.run();

      expect(result?.checkedOutBranch).toEqual(defaultBranch);
    });
  });

  describe('auto-detect disabled, --branch specified', () => {
    it('should use the manual branch and set checkedOutBranch to default', async () => {
      mockBranchLists({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(
        mockGt,
        makeSettings({ autoDetectBranches: false, currentBranch: 'feature-x' })
      );
      const result = await step.run();

      expect(result?.currentBranch).toEqual(featureBranch);
      expect(result?.checkedOutBranch).toEqual(defaultBranch);
      expect(mockGetCurrentBranch).not.toHaveBeenCalled();
    });
  });

  describe('branching disabled', () => {
    it('should fall back to default branch', async () => {
      mockBranchLists({
        branches: [],
        defaultBranch,
      });

      const step = new BranchStep(mockGt, makeSettings({ enabled: false }));
      const result = await step.run();

      expect(result?.currentBranch).toEqual(defaultBranch);
      expect(mockGetCurrentBranch).not.toHaveBeenCalled();
      // No names to look up, so no unfiltered listing of every branch
      expect(mockGt.listBranches).toHaveBeenCalledTimes(1);
      expect(mockGt.listBranches).toHaveBeenCalledWith({ isDefault: 'true' });
    });

    it('creates the default branch by name when none exists', async () => {
      mockBranchLists({ branches: [], defaultBranch: null });
      mockGt.createBranch.mockResolvedValue({ branch: defaultBranch });

      const step = new BranchStep(mockGt, makeSettings({ enabled: false }));
      const result = await step.run();

      expect(mockGt.createBranch).toHaveBeenCalledWith({
        name: 'main',
        isDefault: true,
      });
      expect(result?.currentBranch).toEqual(defaultBranch);
    });
  });

  describe('new branch creation', () => {
    it('should propagate non-branching API errors', async () => {
      mockGetCurrentBranch.mockResolvedValue({
        currentBranchName: 'new-branch',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      mockBranchLists({
        branches: [],
        defaultBranch,
      });
      const error = new ApiError('server failed', 500);
      mockGt.createBranch.mockRejectedValue(error);

      const step = new BranchStep(mockGt, makeSettings());

      await expect(step.run()).rejects.toBe(error);
    });

    it('should reuse the fetched default branch when branching is unavailable', async () => {
      mockGetCurrentBranch.mockResolvedValue({
        currentBranchName: 'new-branch',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      mockBranchLists({
        branches: [],
        defaultBranch,
      });
      mockGt.createBranch.mockRejectedValueOnce(
        new ApiError(
          'branching unavailable',
          403,
          ErrorCode.PLAN_FEATURE_UNAVAILABLE
        )
      );

      const step = new BranchStep(mockGt, makeSettings());
      const result = await step.run();

      expect(result?.currentBranch).toEqual(defaultBranch);
      expect(mockGt.createBranch).toHaveBeenCalledTimes(1);
    });

    it('propagates a 403 that is not a plan limitation', async () => {
      mockGetCurrentBranch.mockResolvedValue({
        currentBranchName: 'new-branch',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      mockBranchLists({
        branches: [],
        defaultBranch,
      });
      const error = new ApiError(
        'Missing permission',
        403,
        ErrorCode.PERMISSION_MISSING
      );
      mockGt.createBranch.mockRejectedValueOnce(error);

      await expect(new BranchStep(mockGt, makeSettings()).run()).rejects.toBe(
        error
      );
    });

    it('should create a new branch when not found on server', async () => {
      mockGetCurrentBranch.mockResolvedValue({
        currentBranchName: 'new-branch',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      mockBranchLists({
        branches: [],
        defaultBranch,
      });
      mockGt.createBranch.mockResolvedValue({
        branch: { id: 'new-id', name: 'new-branch' },
      });

      const step = new BranchStep(mockGt, makeSettings());
      const result = await step.run();

      expect(mockGt.createBranch).toHaveBeenCalledWith({
        name: 'new-branch',
        isDefault: false,
      });
      expect(result?.currentBranch).toEqual({
        id: 'new-id',
        name: 'new-branch',
      });
    });
  });

  describe('concurrent branch creation', () => {
    const conflict = new ApiError(
      'A branch with the requested name already exists.',
      409,
      ErrorCode.ALREADY_EXISTS
    );

    // The first name lookup is empty; another run creates `created` before ours.
    function mockConcurrentCreation(
      created: typeof featureBranch | null,
      defaultBranch: typeof featureBranch | null
    ) {
      let nameLookups = 0;
      mockGt.listBranches.mockImplementation(
        async (query: { isDefault?: string; name?: string[] }) => ({
          items:
            query.isDefault === 'true'
              ? defaultBranch
                ? [defaultBranch]
                : []
              : nameLookups++ > 0 && created
                ? [created]
                : [],
          nextCursor: null,
        })
      );
      mockGt.createBranch.mockRejectedValue(conflict);
    }

    it('reuses a branch another run created after the lookup', async () => {
      mockGetCurrentBranch.mockResolvedValue({
        currentBranchName: 'feature-x',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      mockConcurrentCreation(featureBranch, defaultBranch);

      const result = await new BranchStep(mockGt, makeSettings()).run();

      expect(mockGt.createBranch).toHaveBeenCalledWith({
        name: 'feature-x',
        isDefault: false,
      });
      expect(result?.currentBranch).toEqual(featureBranch);
    });

    it('reuses and promotes a default branch another run created after the lookup', async () => {
      const created = { id: 'main-id', name: 'main', isDefault: false };
      mockConcurrentCreation(created, null);
      const promoted = { ...created, isDefault: true };
      mockGt.updateBranch.mockResolvedValue(promoted);

      const result = await new BranchStep(
        mockGt,
        makeSettings({ enabled: false })
      ).run();

      expect(mockGt.createBranch).toHaveBeenCalledWith({
        name: 'main',
        isDefault: true,
      });
      expect(mockGt.updateBranch).toHaveBeenCalledWith('main-id', {
        isDefault: true,
      });
      expect(result?.currentBranch).toEqual(promoted);
    });

    it('propagates a 409 that is not already_exists without a lookup', async () => {
      mockGetCurrentBranch.mockResolvedValue({
        currentBranchName: 'feature-x',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      mockConcurrentCreation(featureBranch, defaultBranch);
      const error = new ApiError(
        'Default branch conflict',
        409,
        ErrorCode.DEFAULT_BRANCH_CONFLICT
      );
      mockGt.createBranch.mockRejectedValue(error);

      await expect(new BranchStep(mockGt, makeSettings()).run()).rejects.toBe(
        error
      );
    });

    it('rethrows the conflict when the branch is still missing', async () => {
      mockGetCurrentBranch.mockResolvedValue({
        currentBranchName: 'feature-x',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      mockConcurrentCreation(null, defaultBranch);

      await expect(new BranchStep(mockGt, makeSettings()).run()).rejects.toBe(
        conflict
      );
    });
  });

  describe('git default branch missing from the project', () => {
    beforeEach(() => {
      mockGetCurrentBranch.mockResolvedValue({
        currentBranchName: 'master',
        defaultBranch: true,
        defaultBranchName: 'master',
      });
    });

    it('renames the default branch when it exists under another name', async () => {
      mockBranchLists({ branches: [], defaultBranch });
      const renamed = { ...defaultBranch, name: 'master' };
      mockGt.updateBranch.mockResolvedValue(renamed);

      const result = await new BranchStep(mockGt, makeSettings()).run();

      expect(mockGt.updateBranch).toHaveBeenCalledWith('default-id', {
        name: 'master',
      });
      expect(mockGt.createBranch).not.toHaveBeenCalled();
      expect(result?.currentBranch).toEqual(renamed);
    });

    it('creates the branch as the default when the project has no branches', async () => {
      mockBranchLists({ branches: [], defaultBranch: null });
      const created = { id: 'master-id', name: 'master', isDefault: true };
      mockGt.createBranch.mockResolvedValue({ branch: created });

      const result = await new BranchStep(mockGt, makeSettings()).run();

      expect(mockGt.createBranch).toHaveBeenCalledWith({
        name: 'master',
        isDefault: true,
      });
      expect(mockGt.updateBranch).not.toHaveBeenCalled();
      expect(result?.currentBranch).toEqual(created);
    });
  });

  it('promotes an existing branch by that name when the project has no default', async () => {
    const existing = { id: 'main-id', name: 'main', isDefault: false };
    mockBranchLists({ branches: [existing], defaultBranch: null });
    const promoted = { ...existing, isDefault: true };
    mockGt.updateBranch.mockResolvedValue(promoted);

    const step = new BranchStep(mockGt, makeSettings({ enabled: false }));
    const result = await step.run();

    expect(mockGt.listBranches).toHaveBeenCalledWith({ name: ['main'] });
    expect(mockGt.createBranch).not.toHaveBeenCalled();
    expect(mockGt.updateBranch).toHaveBeenCalledWith('main-id', {
      isDefault: true,
    });
    expect(result?.currentBranch).toEqual(promoted);
  });
});
