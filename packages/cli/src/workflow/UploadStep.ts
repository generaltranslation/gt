import type { FileToUpload } from 'generaltranslation/types';
import { WorkflowStep } from './Workflow.js';
import { createSpinner } from '../console/logging.js';
import { GT } from 'generaltranslation';
import { Settings } from '../types/index.js';
import chalk from 'chalk';
import { BranchData } from '../types/branch.js';
import type { FileDataResult, FileReference } from 'generaltranslation/types';

export class UploadStep extends WorkflowStep<
  { files: FileToUpload[]; branchData: BranchData },
  FileReference[]
> {
  private spinner = createSpinner('dots');
  private result: FileReference[] | null = null;

  constructor(
    private gt: GT,
    private settings: Settings
  ) {
    super();
  }

  async run({
    files,
    branchData,
  }: {
    files: FileToUpload[];
    branchData: BranchData;
  }): Promise<FileReference[]> {
    this.spinner.start(
      `Syncing ${files.length} file${files.length !== 1 ? 's' : ''} with General Translation API...`
    );

    // First, figure out which files need to be uploaded

    const fileData = await this.gt.queryFileData({
      sourceFiles: files.map((f) => ({
        fileId: f.fileId,
        versionId: f.versionId,
        branchId: f.branchId ?? branchData.currentBranch.id,
      })),
    });

    // build a map of branch:fileId:versionId to fileData
    const fileDataMap = new Map<
      string,
      NonNullable<FileDataResult['sourceFiles']>[number]
    >();
    fileData.sourceFiles?.forEach((f) => {
      fileDataMap.set(`${f.branchId}:${f.fileId}:${f.versionId}`, f);
    });

    // Build a list of files that need to be uploaded
    const filesToUpload: FileToUpload[] = [];
    const filesToSkipUpload: FileToUpload[] = [];
    files.forEach((f) => {
      if (
        fileDataMap.has(
          `${f.branchId ?? branchData.currentBranch.id}:${f.fileId}:${f.versionId}`
        )
      ) {
        filesToSkipUpload.push(f);
      } else {
        filesToUpload.push(f);
      }
    });

    const response = await this.gt.uploadSourceFiles(
      filesToUpload.map((f) => ({
        source: {
          ...f,
          branchId: f.branchId ?? branchData.currentBranch.id,
          locale: this.settings.defaultLocale,
          incomingBranchId: branchData.incomingBranch?.id,
          checkedOutBranchId: branchData.checkedOutBranch?.id,
        },
      })),
      {
        sourceLocale: this.settings.defaultLocale,
        modelProvider: this.settings.modelProvider,
      }
    );

    this.result = response.uploadedFiles;

    // Merge files that were already uploaded into the result
    this.result.push(
      ...filesToSkipUpload.map((f) => ({
        fileId: f.fileId,
        versionId: f.versionId,
        branchId: f.branchId ?? branchData.currentBranch.id,
        fileName: f.fileName,
        fileFormat: f.fileFormat,
        dataFormat: f.dataFormat,
      }))
    );
    this.spinner.stop(chalk.green('Files uploaded successfully'));

    return this.result;
  }

  async wait(): Promise<void> {
    return;
  }
}
