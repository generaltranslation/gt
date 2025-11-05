import { WorkflowStep } from './Workflow.js';
import { createSpinner, logErrorAndExit } from '../console/logging.js';
import { GT } from 'generaltranslation';
import { Settings } from '../types/index.js';
import chalk from 'chalk';
import {
  getCurrentBranch,
  getIncomingBranches,
  getCheckedOutBranches,
} from '../git/branches.js';
import { BranchData } from '../types/branch.js';

// Step 1: Resolve the current branch id & update API with branch information
export class BranchStep extends WorkflowStep<null, BranchData | null> {
  private spinner = createSpinner('dots');
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
    let current: { branchName: string; defaultBranch: boolean } | null = null;
    let incoming: string[] = [];
    let checkedOut: string[] = [];
    let useDefaultBranch: boolean = false;
    if (this.settings.branchOptions.autoDetectBranches) {
      const [currentResult, incomingResult, checkedOutResult] =
        await Promise.all([
          getCurrentBranch(this.settings.branchOptions.remoteName),
          getIncomingBranches(this.settings.branchOptions.remoteName),
          getCheckedOutBranches(this.settings.branchOptions.remoteName),
        ]);
      current = currentResult;
      incoming = incomingResult;
      checkedOut = checkedOutResult;
    }
    if (this.settings.branchOptions.currentBranch) {
      current = {
        branchName: this.settings.branchOptions.currentBranch,
        defaultBranch: current?.defaultBranch ?? false, // we have no way of knowing if this is the default branch without using the auto-detection logic
      };
    } else {
      useDefaultBranch = true; // we don't even use current if this is the case
    }

    if (!current) {
      logErrorAndExit(
        'Failed to determine the current branch. Please specify a custom branch or enable automatic branch detection.'
      );
    }

    const branchData = await this.gt.queryBranchData({
      branchNames: [current.branchName, ...incoming, ...checkedOut],
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
      const currentBranch = branchData.branches.find(
        (b) => b.name === current.branchName
      );
      if (!currentBranch) {
        const createBranchResult = await this.gt.createBranch(current);
        this.branchData.currentBranch = createBranchResult.branch;
      } else {
        this.branchData.currentBranch = currentBranch;
      }
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

    this.spinner.stop(chalk.green('Branch information resolved successfully'));
    return this.branchData;
  }

  async wait(): Promise<void> {
    return;
  }
}
