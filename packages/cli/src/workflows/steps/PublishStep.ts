import { WorkflowStep } from './WorkflowStep.js';
import { logger } from '../../console/logger.js';
import { GT } from 'generaltranslation';
import type { FileReference } from 'generaltranslation/types';
import chalk from 'chalk';

export class PublishStep extends WorkflowStep<
  FileReference[],
  void
> {
  private spinner = logger.createSpinner('dots');

  constructor(
    private gt: GT,
    private publishMap: Map<string, boolean>
  ) {
    super();
  }

  async run(files: FileReference[]): Promise<void> {
    const filesToPublish = files.filter(
      (f) => this.publishMap.get(f.fileId) === true
    );

    if (filesToPublish.length === 0) return;

    this.spinner.start(
      `Publishing ${filesToPublish.length} file${filesToPublish.length !== 1 ? 's' : ''} to CDN...`
    );

    const result = await this.gt.publishFiles(
      filesToPublish.map((f) => ({
        fileId: f.fileId,
        versionId: f.versionId,
        branchId: f.branchId,
        publish: true,
      }))
    );

    const failed = result.results.filter(
      (r: { success: boolean; error?: string }) => !r.success
    );
    if (failed.length > 0) {
      this.spinner.stop(
        chalk.yellow(
          `Published ${filesToPublish.length - failed.length}/${filesToPublish.length} files (${failed.length} failed)`
        )
      );
      for (const f of failed) {
        logger.warn(`Failed to publish ${f.fileId}: ${f.error}`);
      }
    } else {
      this.spinner.stop(
        chalk.green(
          `${filesToPublish.length} file${filesToPublish.length !== 1 ? 's' : ''} published to CDN`
        )
      );
    }
  }

  async wait(): Promise<void> {
    return;
  }
}
