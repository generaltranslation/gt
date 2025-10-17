import { gt } from '../utils/gt.js';
import { Settings } from '../types/index.js';
import { aggregateFiles } from '../formats/files/translate.js';
import { collectAndSendUserEditDiffs } from './collectUserEditDiffs.js';
import type { FileUpload } from './uploadFiles.js';

type SourceUpload = { source: FileUpload };

/**
 * Uploads current source files to obtain file references, then collects and sends
 * diffs for all locales based on last downloaded versions. Does not enqueue translations.
 */
export async function saveLocalEdits(settings: Settings): Promise<void> {
  if (!settings.files) return;

  // Collect current files from config
  const files = await aggregateFiles(settings);
  if (!files.length) return;

  const uploads: SourceUpload[] = files.map(({ content, fileName, fileFormat, dataFormat }) => ({
    source: {
      content,
      fileName,
      fileFormat,
      dataFormat,
      locale: settings.defaultLocale,
    },
  }));

  // Upload sources only to get file references, then compute diffs
  const upload = await gt.uploadSourceFiles(uploads, {
    sourceLocale: settings.defaultLocale,
    modelProvider: settings.modelProvider,
  });

  await collectAndSendUserEditDiffs(upload.uploadedFiles as any, settings);
}
