import { logErrorAndExit } from '../../console/logging.js';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import { invalidConfigurationError } from '../../console/index.js';
import { aggregateFiles } from './aggregateFiles.js';
import { aggregateInlineTranslations } from '../../translation/stage.js';
import type { JsxChildren } from '@generaltranslation/format/types';
import type { FileToUpload } from 'generaltranslation/types';
import { hashStringSync } from '../../utils/hash.js';
import { TEMPLATE_FILE_NAME, TEMPLATE_FILE_ID } from '../../utils/constants.js';
import { isInlineLibrary } from '../../types/libraries.js';
import { shouldPublishGt } from '../../utils/resolvePublish.js';

export async function collectFiles(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries
): Promise<{
  files: FileToUpload[];
  reactComponents: number;
  publishMap: Map<string, boolean>;
}> {
  // Aggregate files
  const { files, publishMap } = await aggregateFiles(settings);

  // Parse for React components
  let reactComponents = 0;
  if (isInlineLibrary(library)) {
    const updates = await aggregateInlineTranslations(
      options,
      settings,
      library
    );
    if (updates.length > 0) {
      if (!settings.publish && !settings.files?.placeholderPaths.gt) {
        logErrorAndExit(invalidConfigurationError);
      }
      // Convert updates to a file object
      const fileData: Record<string, JsxChildren> = {};
      const fileMetadata: Record<string, unknown> = {};
      // Convert updates to the proper data format
      for (const update of updates) {
        const { source, metadata, dataFormat } = update;
        metadata.dataFormat = dataFormat; // add the data format to the metadata
        // Materialize effective requiresReview into component metadata:
        // the explicit prop wins; otherwise inherit the top-level config
        // default. Only the explicit prop is part of component hashes — the
        // effective flag here is what the platform filters serving on.
        // Uploaded metadata uses the platform's canonical snake_case key;
        // camelCase requiresReview stays client-internal (props + hashing).
        // An explicit prop (true or false) is always materialized; without
        // one, only a true config default is — a false/absent default means
        // the key is omitted entirely, matching pre-feature metadata.
        const effectiveRequiresReview =
          metadata.requiresReview !== undefined
            ? metadata.requiresReview
            : settings.requiresReview
              ? true
              : undefined;
        delete metadata.requiresReview;
        if (effectiveRequiresReview !== undefined) {
          metadata.requires_review = effectiveRequiresReview;
        }
        const { hash } = metadata;
        if (hash) {
          fileData[hash] = source;
          fileMetadata[hash] = metadata;
        }
      }
      reactComponents = updates.length;
      // Version identity includes which components effectively require
      // review, so config-only review changes produce a new source version.
      // When nothing requires review this reduces to the legacy key-only
      // hash, keeping existing projects' version IDs stable.
      const sortedKeys = Object.keys(fileData).sort();
      const reviewRequiredKeys = sortedKeys.filter(
        (key) =>
          (fileMetadata[key] as { requires_review?: boolean })
            ?.requires_review === true
      );
      const versionId = reviewRequiredKeys.length
        ? hashStringSync(
            JSON.stringify(sortedKeys) +
              '\u0000requiresReview\u0000' +
              JSON.stringify(reviewRequiredKeys)
          )
        : hashStringSync(JSON.stringify(sortedKeys));
      files.push({
        fileName: TEMPLATE_FILE_NAME,
        content: JSON.stringify(fileData),
        fileFormat: 'GTJSON',
        formatMetadata: fileMetadata,
        fileId: TEMPLATE_FILE_ID,
        versionId,
        locale: settings.defaultLocale,
      } satisfies FileToUpload);
      // Only add GT JSON to publishMap if there's an explicit publish config
      const gtPublishValue = shouldPublishGt(settings);
      if (gtPublishValue !== undefined) {
        publishMap.set(TEMPLATE_FILE_ID, gtPublishValue);
      }
    }
  }
  return { files, reactComponents, publishMap };
}
