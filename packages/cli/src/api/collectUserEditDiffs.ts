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
} from 'generaltranslation/types';
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

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

/** Whether these bytes round trip as UTF-8 text. */
const isUtf8Text = (bytes: Buffer): boolean => {
  try {
    utf8Decoder.decode(bytes);
    return true;
  } catch {
    return false;
  }
};

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
          const localContent = await fs.promises.readFile(outputPath, 'utf8');
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
          // Formats in BINARY_FILE_FORMATS are still base64 at this point;
          // everything else has already been decoded to a UTF-8 string.
          isBinaryFileFormat(f.fileFormat)
            ? Buffer.from(f.data, 'base64')
            : Buffer.from(f.data, 'utf8')
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
        const localBytes = await fs.promises.readFile(c.outputPath);

        // Nothing was edited, so there is no diff to compute or report.
        if (localBytes.equals(serverBytes)) continue;

        // A unified diff and localContent are both UTF-8 text. Content that is
        // not valid UTF-8 — a Lottie zip, a UTF-16 .strings file — has no
        // faithful text form here, and sending mojibake upstream is worse than
        // sending nothing. Say so: the edit is real and will be lost on the
        // next download.
        if (!isUtf8Text(serverBytes) || !isUtf8Text(localBytes)) {
          const relativePath = getRelative(c.outputPath);
          const reason =
            'Edited file is not valid UTF-8, so its changes cannot be submitted';
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

        const diff = await getGitUnifiedDiff(tempServerFile, c.outputPath);
        try {
          await fs.promises.unlink(tempServerFile);
        } catch {
          // Ignore cleanup errors for temporary comparison files.
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
