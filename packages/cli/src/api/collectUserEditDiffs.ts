import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDownloadedVersions } from '../fs/config/downloadedVersions.js';
import { Settings } from '../types/index.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { getGitUnifiedDiff } from '../utils/gitDiff.js';
import { sendUserEditDiffs } from './sendUserEdits.js';
import type { UserEditDiff } from './sendUserEdits.js';
import { gt } from '../utils/gt.js';

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

  const diffTaskResults = await Promise.allSettled(
    diffTaskFunctions.map((fn) => fn())
  );
  const collectedDiffs: UserEditDiff[] = diffTaskResults
    .filter(
      (r): r is PromiseFulfilledResult<UserEditDiff | null> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value)
    .filter((v): v is UserEditDiff => Boolean(v));

  if (collectedDiffs.length > 0) {
    await sendUserEditDiffs(collectedDiffs, settings);
  }
}
