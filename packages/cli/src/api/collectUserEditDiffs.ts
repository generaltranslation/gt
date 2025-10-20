import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDownloadedVersions } from '../fs/config/downloadedVersions.js';
import { Settings } from '../types/index.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { getGitUnifiedDiff } from '../utils/gitDiff.js';
import { sendUserEditDiffs } from './sendUserEdits.js';
import type { UserEditDiff } from './sendUserEdits.js';
import { gt } from '../utils/gt.js';

const MAX_DIFF_BATCH_BYTES = 1_500_000;
const MAX_DOWNLOAD_BATCH = 100;

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

  // Build candidates for diff and batch-fetch server contents
  type DiffCandidate = {
    fileName: string;
    fileId: string;
    versionId: string;
    locale: string; // resolved
    outputPath: string;
  };
  const candidates: DiffCandidate[] = [];

  for (const uploadedFile of uploadedFiles) {
    for (const locale of settings.locales) {
      const resolvedLocale = gt.resolveAliasLocale(locale);
      const outputPath = fileMapping[locale]?.[uploadedFile.fileName] ?? null;
      if (!outputPath) continue;
      if (!fs.existsSync(outputPath)) continue;

      const lockKeyById = uploadedFile.fileId
        ? `${uploadedFile.fileId}:${resolvedLocale}`
        : null;
      const lockKeyByName = `${uploadedFile.fileName}:${resolvedLocale}`;
      const lockEntry =
        (lockKeyById && downloadedVersions.entries[lockKeyById]) ||
        downloadedVersions.entries[lockKeyByName];
      const versionId = lockEntry?.versionId;
      if (!versionId) continue;

      candidates.push({
        fileName: uploadedFile.fileName,
        fileId: uploadedFile.fileId,
        versionId,
        locale: resolvedLocale,
        outputPath,
      });
    }
  }

  const collectedDiffs: UserEditDiff[] = [];

  if (candidates.length > 0) {
    const fileQueryData = candidates.map((c) => ({
      versionId: c.versionId,
      fileName: c.fileName,
      locale: c.locale,
    }));

    // Single batched check to obtain translation IDs
    const checkResponse = await gt.checkFileTranslations(fileQueryData);
    const translations = (checkResponse?.translations || []).filter(
      (t: any) => t && t.isReady && t.id && t.fileName && t.locale
    );

    // Map fileName:resolvedLocale -> translationId
    const idByKey = new Map<string, string>();
    for (const t of translations) {
      const resolved = gt.resolveAliasLocale(t.locale);
      idByKey.set(`${t.fileName}:${resolved}`, t.id);
    }

    // Collect translation IDs in batches and download contents
    const ids: string[] = [];
    for (const c of candidates) {
      const id = idByKey.get(`${c.fileName}:${c.locale}`);
      if (id) ids.push(id);
    }

    // Helper to chunk array
    function chunk<T>(arr: T[], size: number): T[][] {
      const res: T[][] = [];
      for (let i = 0; i < arr.length; i += size)
        res.push(arr.slice(i, i + size));
      return res;
    }

    const serverContentByKey = new Map<string, string>();
    for (const idChunk of chunk(ids, MAX_DOWNLOAD_BATCH)) {
      try {
        const resp = await gt.downloadFileBatch(idChunk);
        const files = resp?.files || [];
        for (const f of files) {
          // Find corresponding candidate key via idByKey reverse lookup
          for (const [key, id] of idByKey.entries()) {
            if (id === f.id) {
              serverContentByKey.set(key, f.data);
              break;
            }
          }
        }
      } catch {
        // Ignore chunk failures; proceed with what we have
      }
    }

    // Compute diffs using fetched server contents
    for (const c of candidates) {
      const key = `${c.fileName}:${c.locale}`;
      const serverContent = serverContentByKey.get(key);
      if (!serverContent) continue;

      try {
        const safeName = Buffer.from(`${c.fileName}:${c.locale}`)
          .toString('base64')
          .replace(/=+$/g, '');
        const tempServerFile = path.join(tempDir, `${safeName}.server`);
        await fs.promises.writeFile(tempServerFile, serverContent, 'utf8');

        const diff = await getGitUnifiedDiff(tempServerFile, c.outputPath);
        try {
          await fs.promises.unlink(tempServerFile);
        } catch {}

        if (diff && diff.trim().length > 0) {
          const localContent = await fs.promises.readFile(c.outputPath, 'utf8');
          collectedDiffs.push({
            fileName: c.fileName,
            locale: c.locale,
            diff,
            versionId: c.versionId,
            fileId: c.fileId,
            localContent,
          } as UserEditDiff);
        }
      } catch {
        // Ignore failures for this file
      }
    }
  }

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
