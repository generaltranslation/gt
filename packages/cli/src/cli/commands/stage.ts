import { logErrorAndExit, logSuccess } from '../../console/logging.js';
import {
  Settings,
  SupportedLibraries,
  TranslateFlags,
  Updates,
} from '../../types/index.js';
import {
  noLocalesError,
  noDefaultLocaleError,
  noApiKeyError,
  noProjectIdError,
  devApiKeyError,
} from '../../console/index.js';
import { aggregateFiles } from '../../formats/files/translate.js';
import { aggregateReactTranslations } from '../../translation/stage.js';
import { sendUpdates, SendUpdatesResult } from '../../api/sendUpdates.js';
import { sendFiles, SendFilesResult } from '../../api/sendFiles.js';
import updateConfig from '../../fs/config/updateConfig.js';
import { updateVersions } from '../../fs/config/updateVersions.js';

export async function handleStage(
  options: TranslateFlags,
  settings: Settings,
  library: SupportedLibraries,
  stage: boolean
): Promise<{
  reactTranslationResponse: SendUpdatesResult | undefined;
  filesTranslationResponse: SendFilesResult | undefined;
}> {
  // Validate required settings are present if not in dry run
  if (!options.dryRun) {
    if (!options.locales) {
      logErrorAndExit(noLocalesError);
    }
    if (!options.defaultLocale) {
      logErrorAndExit(noDefaultLocaleError);
    }
    if (!options.apiKey) {
      logErrorAndExit(noApiKeyError);
    }
    if (options.apiKey.startsWith('gtx-dev-')) {
      logErrorAndExit(devApiKeyError);
    }
    if (!options.projectId) {
      logErrorAndExit(noProjectIdError);
    }

    // validate timeout
    const timeout = parseInt(options.timeout);
    if (isNaN(timeout) || timeout < 0) {
      logErrorAndExit(
        `Invalid timeout: ${options.timeout}. Must be a positive integer.`
      );
    }
  }

  // Aggregate files
  const allFiles = await aggregateFiles(settings);

  // Parse for React components
  let updates: Updates = [];
  if (library === 'gt-react' || library === 'gt-next') {
    updates = await aggregateReactTranslations(options, settings, library);
  }

  // Dry run
  if (options.dryRun) {
    const fileNames = allFiles.map((file) => `- ${file.fileName}`).join('\n');
    logSuccess(
      `Dry run: No files were sent to General Translation. Found files:\n${fileNames}`
    );
    logSuccess(
      `Found ${updates.length} React translations to send to General Translation.`
    );
    return {
      reactTranslationResponse: undefined,
      filesTranslationResponse: undefined,
    };
  }

  // Send translations to General Translation
  let reactTranslationResponse: SendUpdatesResult | undefined;
  let filesTranslationResponse: SendFilesResult | undefined;
  if (updates.length > 0) {
    reactTranslationResponse = await sendUpdates(
      updates,
      options,
      settings,
      library,
      stage
    );
    const { versionId } = reactTranslationResponse;
    await updateConfig({
      configFilepath: settings.config,
      _versionId: versionId,
    });
  }
  if (allFiles.length > 0) {
    filesTranslationResponse = await sendFiles(allFiles, options, settings);
    if (stage) {
      await updateVersions({
        configDirectory: settings.configDirectory,
        versionData: filesTranslationResponse.data,
      });
    }
  }
  return {
    reactTranslationResponse,
    filesTranslationResponse,
  };
}
