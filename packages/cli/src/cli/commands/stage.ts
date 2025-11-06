import { logErrorAndExit, logSuccess } from '../../console/logging.js';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import {
  noLocalesError,
  noDefaultLocaleError,
  noApiKeyError,
  noProjectIdError,
  devApiKeyError,
  invalidConfigurationError,
} from '../../console/index.js';
import { aggregateFiles } from '../../formats/files/translate.js';
import { aggregateReactTranslations } from '../../translation/stage.js';
import { sendFiles, SendFilesResult } from '../../api/sendFiles.js';
import { updateVersions } from '../../fs/config/updateVersions.js';
import { JsxChildren } from 'generaltranslation/types';
import updateConfig from '../../fs/config/updateConfig.js';
import { hashStringSync } from '../../utils/hash.js';

export const TEMPLATE_FILE_NAME = '__INTERNAL_GT_TEMPLATE_NAME__';
export const TEMPLATE_FILE_ID = hashStringSync(TEMPLATE_FILE_NAME);

export async function handleStage(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries,
  stage: boolean
): Promise<SendFilesResult | undefined> {
  // Validate required settings are present if not in dry run
  if (!options.dryRun) {
    if (!settings.locales) {
      logErrorAndExit(noLocalesError);
    }
    if (!settings.defaultLocale) {
      logErrorAndExit(noDefaultLocaleError);
    }
    if (!settings.apiKey) {
      logErrorAndExit(noApiKeyError);
    }
    if (settings.apiKey.startsWith('gtx-dev-')) {
      logErrorAndExit(devApiKeyError);
    }
    if (!settings.projectId) {
      logErrorAndExit(noProjectIdError);
    }
  }

  // Aggregate files
  const allFiles = await aggregateFiles(settings);

  // Parse for React components
  let reactComponents = 0;
  if (
    library === 'gt-react' ||
    library === 'gt-next' ||
    library === 'gt-react-native'
  ) {
    const updates = await aggregateReactTranslations(
      options,
      settings,
      library
    );
    if (updates.length > 0) {
      if (
        !options.dryRun &&
        !settings.publish &&
        !settings.files?.placeholderPaths.gt
      ) {
        logErrorAndExit(invalidConfigurationError);
      }
      reactComponents = updates.length;
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
      allFiles.push({
        fileName: TEMPLATE_FILE_NAME,
        content: JSON.stringify(fileData),
        fileFormat: 'GTJSON',
        formatMetadata: fileMetadata,
      });
    }
  }

  // Dry run
  if (options.dryRun) {
    const fileNames = allFiles
      .map((file) => {
        if (file.fileName === TEMPLATE_FILE_NAME) {
          return `- <React Elements> (${reactComponents})`;
        }
        return `- ${file.fileName}`;
      })
      .join('\n');
    logSuccess(
      `Dry run: No files were sent to General Translation. Found files:\n${fileNames}`
    );
    return undefined;
  }

  // Send translations to General Translation
  let filesTranslationResponse: SendFilesResult | undefined;
  if (allFiles.length > 0) {
    filesTranslationResponse = await sendFiles(allFiles, options, settings);
    if (stage) {
      await updateVersions({
        configDirectory: settings.configDirectory,
        versionData: filesTranslationResponse.data,
      });
    }
    const templateData = filesTranslationResponse.data[TEMPLATE_FILE_ID];
    if (templateData?.versionId) {
      await updateConfig({
        configFilepath: settings.config,
        _versionId: templateData.versionId,
      });
    }
  }
  return filesTranslationResponse;
}
