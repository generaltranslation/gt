import {
  Options,
  GenerateSourceOptions,
  Updates,
  TranslateFlags,
} from '../types/index.js';
import fs from 'fs';
import { logError } from '../console/logging.js';
import loadJSON from '../fs/loadJSON.js';
import { createDictionaryUpdates } from '../react/parse/createDictionaryUpdates.js';
import { createInlineUpdates } from '../react/parse/createInlineUpdates.js';
import createESBuildConfig from '../react/config/createESBuildConfig.js';
import chalk from 'chalk';

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
  sourceDictionary: string | undefined,
  pkg: 'gt-react' | 'gt-next',
  validate: boolean
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
        ...(await createDictionaryUpdates(sourceDictionary)),
      ];
    } else {
      let esbuildConfig;
      if (options.jsconfig) {
        const jsconfig = loadJSON(options.jsconfig);
        if (!jsconfig) {
          logError(
            `Failed to resolve jsconfig.json or tsconfig.json at provided filepath: "${options.jsconfig}"`
          );
          process.exit(1);
        }
        esbuildConfig = createESBuildConfig(jsconfig);
      } else {
        esbuildConfig = createESBuildConfig({});
      }
      updates = [
        ...updates,
        ...(await createDictionaryUpdates(sourceDictionary, esbuildConfig)),
      ];
    }
  }
  // Scan through project for <T> tags
  const {
    updates: newUpdates,
    errors: newErrors,
    warnings: newWarnings,
  } = await createInlineUpdates(pkg, validate, options.src);

  errors = [...errors, ...newErrors];
  warnings = [...warnings, ...newWarnings];
  updates = [...updates, ...newUpdates];

  // Metadata addition and validation
  const idHashMap = new Map<string, string>();
  const duplicateIds = new Set<string>();

  updates = updates.map((update) => {
    if (!update.metadata.id) return update;
    const existingHash = idHashMap.get(update.metadata.id);
    if (existingHash) {
      if (existingHash !== update.metadata.hash) {
        errors.push(
          `Hashes don't match on two components with the same id: ${chalk.blue(
            update.metadata.id
          )}. Check your ${chalk.green(
            '<T>'
          )} tags and dictionary entries and make sure you're not accidentally duplicating IDs.`
        );
        duplicateIds.add(update.metadata.id);
      }
    } else {
      idHashMap.set(update.metadata.id, update.metadata.hash);
    }
    return update;
  });

  // Filter out updates with duplicate IDs
  updates = updates.filter((update) => !duplicateIds.has(update.metadata.id));
  return { updates, errors, warnings };
}
