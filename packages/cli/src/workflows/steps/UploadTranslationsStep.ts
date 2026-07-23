import { logger } from '../../console/logger.js';
import { GT } from 'generaltranslation';
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

// The server includes the locale on each uploaded translation, but the
// shared FileReference type does not declare it
type UploadedTranslationReference = FileReference & { locale?: string };

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
    private gt: GT,
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

    const response = await this.gt.uploadTranslations(filesToUpload, {
      sourceLocale: this.settings.defaultLocale,
      modelProvider: this.settings.modelProvider,
    });

    const result = response.uploadedFiles;
    // Report the server-confirmed count, not the attempted count — the
    // endpoint drops files it failed to persist without erroring
    const uploadedCount = result.length;
    this.spinner.stop(
      chalk.green(
        `Uploaded ${uploadedCount} translation file${uploadedCount !== 1 ? 's' : ''}${skippedCount > 0 ? `, skipped ${skippedCount} unchanged` : ''}`
      )
    );
    if (uploadedCount < totalTranslations) {
      const missingCount = totalTranslations - uploadedCount;
      logger.warn(
        chalk.yellow(
          `${missingCount} translation file${missingCount !== 1 ? 's were' : ' was'} not persisted by the server`
        )
      );
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
    confirmed: UploadedTranslationReference[]
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
