import { logErrorAndExit } from '../../console/logging.js';
import { logger } from '../../console/logger.js';
import type { ProjectHandle } from 'generaltranslation';
import type { Settings } from '../../types/index.js';
import chalk from 'chalk';
import {
  getCurrentBranch,
  getIncomingBranches,
  getCheckedOutBranches,
} from '../../git/branches.js';
import { BranchData } from '../../types/branch.js';
import { ApiError, ErrorCode } from '@generaltranslation/api';

type BranchStepClient = Pick<
  ProjectHandle,
  'listBranches' | 'createBranch' | 'updateBranch'
>;
type BranchStepSettings = Pick<Settings, 'branchOptions'>;

// Step 1: Resolve the current branch id & update API with branch information
export class BranchStep {
  private spinner = logger.createSpinner('dots');
  private branchData: BranchData;
  private settings: BranchStepSettings;
  private gt: BranchStepClient;

  constructor(gt: BranchStepClient, settings: BranchStepSettings) {
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
    let detectedDefaultBranchName: string = 'main';
    let autoDetectFailed = !this.settings.branchOptions.autoDetectBranches;

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

      if (currentResult) {
        detectedDefaultBranchName = currentResult.defaultBranchName;
      }

      // Try env var detection if git commands failed (e.g. Vercel)
      if (!currentResult) {
        autoDetectFailed = true;
        const vercelBranch = process.env.VERCEL_GIT_COMMIT_REF;
        if (vercelBranch) {
          current = { currentBranchName: vercelBranch, defaultBranch: false };
        }
      }

      // If detection succeeded, use the detected branch; otherwise fall back to default
      if (current) {
        useDefaultBranch = false;
      }
    }
    if (
      this.settings.branchOptions.enabled &&
      this.settings.branchOptions.currentBranch
    ) {
      current = {
        currentBranchName: this.settings.branchOptions.currentBranch,
        defaultBranch: current?.defaultBranch ?? false, // we have no way of knowing if this is the default branch without using the auto-detection logic
      };
      useDefaultBranch = false;
    }

    // At most 7 names (current, 5 incoming, 1 checked out): under the 20-name
    // filter cap and the default page size, so one page answers each query.
    const branchNames = [
      ...(current ? [current.currentBranchName] : []),
      ...incoming,
      ...checkedOut,
    ];
    const [namedBranches, defaultBranches] = await Promise.all([
      // An empty name filter would list every branch.
      branchNames.length > 0
        ? this.gt.listBranches({ name: branchNames })
        : { items: [] },
      this.gt.listBranches({ isDefault: 'true' }),
    ]);
    const branchData = {
      branches: namedBranches.items,
      defaultBranch: defaultBranches.items[0] ?? null,
    };

    if (useDefaultBranch) {
      if (autoDetectFailed) {
        logger.warn(
          'Branch auto-detection failed. Falling back to the default branch. Use --branch to specify a branch manually.'
        );
      }
      if (!branchData.defaultBranch) {
        this.branchData.currentBranch = await this.resolveDefaultBranch(
          detectedDefaultBranchName,
          null
        );
      } else {
        this.branchData.currentBranch = branchData.defaultBranch;
      }
    } else {
      if (!current) {
        return logErrorAndExit(
          'The current git branch could not be determined. Specify a custom branch or enable automatic branch detection.'
        );
      }
      const currentBranch = branchData.branches.find(
        (b) => b.name === current.currentBranchName
      );
      if (!currentBranch) {
        try {
          this.branchData.currentBranch = current.defaultBranch
            ? await this.resolveDefaultBranch(
                current.currentBranchName,
                branchData.defaultBranch
              )
            : await this.createBranch(current.currentBranchName, false);
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            error.code !== ErrorCode.PLAN_FEATURE_UNAVAILABLE
          )
            throw error;

          logger.warn(
            'To enable translation branching, upgrade your plan. Falling back to default branch.'
          );
          if (branchData.defaultBranch) {
            this.branchData.currentBranch = branchData.defaultBranch;
          } else {
            this.branchData.currentBranch = await this.resolveDefaultBranch(
              detectedDefaultBranchName,
              null
            );
          }
        }
      } else {
        this.branchData.currentBranch = currentBranch;
      }
    }

    if (this.branchData.currentBranch.id === '') {
      return logErrorAndExit(
        'Something went wrong while resolving branch information. Try again.'
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

    // ALWAYS fallback to default branch for checked out branch (to avoid retranslation)
    if (!this.branchData.checkedOutBranch && branchData.defaultBranch) {
      this.branchData.checkedOutBranch = branchData.defaultBranch;
    }

    this.spinner.stop(chalk.green('Branch information resolved successfully'));

    return this.branchData;
  }

  /** Renaming the existing default branch preserves its identity and files. */
  private async resolveDefaultBranch(
    name: string,
    defaultBranch: { id: string; name: string } | null
  ): Promise<{ id: string; name: string }> {
    if (defaultBranch) {
      return await this.gt.updateBranch(defaultBranch.id, { name });
    }
    const {
      items: [existing],
    } = await this.gt.listBranches({ name: [name] });
    const branch = existing ?? (await this.createBranch(name, true));
    return branch.isDefault
      ? branch
      : await this.gt.updateBranch(branch.id, { isDefault: true });
  }

  /** A concurrent run can create the branch after the lookup; `already_exists` reuses it. */
  private async createBranch(name: string, isDefault: boolean) {
    try {
      return (await this.gt.createBranch({ name, isDefault })).branch;
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.code !== ErrorCode.ALREADY_EXISTS
      )
        throw error;
      const {
        items: [existing],
      } = await this.gt.listBranches({ name: [name] });
      if (!existing) throw error;
      return existing;
    }
  }
}
