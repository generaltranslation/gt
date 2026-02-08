import { WorkflowStep } from './Workflow.js';
import { logErrorAndExit } from '../console/logging.js';
import { logger } from '../console/logger.js';
import { GT } from 'generaltranslation';
import { Settings } from '../types/index.js';
import chalk from 'chalk';
import {
  getCurrentBranch,
  getIncomingBranches,
  getCheckedOutBranches,
} from '../git/branches.js';
import { BranchData } from '../types/branch.js';
import { ApiError } from 'generaltranslation/errors';

// Step 1: Resolve the current branch id & update API with branch information
export class BranchStep extends WorkflowStep<null, BranchData | null> {
  private spinner = logger.createSpinner('dots');
  private branchData: BranchData;
  private settings: Settings;
  private gt: GT;

  constructor(gt: GT, settings: Settings) {
    super();
    this.gt = gt;
    this.settings = settings;
    this.branchData = {
      currentBranch: {
        id: '',
        name: '',
      },
      incomingBranch: null,
      checkedOutBranch: null,
    };
  }

  async run(): Promise<BranchData | null> {
    this.spinner.start(`Resolving branch information...`);

    // First get some info about the branches we're working with
    let current: {
      currentBranchName: string;
      defaultBranch: boolean;
    } | null = null;
    let incoming: string[] = [];
    let checkedOut: string[] = [];
    let useDefaultBranch: boolean = true;
    // Track whether we should assume the branch is checked out from the default branch
    // (when --branch is specified but auto-detection is disabled or failed)
    let assumeCheckedOutFromDefault: boolean = false;
    // Track whether auto-detection was disabled or failed
    let autoDetectionDisabledOrFailed: boolean =
      !this.settings.branchOptions.autoDetectBranches;

    if (
      this.settings.branchOptions.enabled &&
      this.settings.branchOptions.autoDetectBranches
    ) {
      const [currentResult, incomingResult, checkedOutResult] =
        await Promise.all([
          getCurrentBranch(this.settings.branchOptions.remoteName),
          getIncomingBranches(this.settings.branchOptions.remoteName),
          getCheckedOutBranches(this.settings.branchOptions.remoteName),
        ]);
      current = currentResult;
      incoming = incomingResult;
      checkedOut = checkedOutResult;

      // If auto-detection succeeded, don't use default branch
      if (current !== null) {
        useDefaultBranch = false;
      } else {
        // Auto-detection failed (current is null)
        autoDetectionDisabledOrFailed = true;
      }
      // If auto-detection failed but --branch is specified, we'll handle it below
      // If auto-detection failed and no --branch, useDefaultBranch remains true (fallback to default branch)
    }
    if (
      this.settings.branchOptions.enabled &&
      this.settings.branchOptions.currentBranch
    ) {
      // --branch is specified, so we're not using the default branch
      current = {
        currentBranchName: this.settings.branchOptions.currentBranch,
        defaultBranch: current?.defaultBranch ?? false, // we have no way of knowing if this is the default branch without using the auto-detection logic
      };
      useDefaultBranch = false;

      // Only assume branch is checked out from default if auto-detection was disabled or failed
      if (autoDetectionDisabledOrFailed) {
        assumeCheckedOutFromDefault = true;
      }
    }

    const branchData = await this.gt.queryBranchData({
      branchNames: [
        ...(current ? [current.currentBranchName] : []),
        ...incoming,
        ...checkedOut,
      ],
    });

    if (useDefaultBranch) {
      if (!branchData.defaultBranch) {
        const createBranchResult = await this.gt.createBranch({
          branchName: 'main', // name doesn't matter for default branch
          defaultBranch: true,
        });
        this.branchData.currentBranch = createBranchResult.branch;
      } else {
        this.branchData.currentBranch = branchData.defaultBranch;
      }
    } else {
      if (!current) {
        return logErrorAndExit(
          'Failed to determine the current branch. Please specify a custom branch or enable automatic branch detection.'
        );
      }
      const currentBranch = branchData.branches.find(
        (b) => b.name === current.currentBranchName
      );
      if (!currentBranch) {
        try {
          const createBranchResult = await this.gt.createBranch({
            branchName: current.currentBranchName,
            defaultBranch: current.defaultBranch,
          });
          this.branchData.currentBranch = createBranchResult.branch;
        } catch (error) {
          if (error instanceof ApiError && error.code === 403) {
            logger.warn(
              'To enable translation branching, please upgrade your plan. Falling back to default branch.'
            );
            // retry with default branch
            try {
              const createBranchResult = await this.gt.createBranch({
                branchName: 'main', // name doesn't matter for default branch
                defaultBranch: true,
              });
              this.branchData.currentBranch = createBranchResult.branch;
            } catch {}
          }
        }
      } else {
        this.branchData.currentBranch = currentBranch;
      }
    }

    if (this.branchData.currentBranch.id === '') {
      return logErrorAndExit(
        'Something went wrong while resolving branch information. Please try again.'
      );
    }

    // Now set the incoming and checked out branches (first one that exists)
    this.branchData.incomingBranch =
      incoming
        .map((b) => {
          const branch = branchData.branches.find((bb) => bb.name === b);
          if (branch) {
            return branch;
          } else {
            return null;
          }
        })
        .filter((b) => b !== null)[0] ?? null;

    // If --branch was specified but auto-detection is disabled or failed,
    // assume the branch is checked out from the default branch
    if (assumeCheckedOutFromDefault && branchData.defaultBranch) {
      this.branchData.checkedOutBranch = branchData.defaultBranch;
    } else {
      this.branchData.checkedOutBranch =
        checkedOut
          .map((b) => {
            const branch = branchData.branches.find((bb) => bb.name === b);
            if (branch) {
              return branch;
            } else {
              return null;
            }
          })
          .filter((b) => b !== null)[0] ?? null;
    }

    this.spinner.stop(chalk.green('Branch information resolved successfully'));
    return this.branchData;
  }

  async wait(): Promise<void> {
    return;
  }
}
