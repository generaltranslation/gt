import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDownloadedVersions } from '../fs/config/downloadedVersions.js';
import { Settings } from '../types/index.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { getGitUnifiedDiff } from '../utils/gitDiff.js';
import { sendUserEditDiffs } from './sendUserEdits.js';
import type { UserEditDiff } from './sendUserEdits.js';
import { gt } from '../utils/gt.js';

const MAX_CONCURRENT_DIFF_REQUESTS = 30;
const MAX_DIFF_BATCH_BYTES = 1_500_000;

type UploadedFileRef = {
  fileId: string;
  versionId: string;
  fileName: string;
};

/**
 * Collects local user edits by diffing the latest downloaded server translation version
 * against the current local translation file, and submits the diffs upstream.
 *
 * Must run before enqueueing new translations so rules are available to the generator.
 */
export async function collectAndSendUserEditDiffs(
  uploadedFiles: UploadedFileRef[],
  settings: Settings
) {
  if (!settings.files) return;

  const { resolvedPaths, placeholderPaths, transformPaths } = settings.files;
  const fileMapping = createFileMapping(
    resolvedPaths,
    placeholderPaths,
    transformPaths,
    settings.locales,
    settings.defaultLocale
  );

  const downloadedVersions = getDownloadedVersions(settings.configDirectory);

  const tempDir = path.join(settings.configDirectory, 'tmp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // Prepare concurrent tasks
  const diffTaskFunctions: Array<() => Promise<UserEditDiff | null>> = [];

  for (const uploadedFile of uploadedFiles) {
    for (const locale of settings.locales) {
      diffTaskFunctions.push(async () => {
        const resolvedLocale = gt.resolveAliasLocale(locale);
        const outputPath = fileMapping[locale]?.[uploadedFile.fileName] ?? null;
        if (!outputPath) return null;
        if (!fs.existsSync(outputPath)) return null;

        const lockKeyById = uploadedFile.fileId
          ? `${uploadedFile.fileId}:${resolvedLocale}`
          : null;
        const lockKeyByName = `${uploadedFile.fileName}:${resolvedLocale}`;
        const lockEntry =
          (lockKeyById && downloadedVersions.entries[lockKeyById]) ||
          downloadedVersions.entries[lockKeyByName];
        const versionId = lockEntry?.versionId;
        if (!versionId) return null;

        try {
          const serverContent = await gt.downloadTranslatedFile(
            { fileId: uploadedFile.fileId, locale: resolvedLocale, versionId },
            { timeout: 30_000 }
          );
          const safeName = Buffer.from(
            `${uploadedFile.fileName}:${resolvedLocale}`
          )
            .toString('base64')
            .replace(/=+$/g, '');
          const tempServerFile = path.join(tempDir, `${safeName}.server`);
          await fs.promises.writeFile(tempServerFile, serverContent, 'utf8');

          const diff = await getGitUnifiedDiff(tempServerFile, outputPath);
          try {
            await fs.promises.unlink(tempServerFile);
          } catch {}

          if (diff && diff.trim().length > 0) {
            const localContent = await fs.promises.readFile(outputPath, 'utf8');
            return {
              fileName: uploadedFile.fileName,
              locale: resolvedLocale,
              diff,
              versionId,
              fileId: uploadedFile.fileId,
              localContent,
            } as UserEditDiff;
          }
        } catch {}
        return null;
      });
    }
  }

  const maxConcurrentRequests = MAX_CONCURRENT_DIFF_REQUESTS;
  const collectedDiffs: UserEditDiff[] = [];
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < diffTaskFunctions.length) {
      const i = nextIndex++;
      try {
        const res = await diffTaskFunctions[i]!();
        if (res) collectedDiffs.push(res);
      } catch {
        // Ignore individual task failures
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(maxConcurrentRequests, diffTaskFunctions.length) },
      () => runWorker()
    )
  );

  if (collectedDiffs.length > 0) {
    // Batch by payload size
    const maxBatchBytes = MAX_DIFF_BATCH_BYTES;
    const batches: UserEditDiff[][] = [];
    let currentBatch: UserEditDiff[] = [];
    for (const d of collectedDiffs) {
      const tentative = [...currentBatch, d];
      const bytes = Buffer.byteLength(
        JSON.stringify({ projectId: settings.projectId, diffs: tentative }),
        'utf8'
      );
      if (bytes > maxBatchBytes && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [d];
      } else {
        currentBatch = tentative;
      }
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    for (const batch of batches) {
      await sendUserEditDiffs(batch, settings);
    }
  }
}
