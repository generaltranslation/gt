import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDownloadedVersions } from '../fs/config/downloadedVersions.js';
import { Settings } from '../types/index.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { getGitUnifiedDiff } from '../utils/gitDiff.js';
import { gt } from '../utils/gt.js';
import { FileReference, SubmitUserEditDiff } from 'generaltranslation/types';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

/**
 * Collects local user edits by diffing the latest downloaded server translation version
 * against the current local translation file, and submits the diffs upstream.
 *
 * Must run before enqueueing new translations so rules are available to the generator.
 */
export async function collectAndSendUserEditDiffs(
  uploadedFiles: FileReference[],
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

  const tempDir = path.join(os.tmpdir(), randomUUID());
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // Build candidates for diff and batch-fetch server contents
  type DiffCandidate = {
    branchId: string;
    fileName: string;
    fileId: string;
    versionId: string;
    locale: string; // resolved
    outputPath: string;
  };
  const candidates: DiffCandidate[] = [];

  for (const uploadedFile of uploadedFiles) {
    for (const locale of settings.locales) {
      const outputPath = fileMapping[locale]?.[uploadedFile.fileName] ?? null;
      if (!outputPath) continue;
      if (!fs.existsSync(outputPath)) continue;

      const downloadedVersion =
        downloadedVersions.entries?.[uploadedFile.branchId]?.[
          uploadedFile.fileId
        ]?.[uploadedFile.versionId]?.[locale];

      if (!downloadedVersion) continue;

      candidates.push({
        branchId: uploadedFile.branchId,
        fileName: uploadedFile.fileName,
        fileId: uploadedFile.fileId,
        versionId: uploadedFile.versionId,
        locale: locale,
        outputPath,
      });
    }
  }

  const collectedDiffs: SubmitUserEditDiff[] = [];

  if (candidates.length > 0) {
    const fileQueryData = candidates.map((c) => ({
      versionId: c.versionId,
      locale: c.locale,
      fileId: c.fileId,
      branchId: c.branchId,
    }));

    // Single batched check to obtain translation IDs
    const checkResponse = await gt.queryFileData({
      translatedFiles: fileQueryData,
    });
    const translatedFiles =
      checkResponse.translatedFiles?.filter((t) => t.completedAt) ?? [];

    const serverContentByKey = new Map<string, string>();
    try {
      const resp = await gt.downloadFileBatch(
        translatedFiles.map((file) => ({
          branchId: file.branchId,
          fileId: file.fileId,
          locale: file.locale,
          versionId: file.versionId,
        }))
      );
      const files = resp?.files || [];
      for (const f of files) {
        serverContentByKey.set(
          `${f.branchId}:${f.fileId}:${f.versionId}:${f.locale}`,
          f.data
        );
      }
    } catch {
      // Ignore chunk failures; proceed with what we have
    }

    // Compute diffs using fetched server contents
    for (const c of candidates) {
      const key = `${c.branchId}:${c.fileId}:${c.versionId}:${c.locale}`;
      const serverContent = serverContentByKey.get(key);
      if (!serverContent) continue;

      try {
        const safeName = Buffer.from(
          `${c.branchId}:${c.fileId}:${c.versionId}:${c.locale}`
        )
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
            branchId: c.branchId,
            versionId: c.versionId,
            fileId: c.fileId,
            localContent,
          } satisfies SubmitUserEditDiff);
        }
      } catch {
        // Ignore failures for this file
      }
    }
  }

  if (collectedDiffs.length > 0) {
    await gt.submitUserEditDiffs({ diffs: collectedDiffs });
  }
}
