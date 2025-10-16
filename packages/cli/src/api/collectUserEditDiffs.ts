import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDownloadedVersions } from '../fs/config/downloadedVersions.js';
import { Settings } from '../types/index.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { getGitUnifiedDiff } from '../utils/gitDiff.js';
import { sendUserEditDiffs } from './sendUserEdits.js';
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
 * Must run BEFORE enqueueing new translations so rules are available to the generator.
 */
export async function collectAndSendUserEditDiffs(
  uploadedFiles: UploadedFileRef[],
  settings: Settings
) {
  if (!settings.files) return;

  const { resolvedPaths, placeholderPaths, transformPaths } = settings.files;
  const mapping = createFileMapping(
    resolvedPaths,
    placeholderPaths,
    transformPaths,
    settings.locales,
    settings.defaultLocale
  );

  const downloaded = getDownloadedVersions(settings.configDirectory);

  const tmpDir = path.join(settings.configDirectory, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  let sentCount = 0;

  for (const f of uploadedFiles) {
    for (const locale of settings.locales) {
      const resolvedLocale = gt.resolveAliasLocale(locale);
      const outputPath = mapping[locale]?.[f.fileName] ?? null;
      // Skip if no mapped output path or file doesn't exist locally
      if (!outputPath) continue;
      if (!fs.existsSync(outputPath)) continue;

      // Look up downloaded lock by fileId first (preferred), then by fileName
      const keyById = f.fileId ? `${f.fileId}:${resolvedLocale}` : null;
      const keyByName = `${f.fileName}:${resolvedLocale}`;
      const lock =
        (keyById && downloaded.entries[keyById]) ||
        downloaded.entries[keyByName];
      const versionId = lock?.versionId;
      if (!versionId) continue;

      try {
        // Fetch the exact server translation previously downloaded
        const serverContent = await gt.downloadTranslatedFile(
          { fileId: f.fileId, locale: resolvedLocale, versionId },
          { timeout: 30_000 }
        );
        // Write to a temp file and compute diff against local file
        const safeName = Buffer.from(`${f.fileName}:${resolvedLocale}`)
          .toString('base64')
          .replace(/=+$/g, '');
        const tmpFile = path.join(tmpDir, `${safeName}.server`);
        await fs.promises.writeFile(tmpFile, serverContent, 'utf8');

        const diff = await getGitUnifiedDiff(tmpFile, outputPath);
        if (diff && diff.trim().length > 0) {
          await sendUserEditDiffs(
            [
              {
                fileName: f.fileName,
                locale: resolvedLocale,
                diff,
                versionId,
                fileId: f.fileId,
              },
            ],
            settings
          );
          sentCount++;
        }

        // cleanup best-effort
        try {
          await fs.promises.unlink(tmpFile);
        } catch {}
      } catch (e) {
        // non-fatal; skip this file/locale
      }
    }
  }

}
