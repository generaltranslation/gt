import type { FileToUpload, ProjectHandle } from 'generaltranslation';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { logger } from '../console/logger.js';
import { recordWarning } from '../state/translateWarnings.js';
import type { BranchData } from '../types/branch.js';
import type { Settings } from '../types/index.js';
import { hashStringSync } from '../utils/hash.js';
import { UploadTranslationsStep } from '../workflows/steps/UploadTranslationsStep.js';

export type MigrationUploadClient = Pick<
  ProjectHandle,
  'queryFiles' | 'uploadSourceFiles' | 'uploadTranslations'
>;

export type MigrationUploadResult = {
  /** The seed version the partly covered locales were uploaded under. */
  seedVersionId?: string;
  /** Locales uploaded under the real version, which `gt translate` skips. */
  completedLocales: string[];
  /** Locales uploaded only under the seed, whose missing keys `gt translate` translates. */
  seededLocales: string[];
  /** Why partly covered locales were not seeded. */
  seedSkipped?: string;
  /** Whether the platform holds the real source version. */
  sourceUploaded: boolean;
  failed: boolean;
};

export function seedVersionId(versionId: string): string {
  return hashStringSync(`gt-migrate-seed:${versionId}`);
}

const realVersionExistsWarning = createDiagnosticMessage({
  source: 'gt',
  severity: 'Warning',
  whatHappened:
    'The partly migrated locales were not uploaded, because this source version already exists on the branch',
  why: 'the platform links a version to earlier translations only when the version is first uploaded',
  reassurance:
    'If an earlier gt migrate run uploaded this version, it is already linked to its migrated translations',
  wayOut:
    'Otherwise gt translate translates the partly migrated locales in full',
});

export async function uploadMigration({
  client,
  settings,
  branchData,
  template,
  translations,
  completeLocales,
}: {
  client: MigrationUploadClient;
  settings: Settings;
  branchData: BranchData;
  /** The GTJSON source `gt translate` uploads. */
  template: FileToUpload;
  /** Each locale's migrated catalog, serialized as it is written locally. */
  translations: Record<string, string>;
  /** Locales that hold a value for every key of the source. */
  completeLocales: string[];
}): Promise<MigrationUploadResult> {
  const branchId = template.branchId ?? branchData.currentBranch.id;
  const source = { ...template, branchId };
  const translationFile = (
    locale: string,
    versionId: string
  ): FileToUpload => ({
    content: translations[locale],
    fileName: template.fileName,
    fileFormat: template.fileFormat,
    fileId: template.fileId,
    versionId,
    locale,
  });
  const complete = completeLocales.filter((locale) => locale in translations);
  const partial = Object.keys(translations).filter(
    (locale) => !complete.includes(locale)
  );
  const result: MigrationUploadResult = {
    completedLocales: [],
    seededLocales: [],
    sourceUploaded: false,
    failed: false,
  };

  const uploadSource = async (versionId: string): Promise<boolean> => {
    const response = await client.uploadSourceFiles(
      [
        {
          source: {
            ...source,
            versionId,
            locale: settings.defaultLocale,
            incomingBranchId: branchData.incomingBranch?.id,
            checkedOutBranchId: branchData.checkedOutBranch?.id,
          },
        },
      ],
      { sourceLocale: settings.defaultLocale }
    );
    const failure = response.results.find((r) => r.status === 'failed');
    if (failure || response.results.length === 0) {
      const reason = failure?.status === 'failed' ? failure.error : 'no result';
      logger.warn(`Failed to upload ${template.fileName}: ${reason}`);
      recordWarning('failed_upload', template.fileName, reason);
      result.failed = true;
      return false;
    }
    return true;
  };

  const existing = await client.queryFiles([
    { fileId: template.fileId, versionId: template.versionId, branchId },
  ]);
  const realExists = existing.results[0]?.status === 'found';

  if (partial.length > 0) {
    if (realExists) {
      result.seedSkipped = realVersionExistsWarning;
      logger.warn(realVersionExistsWarning);
    } else {
      const seed = seedVersionId(template.versionId);
      if (await uploadSource(seed)) {
        const response = await client.uploadTranslations([
          {
            source: { ...source, versionId: seed },
            translations: [...partial, ...complete].map((locale) =>
              translationFile(locale, seed)
            ),
          },
        ]);
        for (const r of response.results) {
          if (r.status === 'failed') {
            const reason = `Translation for locale ${r.locale}: ${r.error}`;
            logger.warn(`Failed to upload ${r.fileName}: ${reason}`);
            recordWarning('failed_upload', r.fileName, reason);
            result.failed = true;
          } else if (partial.includes(r.locale)) {
            result.seededLocales.push(r.locale);
          }
        }
        result.seedVersionId = seed;
      }
    }
  }

  if (!realExists && !(await uploadSource(template.versionId))) return result;
  result.sourceUploaded = true;

  if (complete.length > 0) {
    const uploaded = await new UploadTranslationsStep(client, settings).run({
      files: [
        {
          source,
          translations: complete.map((locale) =>
            translationFile(locale, template.versionId)
          ),
        },
      ],
    });
    result.completedLocales = uploaded
      .map((file) => (file as { locale?: string }).locale)
      .filter((locale): locale is string => !!locale);
  }
  return result;
}
