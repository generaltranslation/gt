import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BranchStep } from '../BranchStep.js';

// Mock git branch detection
vi.mock('../../git/branches.js', () => ({
  getCurrentBranch: vi.fn(),
  getIncomingBranches: vi.fn(),
  getCheckedOutBranches: vi.fn(),
}));

// Mock logger
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

// Mock logErrorAndExit to throw instead of process.exit
vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((msg: string) => {
    throw new Error(msg);
  }),
}));

import {
  getCurrentBranch,
  getIncomingBranches,
  getCheckedOutBranches,
} from '../../git/branches.js';
import { logger } from '../../console/logger.js';

const mockGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockGetIncomingBranches = vi.mocked(getIncomingBranches);
const mockGetCheckedOutBranches = vi.mocked(getCheckedOutBranches);

const mockGt = {
  queryBranchData: vi.fn(),
  createBranch: vi.fn(),
};

const defaultBranch = { id: 'default-id', name: 'main' };
const featureBranch = { id: 'feature-id', name: 'feature-x' };

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
  } as any;
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
      mockGt.queryBranchData.mockResolvedValue({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(mockGt as any, makeSettings());
      const result = await step.run();

      expect(result?.currentBranch).toEqual(featureBranch);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('git detection fails, no VERCEL_GIT_COMMIT_REF, no --branch', () => {
    it('should warn and fall back to default branch', async () => {
      mockGetCurrentBranch.mockResolvedValue(null);
      mockGt.queryBranchData.mockResolvedValue({
        branches: [],
        defaultBranch,
      });

      const step = new BranchStep(mockGt as any, makeSettings());
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
      mockGt.queryBranchData.mockResolvedValue({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(mockGt as any, makeSettings());
      const result = await step.run();

      expect(result?.currentBranch).toEqual(featureBranch);
    });

    it('should set checkedOutBranch to default for non-default Vercel branch', async () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'feature-x';
      mockGetCurrentBranch.mockResolvedValue(null);
      mockGt.queryBranchData.mockResolvedValue({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(mockGt as any, makeSettings());
      const result = await step.run();

      expect(result?.checkedOutBranch).toEqual(defaultBranch);
    });
  });

  describe('git detection fails, --branch specified', () => {
    it('should use the manual branch', async () => {
      mockGetCurrentBranch.mockResolvedValue(null);
      mockGt.queryBranchData.mockResolvedValue({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(
        mockGt as any,
        makeSettings({ currentBranch: 'feature-x' })
      );
      const result = await step.run();

      expect(result?.currentBranch).toEqual(featureBranch);
    });

    it('should set checkedOutBranch to default', async () => {
      mockGetCurrentBranch.mockResolvedValue(null);
      mockGt.queryBranchData.mockResolvedValue({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(
        mockGt as any,
        makeSettings({ currentBranch: 'feature-x' })
      );
      const result = await step.run();

      expect(result?.checkedOutBranch).toEqual(defaultBranch);
    });
  });

  describe('auto-detect disabled, --branch specified', () => {
    it('should use the manual branch and set checkedOutBranch to default', async () => {
      mockGt.queryBranchData.mockResolvedValue({
        branches: [featureBranch],
        defaultBranch,
      });

      const step = new BranchStep(
        mockGt as any,
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
      mockGt.queryBranchData.mockResolvedValue({
        branches: [],
        defaultBranch,
      });

      const step = new BranchStep(
        mockGt as any,
        makeSettings({ enabled: false })
      );
      const result = await step.run();

      expect(result?.currentBranch).toEqual(defaultBranch);
      expect(mockGetCurrentBranch).not.toHaveBeenCalled();
    });
  });

  describe('new branch creation', () => {
    it('should create a new branch when not found on server', async () => {
      mockGetCurrentBranch.mockResolvedValue({
        currentBranchName: 'new-branch',
        defaultBranch: false,
        defaultBranchName: 'main',
      });
      mockGt.queryBranchData.mockResolvedValue({
        branches: [],
        defaultBranch,
      });
      mockGt.createBranch.mockResolvedValue({
        branch: { id: 'new-id', name: 'new-branch' },
      });

      const step = new BranchStep(mockGt as any, makeSettings());
      const result = await step.run();

      expect(mockGt.createBranch).toHaveBeenCalledWith({
        branchName: 'new-branch',
        defaultBranch: false,
      });
      expect(result?.currentBranch).toEqual({
        id: 'new-id',
        name: 'new-branch',
      });
    });
  });
});
