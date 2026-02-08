import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BranchStep } from '../BranchStep.js';

// Mock the git/branches module
vi.mock('../../git/branches.js', () => ({
  getCurrentBranch: vi.fn(),
  getIncomingBranches: vi.fn(),
  getCheckedOutBranches: vi.fn(),
}));

// Mock the logger
vi.mock('../../console/logger.js', () => ({
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

// Mock the logging module
vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((msg) => {
    throw new Error(msg);
  }),
}));

import {
  getCurrentBranch,
  getIncomingBranches,
  getCheckedOutBranches,
} from '../../git/branches.js';
import { logger } from '../../console/logger.js';

// Mock the GT class
const createMockGt = () => ({
  queryBranchData: vi.fn(),
  createBranch: vi.fn(),
});

describe('BranchStep', () => {
  let mockGt: ReturnType<typeof createMockGt>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGt = createMockGt();
  });

  describe('when auto-detection is disabled', () => {
    const createSettingsWithDisabledAutoDetect = () => ({
      branchOptions: {
        enabled: true,
        autoDetectBranches: false,
        remoteName: 'origin',
        currentBranch: undefined as string | undefined,
      },
    });

    it('should use default branch and log warning when --branch is not specified', async () => {
      const settings = createSettingsWithDisabledAutoDetect();
      settings.branchOptions.currentBranch = undefined;

      mockGt.queryBranchData.mockResolvedValue({
        branches: [],
        defaultBranch: { id: 'default-branch-id', name: 'main' },
      });

      const step = new BranchStep(mockGt as any, settings as any);
      const result = await step.run();

      expect(result).not.toBeNull();
      expect(result!.currentBranch).toEqual({
        id: 'default-branch-id',
        name: 'main',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Branch auto-detection is disabled or failed. Using default branch.'
      );
      // Should not have called git detection functions
      expect(getCurrentBranch).not.toHaveBeenCalled();
    });

    it('should use specified branch and set checkedOutBranch to default when --branch is specified', async () => {
      const settings = createSettingsWithDisabledAutoDetect();
      settings.branchOptions.currentBranch = 'feature-branch';

      mockGt.queryBranchData.mockResolvedValue({
        branches: [],
        defaultBranch: { id: 'default-branch-id', name: 'main' },
      });
      mockGt.createBranch.mockResolvedValue({
        branch: { id: 'feature-branch-id', name: 'feature-branch' },
      });

      const step = new BranchStep(mockGt as any, settings as any);
      const result = await step.run();

      expect(result).not.toBeNull();
      expect(result!.currentBranch).toEqual({
        id: 'feature-branch-id',
        name: 'feature-branch',
      });
      expect(result!.checkedOutBranch).toEqual({
        id: 'default-branch-id',
        name: 'main',
      });
      expect(mockGt.createBranch).toHaveBeenCalledWith({
        branchName: 'feature-branch',
        defaultBranch: false,
      });
      // Should not log warning since we're using the specified branch
      expect(logger.warn).not.toHaveBeenCalledWith(
        'Branch auto-detection is disabled or failed. Using default branch.'
      );
    });
  });

  describe('when auto-detection fails', () => {
    const createSettingsWithAutoDetect = () => ({
      branchOptions: {
        enabled: true,
        autoDetectBranches: true,
        remoteName: 'origin',
        currentBranch: undefined as string | undefined,
      },
    });

    it('should use default branch and log warning when detection fails and no --branch specified', async () => {
      const settings = createSettingsWithAutoDetect();
      settings.branchOptions.currentBranch = undefined;

      // Auto-detection fails (returns null)
      vi.mocked(getCurrentBranch).mockResolvedValue(null);
      vi.mocked(getIncomingBranches).mockResolvedValue([]);
      vi.mocked(getCheckedOutBranches).mockResolvedValue([]);

      mockGt.queryBranchData.mockResolvedValue({
        branches: [],
        defaultBranch: { id: 'default-branch-id', name: 'main' },
      });

      const step = new BranchStep(mockGt as any, settings as any);
      const result = await step.run();

      expect(result).not.toBeNull();
      expect(result!.currentBranch).toEqual({
        id: 'default-branch-id',
        name: 'main',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Branch auto-detection is disabled or failed. Using default branch.'
      );
    });

    it('should use specified branch and set checkedOutBranch to default when detection fails but --branch is specified', async () => {
      const settings = createSettingsWithAutoDetect();
      settings.branchOptions.currentBranch = 'my-feature';

      // Auto-detection fails (returns null)
      vi.mocked(getCurrentBranch).mockResolvedValue(null);
      vi.mocked(getIncomingBranches).mockResolvedValue([]);
      vi.mocked(getCheckedOutBranches).mockResolvedValue([]);

      mockGt.queryBranchData.mockResolvedValue({
        branches: [],
        defaultBranch: { id: 'default-branch-id', name: 'main' },
      });
      mockGt.createBranch.mockResolvedValue({
        branch: { id: 'my-feature-id', name: 'my-feature' },
      });

      const step = new BranchStep(mockGt as any, settings as any);
      const result = await step.run();

      expect(result).not.toBeNull();
      expect(result!.currentBranch).toEqual({
        id: 'my-feature-id',
        name: 'my-feature',
      });
      expect(result!.checkedOutBranch).toEqual({
        id: 'default-branch-id',
        name: 'main',
      });
    });
  });

  describe('when auto-detection succeeds', () => {
    const createSettingsWithAutoDetect = () => ({
      branchOptions: {
        enabled: true,
        autoDetectBranches: true,
        remoteName: 'origin',
        currentBranch: undefined as string | undefined,
      },
    });

    it('should use detected branch when auto-detection succeeds', async () => {
      const settings = createSettingsWithAutoDetect();

      vi.mocked(getCurrentBranch).mockResolvedValue({
        currentBranchName: 'detected-branch',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      vi.mocked(getIncomingBranches).mockResolvedValue([]);
      vi.mocked(getCheckedOutBranches).mockResolvedValue(['main']);

      mockGt.queryBranchData.mockResolvedValue({
        branches: [
          { id: 'detected-branch-id', name: 'detected-branch' },
          { id: 'main-id', name: 'main' },
        ],
        defaultBranch: { id: 'main-id', name: 'main' },
      });

      const step = new BranchStep(mockGt as any, settings as any);
      const result = await step.run();

      expect(result).not.toBeNull();
      expect(result!.currentBranch).toEqual({
        id: 'detected-branch-id',
        name: 'detected-branch',
      });
      expect(result!.checkedOutBranch).toEqual({
        id: 'main-id',
        name: 'main',
      });
      // Should NOT log warning
      expect(logger.warn).not.toHaveBeenCalledWith(
        'Branch auto-detection is disabled or failed. Using default branch.'
      );
    });

    it('should NOT assume checkedOutBranch is default when detection succeeds but checkedOut is empty', async () => {
      const settings = createSettingsWithAutoDetect();
      settings.branchOptions.currentBranch = 'override-branch';

      // Detection succeeds (current is not null)
      vi.mocked(getCurrentBranch).mockResolvedValue({
        currentBranchName: 'detected-branch',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      vi.mocked(getIncomingBranches).mockResolvedValue([]);
      // But checkedOut is empty (e.g., detached HEAD scenario)
      vi.mocked(getCheckedOutBranches).mockResolvedValue([]);

      mockGt.queryBranchData.mockResolvedValue({
        branches: [],
        defaultBranch: { id: 'default-branch-id', name: 'main' },
      });
      mockGt.createBranch.mockResolvedValue({
        branch: { id: 'override-branch-id', name: 'override-branch' },
      });

      const step = new BranchStep(mockGt as any, settings as any);
      const result = await step.run();

      expect(result).not.toBeNull();
      expect(result!.currentBranch).toEqual({
        id: 'override-branch-id',
        name: 'override-branch',
      });
      // Since detection succeeded (current !== null), we should NOT assume default
      // checkedOutBranch should be null because checkedOut array was empty
      expect(result!.checkedOutBranch).toBeNull();
    });

    it('should use detected current branch when on the default branch', async () => {
      const settings = createSettingsWithAutoDetect();

      vi.mocked(getCurrentBranch).mockResolvedValue({
        currentBranchName: 'main',
        defaultBranch: true,
        defaultBranchName: 'main',
      });
      vi.mocked(getIncomingBranches).mockResolvedValue(['feature-1']);
      vi.mocked(getCheckedOutBranches).mockResolvedValue([]);

      // The query should include 'main' (current branch) and 'feature-1' (incoming)
      mockGt.queryBranchData.mockResolvedValue({
        branches: [
          { id: 'main-id', name: 'main' },
          { id: 'feature-1-id', name: 'feature-1' },
        ],
        defaultBranch: { id: 'main-id', name: 'main' },
      });

      const step = new BranchStep(mockGt as any, settings as any);
      const result = await step.run();

      expect(result).not.toBeNull();
      // When detected branch is 'main' and it exists in branches, it should use that
      expect(result!.currentBranch).toEqual({
        id: 'main-id',
        name: 'main',
      });
      expect(result!.incomingBranch).toEqual({
        id: 'feature-1-id',
        name: 'feature-1',
      });
      // queryBranchData should be called with the detected branch names
      expect(mockGt.queryBranchData).toHaveBeenCalledWith({
        branchNames: ['main', 'feature-1'],
      });
    });
  });

  describe('branch creation', () => {
    it('should create default branch if it does not exist', async () => {
      const settings = {
        branchOptions: {
          enabled: true,
          autoDetectBranches: false,
          remoteName: 'origin',
          currentBranch: undefined,
        },
      };

      mockGt.queryBranchData.mockResolvedValue({
        branches: [],
        defaultBranch: null, // No default branch exists
      });
      mockGt.createBranch.mockResolvedValue({
        branch: { id: 'new-default-id', name: 'main' },
      });

      const step = new BranchStep(mockGt as any, settings as any);
      const result = await step.run();

      expect(result).not.toBeNull();
      expect(mockGt.createBranch).toHaveBeenCalledWith({
        branchName: 'main',
        defaultBranch: true,
      });
      expect(result!.currentBranch).toEqual({
        id: 'new-default-id',
        name: 'main',
      });
    });

    it('should create specified branch if it does not exist', async () => {
      const settings = {
        branchOptions: {
          enabled: true,
          autoDetectBranches: false,
          remoteName: 'origin',
          currentBranch: 'new-feature',
        },
      };

      mockGt.queryBranchData.mockResolvedValue({
        branches: [],
        defaultBranch: { id: 'default-id', name: 'main' },
      });
      mockGt.createBranch.mockResolvedValue({
        branch: { id: 'new-feature-id', name: 'new-feature' },
      });

      const step = new BranchStep(mockGt as any, settings as any);
      const result = await step.run();

      expect(result).not.toBeNull();
      expect(mockGt.createBranch).toHaveBeenCalledWith({
        branchName: 'new-feature',
        defaultBranch: false,
      });
      expect(result!.currentBranch).toEqual({
        id: 'new-feature-id',
        name: 'new-feature',
      });
    });
  });
});
