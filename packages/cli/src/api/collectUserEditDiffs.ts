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
import { createClients } from '../utils/api.js';
import { noProjectIdError } from '../console/index.js';
import { FileReference, isBinaryFileFormat } from 'generaltranslation/types';
import type {
  FileFormat,
  OverwriteTranslationsData,
} from '@generaltranslation/api';
import { readFileContent } from '../fs/fileContent.js';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { hashStringSync } from '../utils/hash.js';
import { extractJson } from '../formats/json/extractJson.js';
import {
  emptyLocaleContent,
  localeContent,
} from '../formats/files/localeContent.js';
import { extractYaml } from '../formats/yaml/extractYaml.js';
import { logger } from '../console/logger.js';
import { recordWarning } from '../state/translateWarnings.js';
import { getRelative } from '../fs/findFilepath.js';
import {
  getFileTranslationKey,
  queryCompletedTranslationKeys,
} from '../workflows/utils/queryCompletedTranslations.js';

type UserEditDiff = OverwriteTranslationsData['body']['diffs'][number] & {
  fileName: string;
};

export type UserEditDiffResults = {
  saved: UserEditDiff[];
  failed: UserEditDiff[];
};

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
 * A file that holds every locale is compared one locale slice at a time, so an
 * edit to one locale is submitted under that locale alone.
 *
 * Must run before enqueueing new translations so rules are available to the generator.
 * Returns the edits the API saved and the ones it failed to save; each failure is logged.
 */
export async function collectAndSendUserEditDiffs(
  files: FileReference[],
  settings: Settings
): Promise<UserEditDiffResults> {
  if (!settings.files) return { saved: [], failed: [] };
  const { project } = createClients(settings);
  if (!project) throw new Error(noProjectIdError);

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

      // Skip if the locale's local content matches the last recorded hash
      if (downloadedVersion.postProcessHash) {
        try {
          // Hashed from the locale's share of the pipeline content, which is
          // what was recorded, so an untouched locale matches regardless of
          // the file's encoding or of edits to its other locales.
          const localFile = readFileContent(
            outputPath,
            uploadedFile.fileFormat
          );
          const localHash = hashStringSync(
            localeContent(localFile, uploadedFile.fileFormat, locale) ??
              emptyLocaleContent(localFile, uploadedFile.fileFormat)
          );
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

  const collectedDiffs: UserEditDiff[] = [];

  if (candidates.length > 0) {
    const completedKeys = await queryCompletedTranslationKeys(
      project,
      candidates
    );
    const translatedFiles = candidates.filter((c) =>
      completedKeys.has(getFileTranslationKey(c))
    );

    // The server's copy of each candidate, keyed like the candidates
    type ServerPayload = { data: string; fileFormat: FileFormat };
    const serverPayloadByKey = new Map<string, ServerPayload>();
    try {
      const { results: contentResults } =
        await project.queryFilesContent(translatedFiles);
      contentResults.forEach((result, index) => {
        if (
          result.status !== 'ready' ||
          typeof result.data !== 'string' ||
          !result.fileFormat
        ) {
          return;
        }
        const f = translatedFiles[index];
        serverPayloadByKey.set(
          `${f.branchId}:${f.fileId}:${f.versionId}:${f.locale}`,
          { data: result.data, fileFormat: result.fileFormat }
        );
      });
    } catch {
      // Ignore chunk failures; proceed with what we have
    }

    // Compute diffs using fetched server contents
    for (const c of candidates) {
      const key = `${c.branchId}:${c.fileId}:${c.versionId}:${c.locale}`;
      const payload = serverPayloadByKey.get(key);
      // Absent means the batch did not return this file, so there is no
      // baseline. An empty payload is a baseline of nothing, which the user
      // may well have written against.
      if (!payload) continue;

      // The locale's share of the payload, read on its own so a payload the
      // server sent malformed costs only its own locale. A catalog payload
      // that carries nothing for the locale is that file's empty payload, and
      // a baseline of nothing like any other.
      let serverContent: string;
      try {
        serverContent =
          localeContent(payload.data, payload.fileFormat, c.locale) ??
          emptyLocaleContent(payload.data, payload.fileFormat);
      } catch (error) {
        const relativePath = getRelative(c.outputPath);
        const reason = `The downloaded ${c.locale} translation could not be read (${
          error instanceof Error ? error.message : String(error)
        })`;
        logger.warn(`Skipping local edits to ${relativePath}: ${reason}`);
        recordWarning('skipped_file', relativePath, reason);
        continue;
      }
      const serverBytes = contentBytes(serverContent, payload.fileFormat);

      try {
        // Read the local file the same way the pipeline read it originally, so
        // a file stored differently on disk than the server's copy is compared
        // as content rather than as bytes. Otherwise every such file would read
        // as edited on every run. Then cut to this locale's share, so a file
        // that holds every locale is compared slice to slice.
        const local = localeContent(
          readFileContent(c.outputPath, c.fileFormat),
          c.fileFormat,
          c.locale
        );
        // A catalog that no longer carries the locale has nothing to submit
        if (local === undefined) continue;
        const localBytes = contentBytes(local, c.fileFormat);

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

          // The API rejects empty content, so an emptied file cannot be saved
          if (localContent.length === 0) {
            const relativePath = getRelative(c.outputPath);
            const reason =
              'Edited file is empty, so its changes cannot be submitted';
            logger.warn(`Skipping local edits to ${relativePath}: ${reason}`);
            recordWarning('skipped_file', relativePath, reason);
            continue;
          }

          collectedDiffs.push({
            fileName: c.fileName,
            locale: c.locale,
            diff,
            branchId: c.branchId,
            versionId: c.versionId,
            fileId: c.fileId,
            localContent,
          } satisfies UserEditDiff);
        }
      } catch {
        // Ignore failures for this file
      }
    }
  }

  const saveResults: UserEditDiffResults = { saved: [], failed: [] };
  if (collectedDiffs.length === 0) return saveResults;

  // Results follow request order; a failed edit is reported and skipped.
  const { results } = await project.overwriteTranslations(collectedDiffs);
  results.forEach((result, index) => {
    const edit = collectedDiffs[index];
    if (result.status !== 'failed') {
      saveResults.saved.push(edit);
      return;
    }
    const reason = `Locale ${edit.locale}: ${result.error ?? 'Unknown error'}`;
    logger.warn(`Failed to save local edits to ${edit.fileName}: ${reason}`);
    recordWarning('failed_edit_save', edit.fileName, reason);
    saveResults.failed.push(edit);
  });

  return saveResults;
}
