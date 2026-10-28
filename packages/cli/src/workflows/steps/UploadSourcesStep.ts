import type {
  FileReference,
  FileToUpload,
  MoveMapping,
  ProjectHandle,
} from 'generaltranslation';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { logger } from '../../console/logger.js';
import { recordWarning } from '../../state/translateWarnings.js';
import {
  clearOrphanedFileNames,
  recordOrphanedFileNames,
} from '../../state/orphanedFileNames.js';
import type { Settings } from '../../types/index.js';
import chalk from 'chalk';
import { BranchData } from '../../types/branch.js';
import {
  ApiError,
  ErrorCode,
  type ListBranchFilesResponse,
} from '@generaltranslation/api';

function createDefaultLocaleNotUpdatedWarning(
  defaultLocale: string,
  error: ApiError
): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened: `The project's default locale was not updated to ${defaultLocale}`,
    why: 'the API key lacks the project settings permission project:write',
    reassurance: 'Your files were uploaded',
    fix: 'Update the default locale in the dashboard, or use a key with project:write',
    details: formatDiagnosticErrorDetails(error),
  });
}

type OrphanedFile = ListBranchFilesResponse['items'][number];

type UploadSourcesClient = Pick<
  ProjectHandle,
  | 'queryFiles'
  | 'listBranchFiles'
  | 'moveFiles'
  | 'uploadSourceFiles'
  | 'get'
  | 'update'
>;
type UploadSourcesSettings = Pick<Settings, 'defaultLocale'>;

export class UploadSourcesStep {
  private spinner = logger.createSpinner('dots');

  constructor(
    private gt: UploadSourcesClient,
    private settings: UploadSourcesSettings
  ) {}

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

  /** The branch's files that are not among the local files (renamed or removed). */
  private async listOrphanedFiles(
    branchId: string,
    localFiles: FileToUpload[]
  ): Promise<OrphanedFile[]> {
    const localFileIds = new Set(localFiles.map((f) => f.fileId));
    const orphanedFiles: OrphanedFile[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.gt.listBranchFiles(branchId, { cursor });
      orphanedFiles.push(
        ...page.items.filter((file) => !localFileIds.has(file.fileId))
      );
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return orphanedFiles;
  }

  async run({
    files,
    branchData,
  }: {
    files: FileToUpload[];
    branchData: BranchData;
  }): Promise<FileReference[]> {
    clearOrphanedFileNames();
    if (files.length === 0) {
      logger.info('No files to upload found... skipping upload step');
      return [];
    }

    const currentBranchId = branchData.currentBranch.id;

    this.spinner.start(
      `Syncing ${files.length} file${files.length !== 1 ? 's' : ''} with General Translation API...`
    );

    // Query file data and orphaned files in parallel
    const [fileData, orphanedFiles] = await Promise.all([
      this.gt.queryFiles(
        files.map((f) => ({
          fileId: f.fileId,
          versionId: f.versionId,
          branchId: f.branchId ?? currentBranchId,
        }))
      ),
      this.listOrphanedFiles(currentBranchId, files),
    ]);

    // Renamed and removed files, for localizing Mintlify redirects later
    recordOrphanedFileNames(orphanedFiles.map((orphan) => orphan.fileName));

    // Detect file moves
    const moves = this.detectMoves(files, orphanedFiles);

    // Track successfully moved files
    let successfullyMovedFileIds = new Set<string>();
    let failedMoves = 0;

    // Process moves if any were detected
    if (moves.length > 0) {
      this.spinner.message(
        `Detected ${moves.length} moved file${moves.length !== 1 ? 's' : ''}, preserving translations...`
      );

      const moveResult = await this.gt.moveFiles(moves, {
        branchId: currentBranchId,
      });

      // Only track files where the move actually succeeded
      successfullyMovedFileIds = new Set(
        moveResult.results
          .filter((r) => r.status === 'succeeded')
          .map((r) => r.newFileId)
      );

      failedMoves = moveResult.summary.failed;

      if (failedMoves > 0) {
        logger.warn(
          `Failed to migrate ${failedMoves} moved file${failedMoves !== 1 ? 's' : ''}`
        );
        for (const r of moveResult.results) {
          if (r.status === 'failed') {
            const move = moves.find((m) => m.newFileId === r.newFileId);
            const name = move?.newFileName ?? r.newFileId;
            const reason = r.error ?? 'Unknown error';
            logger.warn(`Failed to migrate moved file ${name}: ${reason}`);
            recordWarning('failed_move', name, reason);
          }
        }
      }
    }

    // Build a list of files that need to be uploaded; results follow the
    // selector order, so a found result means that file version exists
    const filesToUpload: FileToUpload[] = [];
    const filesToSkipUpload: FileToUpload[] = [];
    files.forEach((f, index) => {
      if (
        fileData.results[index]?.status === 'found' ||
        successfullyMovedFileIds.has(f.fileId)
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
          branchId: f.branchId ?? currentBranchId,
          locale: this.settings.defaultLocale,
          incomingBranchId: branchData.incomingBranch?.id,
          checkedOutBranchId: branchData.checkedOutBranch?.id,
        },
      })),
      { sourceLocale: this.settings.defaultLocale }
    );

    // The API may not echo transformFormat, so preserve it from local inputs.
    const localFileMap = new Map(
      files.map((f) => [`${f.fileId}:${f.versionId}`, f])
    );

    // Only saved files continue to tagging, setup, enqueueing and publishing.
    const failedUploads = response.results.filter((r) => r.status === 'failed');
    if (failedUploads.length > 0) {
      logger.warn(
        `Failed to upload ${failedUploads.length} file${failedUploads.length !== 1 ? 's' : ''}`
      );
      for (const r of failedUploads) {
        const reason = r.error ?? 'Unknown error';
        logger.warn(`Failed to upload ${r.fileName}: ${reason}`);
        recordWarning('failed_upload', r.fileName, reason);
      }
    }

    const result: FileReference[] = response.results
      .filter((r) => r.status === 'succeeded')
      .map((uploadedFile) => {
        const localFile = localFileMap.get(
          `${uploadedFile.fileId}:${uploadedFile.versionId}`
        );
        return {
          branchId: uploadedFile.branchId,
          fileId: uploadedFile.fileId,
          versionId: uploadedFile.versionId,
          fileName: uploadedFile.fileName,
          fileFormat: uploadedFile.fileFormat,
          dataFormat: localFile?.dataFormat,
          transformFormat: localFile?.transformFormat,
        };
      });

    // Merge files that were already uploaded into the result
    result.push(
      ...filesToSkipUpload.map((f) => ({
        fileId: f.fileId,
        versionId: f.versionId,
        branchId: f.branchId ?? currentBranchId,
        fileName: f.fileName,
        fileFormat: f.fileFormat,
        transformFormat: f.transformFormat,
        dataFormat: f.dataFormat,
        locale: f.locale,
      }))
    );

    // Source uploads do not update the project's default locale.
    if (result.length > 0) {
      const project = await this.gt.get();
      if (project.defaultLocale !== this.settings.defaultLocale) {
        try {
          await this.gt.update({
            defaultLocale: this.settings.defaultLocale,
          });
        } catch (error) {
          // A key without project:write can still upload and translate files.
          if (
            !(error instanceof ApiError) ||
            error.code !== ErrorCode.PERMISSION_MISSING
          )
            throw error;
          logger.warn(
            createDefaultLocaleNotUpdatedWarning(
              this.settings.defaultLocale,
              error
            )
          );
          recordWarning(
            'failed_project_update',
            'Default locale',
            `The API key lacks project:write, so it stays ${project.defaultLocale}`
          );
        }
      }
    }

    const moveMsg =
      moves.length > 0
        ? ` (${successfullyMovedFileIds.size} moved${failedMoves > 0 ? `, ${failedMoves} move${failedMoves !== 1 ? 's' : ''} failed` : ''})`
        : '';
    if (failedUploads.length > 0 || failedMoves > 0) {
      this.spinner.stop(
        chalk.yellow(
          `Uploaded ${filesToUpload.length - failedUploads.length} of ${filesToUpload.length} files${moveMsg}`
        )
      );
    } else {
      this.spinner.stop(chalk.green(`Files uploaded successfully${moveMsg}`));
    }

    return result;
  }
}
