import { Updates, TranslateFlags } from '../types/index.js';
import fs from 'fs';
import { logger } from '../console/logger.js';
import loadJSON from '../fs/loadJSON.js';
import { createDictionaryUpdates } from '../react/parse/createDictionaryUpdates.js';
import { createInlineUpdates } from '../react/parse/createInlineUpdates.js';
import { createPythonInlineUpdates } from '../python/parse/createPythonInlineUpdates.js';
import createESBuildConfig from '../react/config/createESBuildConfig.js';
import type { ParsingConfigOptions, GTParsingFlags } from '../types/parsing.js';
import { exitSync } from '../console/logging.js';
import { InlineLibrary, isPythonLibrary } from '../types/libraries.js';

/**
 * Searches for gt-react or gt-next dictionary files and creates updates for them,
 * as well as inline updates for <T> tags and useGT()/getGT() calls
 *
 * @param options - The options object
 * @param sourceDictionary - The source dictionary file path
 * @param pkg - The package name
 * @returns An object containing the updates and errors
 */
export async function createUpdates(
  options: TranslateFlags,
  src: string[] | undefined,
  sourceDictionary: string | undefined,
  pkg: InlineLibrary,
  validate: boolean,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions
): Promise<{ updates: Updates; errors: string[]; warnings: string[] }> {
  let updates: Updates = [];
  let errors: string[] = [];
  let warnings: string[] = [];

  // Parse dictionary with esbuildConfig
  if (
    sourceDictionary &&
    fs.existsSync(sourceDictionary) &&
    fs.statSync(sourceDictionary).isFile()
  ) {
    if (sourceDictionary.endsWith('.json')) {
      updates = [
        ...updates,
        ...(await createDictionaryUpdates(sourceDictionary, errors, warnings)),
      ];
    } else {
      let esbuildConfig;
      if (options.jsconfig) {
        const jsconfig = loadJSON(options.jsconfig);
        if (!jsconfig) {
          logger.error(
            `Failed to resolve jsconfig.json or tsconfig.json at provided filepath: "${options.jsconfig}"`
          );
          exitSync(1);
        }
        esbuildConfig = createESBuildConfig(jsconfig);
      } else {
        esbuildConfig = createESBuildConfig({});
      }
      updates = [
        ...updates,
        ...(await createDictionaryUpdates(
          sourceDictionary,
          errors,
          warnings,
          esbuildConfig
        )),
      ];
    }
  }
  // Scan through project for translatable content
  const {
    updates: newUpdates,
    errors: newErrors,
    warnings: newWarnings,
  } = isPythonLibrary(pkg)
    ? await createPythonInlineUpdates(src)
    : await createInlineUpdates(
        pkg,
        validate,
        src,
        parsingFlags,
        parsingOptions
      );

  errors = [...errors, ...newErrors];
  warnings = [...warnings, ...newWarnings];
  updates = [...updates, ...newUpdates];

  return { updates, errors, warnings };
}
