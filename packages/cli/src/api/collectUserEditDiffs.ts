import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  readLockfile,
  EntryMap,
  DownloadedTranslation,
} from '../fs/config/downloadedVersions.js';
import { Settings } from '../types/index.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { getGitUnifiedDiff } from '../utils/gitDiff.js';
import { gt } from '../utils/gt.js';
import {
  FileReference,
  isBinaryFileFormat,
  SubmitUserEditDiff,
  type FileFormat,
} from 'generaltranslation/types';
import { readFileContent } from '../fs/fileContent.js';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { hashStringSync } from '../utils/hash.js';
import { extractJson } from '../formats/json/extractJson.js';
import { extractYaml } from '../formats/yaml/extractYaml.js';
import { logger } from '../console/logger.js';
import { recordWarning } from '../state/translateWarnings.js';
import { getRelative } from '../fs/findFilepath.js';

type LatestDownloadedVersion = {
  versionId: string;
  entry: DownloadedTranslation;
};

/**
 * The bytes a file's pipeline content stands for: binary formats carry base64,
 * everything else carries UTF-8 text. Applied to both sides of the comparison
 * so they are measured the same way.
 */
const contentBytes = (content: string, fileFormat: FileFormat): Buffer =>
  isBinaryFileFormat(fileFormat)
    ? Buffer.from(content, 'base64')
    : Buffer.from(content, 'utf8');

const findLatestDownloadedVersion = (
  entryMap: EntryMap,
  fileId: string,
  locale: string
): LatestDownloadedVersion | null => {
  const entry = entryMap.get(fileId);
  if (!entry) return null;

  const translation = entry.translations[locale];
  if (!translation) return null;

  return { versionId: entry.versionId, entry: translation };
};

/**
 * Collects local user edits by diffing the latest downloaded server translation version
 * against the current local translation file, and submits the diffs upstream.
 *
 * Must run before enqueueing new translations so rules are available to the generator.
 */
export async function collectAndSendUserEditDiffs(
  files: FileReference[],
  settings: Settings
): Promise<boolean> {
  if (!settings.files) return false;

  const { resolvedPaths, placeholderPaths, transformPaths, transformFormats } =
    settings.files;
  const fileMapping = createFileMapping(
    resolvedPaths,
    placeholderPaths,
    transformPaths,
    transformFormats,
    settings.locales,
    settings.defaultLocale
  );

  const { entryMap } = readLockfile(settings);

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
    fileFormat: FileFormat;
  };
  const candidates: DiffCandidate[] = [];

  for (const uploadedFile of files) {
    for (const locale of settings.locales) {
      const outputPath = fileMapping[locale]?.[uploadedFile.fileName] ?? null;
      if (!outputPath) continue;
      if (!fs.existsSync(outputPath)) continue;

      const latestDownloaded = findLatestDownloadedVersion(
        entryMap,
        uploadedFile.fileId,
        locale
      );

      if (!latestDownloaded) continue;
      const downloadedVersion = latestDownloaded.entry;

      // Skip if local file matches the last postprocessed content hash
      if (downloadedVersion.postProcessHash) {
        try {
          // Hashed from the same pipeline content the hash was recorded from,
          // so a file stored in UTF-16 still matches when it is untouched.
          const localContent = readFileContent(
            outputPath,
            uploadedFile.fileFormat
          );
          const localHash = hashStringSync(localContent);
          if (localHash === downloadedVersion.postProcessHash) {
            continue;
          }
        } catch {
          // If hash check fails, fall through to diff
        }
      }

      candidates.push({
        branchId: uploadedFile.branchId,
        fileName: uploadedFile.fileName,
        fileId: uploadedFile.fileId,
        versionId: latestDownloaded.versionId,
        locale: locale,
        outputPath,
        fileFormat: uploadedFile.fileFormat,
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

    const serverContentByKey = new Map<string, Buffer>();
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
          contentBytes(f.data, f.fileFormat)
        );
      }
    } catch {
      // Ignore chunk failures; proceed with what we have
    }

    // Compute diffs using fetched server contents
    for (const c of candidates) {
      const key = `${c.branchId}:${c.fileId}:${c.versionId}:${c.locale}`;
      const serverBytes = serverContentByKey.get(key);
      // Absent means the batch did not return this file, so there is no
      // baseline. An empty payload is a baseline of nothing, which the user
      // may well have written against.
      if (!serverBytes) continue;

      try {
        // Read the local file the same way the pipeline read it originally, so
        // a file stored differently on disk than the server's copy is compared
        // as content rather than as bytes. Otherwise every such file would read
        // as edited on every run.
        const localBytes = contentBytes(
          readFileContent(c.outputPath, c.fileFormat),
          c.fileFormat
        );

        // Nothing was edited, so there is no diff to compute or report.
        if (localBytes.equals(serverBytes)) continue;

        // A unified diff and localContent are both UTF-8 text, and every text
        // format's content is UTF-8 by the time it reaches here. Only a binary
        // format's bytes — a Lottie zip — have no text form at all. Say so:
        // the edit is real and will be lost on the next download.
        if (isBinaryFileFormat(c.fileFormat)) {
          const relativePath = getRelative(c.outputPath);
          const reason =
            'Edited file is a binary format, so its changes cannot be submitted';
          logger.warn(`Skipping local edits to ${relativePath}: ${reason}`);
          recordWarning('skipped_file', relativePath, reason);
          continue;
        }

        const safeName = Buffer.from(
          `${c.branchId}:${c.fileId}:${c.versionId}:${c.locale}`
        )
          .toString('base64')
          .replace(/=+$/g, '');
        const tempServerFile = path.join(tempDir, `${safeName}.server`);
        await fs.promises.writeFile(tempServerFile, serverBytes);

        // git diff reads bytes, so both sides are written from the content
        // they represent rather than diffing the file as it sits on disk.
        const tempLocalFile = path.join(tempDir, `${safeName}.local`);
        await fs.promises.writeFile(tempLocalFile, localBytes);

        const diff = await getGitUnifiedDiff(tempServerFile, tempLocalFile);
        for (const tempFile of [tempServerFile, tempLocalFile]) {
          try {
            await fs.promises.unlink(tempFile);
          } catch {
            // Ignore cleanup errors for temporary comparison files.
          }
        }

        if (diff && diff.trim().length > 0) {
          const rawLocalContent = localBytes.toString('utf8');

          // For JSON files with jsonSchema config, extract to composite format
          let localContent = rawLocalContent;
          if (
            c.fileName.endsWith('.json') &&
            settings.options?.jsonSchema &&
            c.locale !== settings.defaultLocale
          ) {
            const extractedContent = extractJson(
              rawLocalContent,
              c.fileName,
              settings.options,
              c.locale,
              settings.defaultLocale
            );
            if (extractedContent) {
              localContent = extractedContent;
            }
          } else if (
            (c.fileName.endsWith('.yaml') || c.fileName.endsWith('.yml')) &&
            settings.options?.yamlSchema &&
            c.locale !== settings.defaultLocale
          ) {
            const extractedContent = extractYaml(
              rawLocalContent,
              c.fileName,
              settings.options
            );
            if (extractedContent) {
              localContent = extractedContent;
            }
          }

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

  return collectedDiffs.length > 0;
}
