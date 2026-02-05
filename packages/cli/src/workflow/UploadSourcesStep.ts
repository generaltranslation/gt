import type { FileToUpload } from 'generaltranslation/types';
import { WorkflowStep } from './Workflow.js';
import { logger } from '../console/logger.js';
import { GT } from 'generaltranslation';
import { Settings } from '../types/index.js';
import chalk from 'chalk';
import { BranchData } from '../types/branch.js';
import type {
  FileDataResult,
  FileReference,
  OrphanedFile,
} from 'generaltranslation/types';

type MoveMapping = {
  oldFileId: string;
  newFileId: string;
  newFileName: string;
};

export class UploadSourcesStep extends WorkflowStep<
  { files: FileToUpload[]; branchData: BranchData },
  FileReference[]
> {
  private spinner = logger.createSpinner('dots');
  private result: FileReference[] | null = null;

  constructor(
    private gt: GT,
    private settings: Settings
  ) {
    super();
  }

  /**
   * Detects file moves by comparing local files against orphaned files.
   * A move is detected when a local file has the same versionId (content hash)
   * as an orphaned file but a different fileId (path hash).
   */
  private detectMoves(
    localFiles: FileToUpload[],
    orphanedFiles: OrphanedFile[]
  ): MoveMapping[] {
    const moves: MoveMapping[] = [];

    // Build a map of versionId -> orphaned file
    const orphansByVersionId = new Map<string, OrphanedFile>();
    for (const orphan of orphanedFiles) {
      orphansByVersionId.set(orphan.versionId, orphan);
    }

    // Check each local file against orphaned files
    for (const local of localFiles) {
      const orphan = orphansByVersionId.get(local.versionId);
      if (orphan && orphan.fileId !== local.fileId) {
        // Same content, different path = move detected
        moves.push({
          oldFileId: orphan.fileId,
          newFileId: local.fileId,
          newFileName: local.fileName,
        });
        // Remove from map to avoid matching same orphan twice
        orphansByVersionId.delete(local.versionId);
      }
    }

    return moves;
  }

  async run({
    files,
    branchData,
  }: {
    files: FileToUpload[];
    branchData: BranchData;
  }): Promise<FileReference[]> {
    if (files.length === 0) {
      logger.info('No files to upload found... skipping upload step');
      return [];
    }

    const currentBranchId = branchData.currentBranch.id;

    this.spinner.start(
      `Syncing ${files.length} file${files.length !== 1 ? 's' : ''} with General Translation API...`
    );

    // Query file data and orphaned files in parallel
    const [fileData, orphanedFilesResult] = await Promise.all([
      this.gt.queryFileData({
        sourceFiles: files.map((f) => ({
          fileId: f.fileId,
          versionId: f.versionId,
          branchId: f.branchId ?? currentBranchId,
        })),
      }),
      this.gt.getOrphanedFiles(
        currentBranchId,
        files.map((f) => f.fileId)
      ),
    ]);

    // Detect file moves
    const moves = this.detectMoves(files, orphanedFilesResult.orphanedFiles);

    // Track successfully moved files
    let successfullyMovedFileIds = new Set<string>();

    // Process moves if any were detected
    if (moves.length > 0) {
      this.spinner.message(
        `Detected ${moves.length} moved file${moves.length !== 1 ? 's' : ''}, preserving translations...`
      );

      const moveResult = await this.gt.processFileMoves(moves, {
        branchId: currentBranchId,
      });

      // Only track files where the move actually succeeded
      successfullyMovedFileIds = new Set(
        moveResult.results.filter((r) => r.success).map((r) => r.newFileId)
      );

      const failed = moveResult.summary.failed;

      if (failed > 0) {
        logger.warn(
          `Failed to migrate ${failed} moved file${failed !== 1 ? 's' : ''}`
        );
      }
    }

    // Build a map of branch:fileId:versionId to fileData
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
      const key = `${f.branchId ?? currentBranchId}:${f.fileId}:${f.versionId}`;
      if (fileDataMap.has(key) || successfullyMovedFileIds.has(f.fileId)) {
        filesToSkipUpload.push(f);
      } else {
        filesToUpload.push(f);
      }
    });

    const response = await this.gt.uploadSourceFiles(
      filesToUpload.map((f) => ({
        source: {
          ...f,
          branchId: f.branchId ?? currentBranchId,
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
        branchId: f.branchId ?? currentBranchId,
        fileName: f.fileName,
        fileFormat: f.fileFormat,
        dataFormat: f.dataFormat,
        locale: f.locale,
      }))
    );

    const moveMsg = moves.length > 0 ? ` (${moves.length} moved)` : '';
    this.spinner.stop(chalk.green(`Files uploaded successfully${moveMsg}`));

    return this.result;
  }

  async wait(): Promise<void> {
    return;
  }
}
