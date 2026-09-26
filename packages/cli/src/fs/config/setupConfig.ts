import fs from 'node:fs';
import { displayCreatedConfigFile } from '../../console/logging.js';
import { FilesOptions, SupportedFrameworks } from '../../types/index.js';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { GT_CONFIG_SCHEMA_URL } from '../../utils/constants.js';

export type SetupConfigUpdate = {
  projectId?: string;
  defaultLocale?: string;
  locales?: string[];
  src?: string[];
  files?: FilesOptions;
  framework?: SupportedFrameworks;
  baseUrl?: string;
  publish?: boolean;
  /** Removes stale global CDN intent when the selected runtime forbids it. */
  clearPublish?: boolean;
  /** File format entries deselected by an explicit format list. */
  removeFiles?: string[];
  /** Drops files.gt.output after an explicit switch to CDN storage. */
  clearGtOutput?: boolean;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * The config setup writes: the existing content with the update applied.
 * Unrelated fields and per-format options are kept; locales are replaced.
 */
export function mergeSetupConfig(
  oldContent: Record<string, unknown>,
  options: SetupConfigUpdate
): Record<string, unknown> {
  // Filter out empty string values from the config object
  const newContent = {
    ...(options.projectId && { projectId: options.projectId }),
    ...(options.defaultLocale && { defaultLocale: options.defaultLocale }),
    ...(options.src && { src: options.src }),
    ...(options.framework && { framework: options.framework }),
    ...(options.baseUrl && { baseUrl: options.baseUrl }),
    ...(options.publish && { publish: options.publish }),
  };
  const mergedContent: Record<string, unknown> = {
    $schema: GT_CONFIG_SCHEMA_URL,
    ...oldContent,
    ...newContent,
  };

  if (options.clearPublish) {
    delete mergedContent.publish;
  }

  // Preserve unrelated file configuration and nested GT options when setup
  // only needs to add or update a translation output path.
  if (options.files || options.removeFiles?.length || options.clearGtOutput) {
    const oldFiles = asObject(oldContent.files);
    const files: Record<string, unknown> = { ...oldFiles, ...options.files };
    const gt = { ...asObject(oldFiles.gt), ...options.files?.gt };
    if (options.clearGtOutput) delete gt.output;
    if (Object.keys(gt).length > 0) files.gt = gt;
    else delete files.gt;
    for (const format of options.removeFiles ?? []) delete files[format];
    if (Object.keys(files).length > 0) mergedContent.files = files;
    else delete mergedContent.files;
  }

  // The selected locale list replaces the configured one.
  if (options.locales) {
    mergedContent.locales = options.locales;
  }
  return mergedContent;
}

/**
 * Creates the config file, or applies the update to the existing one.
 * @param {string} configFilepath - The path to the config file.
 * @param {SetupConfigUpdate} options - The values setup resolved.
 * @throws When the existing file is not valid JSON or cannot be written.
 */
export async function createOrUpdateConfig(
  configFilepath: string,
  options: SetupConfigUpdate
): Promise<string> {
  try {
    let oldContent: Record<string, unknown> = {};
    if (fs.existsSync(configFilepath)) {
      const parsed = JSON.parse(
        await fs.promises.readFile(configFilepath, 'utf-8')
      );
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      )
        throw new Error('the file does not contain a JSON object');
      oldContent = parsed as Record<string, unknown>;
    }

    const mergedJsonContent = JSON.stringify(
      mergeSetupConfig(oldContent, options),
      null,
      2
    );
    await fs.promises.writeFile(configFilepath, mergedJsonContent, 'utf-8');

    // show update in console
    displayCreatedConfigFile(configFilepath);
  } catch (error) {
    throw new Error(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: `Could not update ${configFilepath}`,
        details: formatDiagnosticErrorDetails(error),
        fix: 'Fix or remove the file, then rerun the command',
      })
    );
  }
  return configFilepath;
}
