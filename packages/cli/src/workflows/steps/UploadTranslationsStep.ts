import { logger } from '../../console/logger.js';
import { recordWarning } from '../../state/translateWarnings.js';
import type { ProjectHandle } from 'generaltranslation';
import { Settings } from '../../types/index.js';
import chalk from 'chalk';
import {
  readLockfile,
  writeLockfile,
  findOrCreateEntry,
  type EntryMap,
} from '../../fs/config/downloadedVersions.js';
import { hashStringSync } from '../../utils/hash.js';
import type { FileReference, FileToUpload } from 'generaltranslation/types';

type UploadTranslationsInput = {
  files: {
    source: FileToUpload;
    translations: FileToUpload[];
  }[];
};

type UploadedTranslation = Awaited<
  ReturnType<ProjectHandle['uploadTranslations']>
>['results'][number];
type ConfirmedTranslationReference = FileReference &
  Pick<UploadedTranslation, 'locale'>;

/**
 * Splits translations into ones that need uploading and ones that can be
 * skipped because their content still matches the gt-lock.json hash recorded
 * at the last sync (download/translate/upload). Files without a lock entry —
 * or with a stale versionId — are always uploaded.
 */
export function partitionTranslationsByLockfile(
  files: UploadTranslationsInput['files'],
  entryMap: EntryMap
): {
  filesToUpload: UploadTranslationsInput['files'];
  skippedCount: number;
} {
  let skippedCount = 0;
  const filesToUpload = files
    .map((file) => {
      const translations = file.translations.filter((translation) => {
        const entry = entryMap.get(translation.fileId);
        if (!entry || entry.versionId !== translation.versionId) return true;
        const lockHash =
          entry.translations[translation.locale]?.postProcessHash;
        if (!lockHash || lockHash !== hashStringSync(translation.content)) {
          return true;
        }
        skippedCount++;
        return false;
      });
      return { source: file.source, translations };
    })
    .filter((file) => file.translations.length > 0);

  return { filesToUpload, skippedCount };
}

export class UploadTranslationsStep {
  private spinner = logger.createSpinner('dots');

  constructor(
    private api: Pick<ProjectHandle, 'uploadTranslations'>,
    private settings: Settings
  ) {}

  async run({ files }: UploadTranslationsInput): Promise<FileReference[]> {
    // Filter to only files that have translations
    const withTranslations = files.filter((f) => f.translations.length > 0);

    if (withTranslations.length === 0) {
      logger.info(
        'No translation files to upload... skipping upload translations step'
      );
      return [];
    }

    // Local translation files are the source of truth: everything local is
    // uploaded (the endpoint is an upsert, so existing translations are
    // overwritten). The one optimization is the lockfile: files whose content
    // hash still matches gt-lock.json are unchanged since the last sync and
    // can be skipped. Without a lockfile, everything uploads.
    const lockfile = readLockfile(this.settings);
    const { filesToUpload, skippedCount } = partitionTranslationsByLockfile(
      withTranslations,
      lockfile.entryMap
    );

    if (filesToUpload.length === 0) {
      logger.info(
        chalk.green(
          `All ${skippedCount} translation file${skippedCount !== 1 ? 's are' : ' is'} unchanged since the last sync... skipping upload translations step`
        )
      );
      return [];
    }

    const totalTranslations = filesToUpload.reduce(
      (acc, f) => acc + f.translations.length,
      0
    );

    this.spinner.start(
      `Uploading ${totalTranslations} translation file${totalTranslations !== 1 ? 's' : ''} to the General Translation API...`
    );

    const response = await this.api.uploadTranslations(filesToUpload);

    const localFiles = new Map<string, FileToUpload>();
    for (const { translations } of filesToUpload) {
      for (const translation of translations) {
        localFiles.set(
          `${translation.fileId}:${translation.versionId}`,
          translation
        );
      }
    }
    const result: ConfirmedTranslationReference[] = response.results
      .filter((r) => r.status === 'succeeded')
      .map((uploadedFile) => {
        const localFile = localFiles.get(
          `${uploadedFile.fileId}:${uploadedFile.versionId}`
        );
        const dataFormat = localFile?.dataFormat;
        const transformFormat = localFile?.transformFormat;
        return {
          branchId: uploadedFile.branchId,
          fileId: uploadedFile.fileId,
          versionId: uploadedFile.versionId,
          fileName: uploadedFile.fileName,
          fileFormat: uploadedFile.fileFormat,
          ...(dataFormat && { dataFormat }),
          ...(transformFormat && { transformFormat }),
          locale: uploadedFile.locale,
        };
      });
    const uploadedCount = result.length;
    this.spinner.stop(
      chalk.green(
        `Uploaded ${uploadedCount} translation file${uploadedCount !== 1 ? 's' : ''}${skippedCount > 0 ? `, skipped ${skippedCount} unchanged` : ''}`
      )
    );
    const failedUploads = response.results.filter((r) => r.status === 'failed');
    if (failedUploads.length > 0) {
      logger.warn(
        chalk.yellow(
          `Failed to upload ${failedUploads.length} translation file${failedUploads.length !== 1 ? 's' : ''}`
        )
      );
      for (const r of failedUploads) {
        const reason = `Translation for locale ${r.locale}: ${r.error ?? 'Unknown error'}`;
        logger.warn(`Failed to upload ${r.fileName}: ${reason}`);
        recordWarning('failed_upload', r.fileName, reason);
      }
    }

    this.recordUploadedHashes(lockfile, filesToUpload, result);

    return result;
  }

  /**
   * Records the content hash of each server-confirmed upload in gt-lock.json
   * so unchanged files are skipped on the next run.
   */
  private recordUploadedHashes(
    lockfile: ReturnType<typeof readLockfile>,
    uploaded: UploadTranslationsInput['files'],
    confirmed: ConfirmedTranslationReference[]
  ): void {
    const confirmedKeys = new Set(
      confirmed
        .filter((file) => file.locale)
        .map((file) => `${file.fileId}:${file.locale}`)
    );
    if (confirmedKeys.size === 0) return;

    const updatedAt = new Date().toISOString();
    for (const file of uploaded) {
      for (const translation of file.translations) {
        if (!confirmedKeys.has(`${translation.fileId}:${translation.locale}`)) {
          continue;
        }
        const entry = findOrCreateEntry(
          lockfile.entryMap,
          lockfile.data.entries,
          translation.fileId,
          translation.versionId
        );
        entry.translations[translation.locale] = {
          ...entry.translations[translation.locale],
          updatedAt,
          postProcessHash: hashStringSync(translation.content),
        };
      }
    }
    writeLockfile(lockfile.data, lockfile.originalV1);
  }
}
