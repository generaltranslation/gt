import type { FileToUpload } from 'generaltranslation/types';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../console/logger.js';
import { recordWarning } from '../../state/translateWarnings.js';
import type { GT } from 'generaltranslation';
import type { Settings } from '../../types/index.js';
import chalk from 'chalk';
import { BranchData } from '../../types/branch.js';
import type {
  FileDataResult,
  FileReference,
  OrphanedFile,
} from 'generaltranslation/types';
import {
  activateCurrentFileIdentity,
  type FileIdMigration,
  migrateLockfileFileIds,
  readLockfile,
  writeLockfile,
} from '../../fs/config/downloadedVersions.js';

type DetectedMove = {
  mapping: FileIdMigration;
  contentChanged: boolean;
};

type UploadSourcesClient = Pick<
  GT,
  | 'queryFileData'
  | 'getOrphanedFiles'
  | 'processFileMoves'
  | 'uploadSourceFiles'
>;
type UploadSourcesSettings = Pick<Settings, 'defaultLocale' | 'modelProvider'>;

export class UploadSourcesStep {
  private spinner = logger.createSpinner('dots');

  constructor(
    private gt: UploadSourcesClient,
    private settings: UploadSourcesSettings
  ) {}

  /**
   * Detects file moves by comparing local files against orphaned files.
   * Separator-only path migrations are matched by filename first. Other moves
   * require a unique versionId (content hash) match on both sides.
   */
  private detectMoves(
    localFiles: FileToUpload[],
    orphanedFiles: OrphanedFile[]
  ): DetectedMove[] {
    const moves: DetectedMove[] = [];
    const unmatchedLocalFiles = new Set(localFiles);
    const unmatchedOrphanedFiles = new Set(orphanedFiles);

    const addMove = (local: FileToUpload, orphan: OrphanedFile) => {
      if (orphan.fileId === local.fileId) return;
      moves.push({
        mapping: {
          oldFileId: orphan.fileId,
          newFileId: local.fileId,
          newFileName: local.fileName,
        },
        contentChanged: orphan.versionId !== local.versionId,
      });
      unmatchedLocalFiles.delete(local);
      unmatchedOrphanedFiles.delete(orphan);
    };

    // A separator-only Windows migration is still the same path even when the
    // source content changed. Match this deterministic case before considering
    // content hashes.
    for (const local of localFiles) {
      const candidates = Array.from(unmatchedOrphanedFiles).filter(
        (orphan) => serverFileNameRelation(local, orphan) === 'match'
      );
      if (candidates.length === 1) addMove(local, candidates[0]);
    }

    // A path-like pairing that cannot be proven safe must not fall through to
    // content matching. Otherwise a stale alias whose content changed could
    // be assigned to a different new file that happens to retain its old hash.
    const ambiguousLocalFiles = new Set<FileToUpload>();
    const ambiguousOrphanedFiles = new Set<OrphanedFile>();
    for (const local of unmatchedLocalFiles) {
      for (const orphan of unmatchedOrphanedFiles) {
        const relation = serverFileNameRelation(local, orphan);
        if (relation === 'match' || relation === 'ambiguous') {
          ambiguousLocalFiles.add(local);
          ambiguousOrphanedFiles.add(orphan);
        }
      }
    }

    const localFilesByVersionId = new Map<string, FileToUpload[]>();
    for (const local of unmatchedLocalFiles) {
      if (ambiguousLocalFiles.has(local)) continue;
      const matches = localFilesByVersionId.get(local.versionId) ?? [];
      matches.push(local);
      localFilesByVersionId.set(local.versionId, matches);
    }

    const orphanedFilesByVersionId = new Map<string, OrphanedFile[]>();
    for (const orphan of unmatchedOrphanedFiles) {
      if (ambiguousOrphanedFiles.has(orphan)) continue;
      const matches = orphanedFilesByVersionId.get(orphan.versionId) ?? [];
      matches.push(orphan);
      orphanedFilesByVersionId.set(orphan.versionId, matches);
    }

    // Content hashes still detect real moves, but only when both sides are
    // unique. Identical boilerplate files are intentionally left unmatched
    // instead of assigning translation history to an arbitrary path.
    for (const [versionId, locals] of localFilesByVersionId) {
      const orphans = orphanedFilesByVersionId.get(versionId) ?? [];
      if (locals.length === 1 && orphans.length === 1) {
        const pathHints = Array.from(unmatchedLocalFiles).filter(
          (local) =>
            !ambiguousLocalFiles.has(local) &&
            serverFileNameRelation(local, orphans[0]) === 'path-hint'
        );
        if (
          pathHints.length > 0 &&
          (pathHints.length !== 1 || pathHints[0] !== locals[0])
        ) {
          continue;
        }
        const orphanHints = Array.from(unmatchedOrphanedFiles).filter(
          (orphan) =>
            !ambiguousOrphanedFiles.has(orphan) &&
            serverFileNameRelation(locals[0], orphan) === 'path-hint'
        );
        if (
          orphanHints.length > 0 &&
          (orphanHints.length !== 1 || orphanHints[0] !== orphans[0])
        ) {
          continue;
        }
        addMove(locals[0], orphans[0]);
      }
    }

    return moves;
  }

  async run({
    files,
    branchData,
    deferIdentityActivation = false,
  }: {
    files: FileToUpload[];
    branchData: BranchData;
    deferIdentityActivation?: boolean;
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

    // Build a map of branch:fileId:versionId to fileData before move
    // detection.
    const fileDataMap = new Map<
      string,
      NonNullable<FileDataResult['sourceFiles']>[number]
    >();
    fileData.sourceFiles?.forEach((f) => {
      fileDataMap.set(`${f.branchId}:${f.fileId}:${f.versionId}`, f);
    });
    // Confirmed current files still participate in move detection. A failed
    // legacy-ID move followed by a successful current-ID upload can leave
    // both identities on the server; excluding the current file would let its
    // stale orphan be mistaken for another identical-content file.
    const moves = this.detectMoves(files, orphanedFilesResult.orphanedFiles);

    // Track successfully moved files
    let successfullyMovedUnchangedFileIds = new Set<string>();

    // Process moves if any were detected
    if (moves.length > 0) {
      this.spinner.message(
        `Detected ${moves.length} moved file${moves.length !== 1 ? 's' : ''}, preserving translations...`
      );

      const moveResult = await this.gt.processFileMoves(
        moves.map((move) => move.mapping),
        {
          branchId: currentBranchId,
        }
      );

      const successfulMoveKeys = new Set(
        moveResult.results
          .filter((result) => result.success)
          .map((result) => `${result.oldFileId}:${result.newFileId}`)
      );
      const successfulMoves = moves.filter((move) =>
        successfulMoveKeys.has(
          `${move.mapping.oldFileId}:${move.mapping.newFileId}`
        )
      );
      successfullyMovedUnchangedFileIds = new Set(
        successfulMoves
          .filter((move) => !move.contentChanged)
          .map((move) => move.mapping.newFileId)
      );
      migrateLockfileFileIds(
        currentBranchId,
        successfulMoves.map((move) => move.mapping)
      );

      const failed = moveResult.summary.failed;

      if (failed > 0) {
        logger.warn(
          `Failed to migrate ${failed} moved file${failed !== 1 ? 's' : ''}`
        );
        for (const r of moveResult.results) {
          if (!r.success) {
            const move = moves.find(
              ({ mapping }) => mapping.newFileId === r.newFileId
            );
            recordWarning(
              'failed_move',
              move?.mapping.newFileName ?? r.newFileId,
              r.error ?? 'Unknown error'
            );
          }
        }
      }
    }

    // Build a list of files that need to be uploaded
    const filesToUpload: FileToUpload[] = [];
    const filesToSkipUpload: FileToUpload[] = [];
    files.forEach((f) => {
      const key = `${f.branchId ?? currentBranchId}:${f.fileId}:${f.versionId}`;
      if (
        fileDataMap.has(key) ||
        successfullyMovedUnchangedFileIds.has(f.fileId)
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
      {
        sourceLocale: this.settings.defaultLocale,
        modelProvider: this.settings.modelProvider,
      }
    );

    // Accept only records that confirm an exact file requested in this upload.
    // The API may not echo transformFormat, so preserve it from local inputs.
    const localFileMap = new Map(
      filesToUpload.map((file) => [
        `${file.branchId ?? currentBranchId}:${file.fileId}:${file.versionId}`,
        file,
      ])
    );

    const result = response.uploadedFiles.flatMap((uploadedFile) => {
      const localFile = localFileMap.get(
        `${uploadedFile.branchId}:${uploadedFile.fileId}:${uploadedFile.versionId}`
      );
      if (!localFile) return [];
      return [
        {
          ...uploadedFile,
          transformFormat:
            localFile.transformFormat ?? uploadedFile.transformFormat,
        },
      ];
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

    if (!deferIdentityActivation) {
      this.activateConfirmedFileIdentities(result, currentBranchId);
    }

    const moveMsg = moves.length > 0 ? ` (${moves.length} moved)` : '';
    this.spinner.stop(chalk.green(`Files uploaded successfully${moveMsg}`));

    return result;
  }

  /**
   * Retires tentative legacy aliases after the current source identity has
   * been confirmed. Stage can defer this until local edits use the legacy
   * translation history; other workflows activate immediately.
   */
  activateConfirmedFileIdentities(
    files: FileReference[],
    currentBranchId: string
  ): void {
    const confirmedCurrentFiles = files.filter(
      (file) => file.branchId === currentBranchId
    );
    if (confirmedCurrentFiles.length > 0) {
      const lockfile = readLockfile({ _branchId: currentBranchId });
      let didActivateIdentity = false;
      for (const file of confirmedCurrentFiles) {
        const entry = lockfile.entryMap.get(file.fileId);
        if (!entry?.previousFileId || entry.fileId !== file.fileId) continue;
        activateCurrentFileIdentity(entry, file.fileId, lockfile.entryMap);
        didActivateIdentity = true;
      }
      if (didActivateIdentity) {
        writeLockfile(lockfile.data, lockfile.originalV1);
      }
    }
  }
}

function serverFileNameRelation(
  local: FileToUpload,
  orphan: OrphanedFile
): 'match' | 'path-hint' | 'ambiguous' | 'none' {
  const localFileName = local.fileName;
  const orphanedFileName = orphan.fileName;
  if (orphanedFileName === localFileName) return 'match';

  // A backslash in a current POSIX path is a literal filename character. Only
  // separator-normalize the server value when the local path is already in the
  // portable slash form emitted by current CLI versions.
  if (localFileName.includes('\\')) return 'none';
  // Pre-normalization Windows paths contained only native separators. Mixed
  // separators therefore identify a POSIX literal rather than a Windows path.
  if (orphanedFileName.includes('/') && orphanedFileName.includes('\\')) {
    return 'none';
  }
  if (orphanedFileName.replace(/\\/g, '/') !== localFileName) return 'none';
  if (path.sep === '\\') return 'match';

  // The all-backslash form is ambiguous on POSIX. A missing literal path does
  // not prove that it was written on Windows: it may itself be the orphan.
  // Use it only as a hint when evaluating globally unique content matches.
  if (fs.existsSync(path.resolve(orphanedFileName))) {
    return 'ambiguous';
  }
  return 'path-hint';
}
