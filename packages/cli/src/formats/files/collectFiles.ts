import { logErrorAndExit } from '../../console/logging.js';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import { invalidConfigurationError } from '../../console/index.js';
import { aggregateFiles } from '../../formats/files/translate.js';
import { aggregateReactTranslations } from '../../translation/stage.js';
import type { FileToUpload, JsxChildren } from 'generaltranslation/types';
import { hashStringSync } from '../../utils/hash.js';
import { TEMPLATE_FILE_NAME, TEMPLATE_FILE_ID } from '../../utils/constants.js';

export async function collectFiles(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries
): Promise<{ files: FileToUpload[]; reactComponents: number }> {
  // Aggregate files
  const allFiles = await aggregateFiles(settings);

  // Parse for React components
  let reactComponents = 0;
  if (library === 'gt-react' || library === 'gt-next') {
    const updates = await aggregateReactTranslations(
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
      const fileMetadata: Record<string, any> = {};
      // Convert updates to the proper data format
      for (const update of updates) {
        const { source, metadata, dataFormat } = update;
        metadata.dataFormat = dataFormat; // add the data format to the metadata
        const { hash, id } = metadata;
        if (id) {
          fileData[id] = source;
          fileMetadata[id] = metadata;
        } else {
          fileData[hash] = source;
          fileMetadata[hash] = metadata;
        }
      }
      reactComponents = updates.length;
      allFiles.push({
        fileName: TEMPLATE_FILE_NAME,
        content: JSON.stringify(fileData),
        fileFormat: 'GTJSON',
        formatMetadata: fileMetadata,
        fileId: TEMPLATE_FILE_ID,
        versionId: hashStringSync(JSON.stringify(Object.keys(fileData).sort())),
        locale: settings.defaultLocale,
      } satisfies FileToUpload);
    }
  }
  return { files: allFiles, reactComponents };
}
