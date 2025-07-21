import fs from 'node:fs';
import path from 'node:path';
import os from 'os';
import { build, BuildOptions } from 'esbuild';
import { Updates } from '../../types/index.js';
import flattenDictionary from '../utils/flattenDictionary.js';
import loadJSON from '../../fs/loadJSON.js';
import { hashSource } from 'generaltranslation/id';
import getEntryAndMetadata from '../utils/getEntryAndMetadata.js';
import { logError } from '../../console/logging.js';

export async function createDictionaryUpdates(
  dictionaryPath: string,
  esbuildConfig?: BuildOptions
): Promise<Updates> {
  let dictionary;
  // ---- HANDLE JSON STRING DICTIONARY ----- //

  if (dictionaryPath.endsWith('.json')) {
    dictionary = flattenDictionary(loadJSON(dictionaryPath) || {});
  }

  // ----- HANDLE REACT DICTIONARY ---- //
  else {
    const result = await build({
      ...esbuildConfig,
      entryPoints: [dictionaryPath],
      write: false,
    });

    const bundledCode = result.outputFiles[0].text;
    const tempFilePath = path.join(os.tmpdir(), 'bundled-dictionary.js');
    await fs.promises.writeFile(tempFilePath, bundledCode);

    // Load the module using dynamic import
    let dictionaryModule;
    try {
      dictionaryModule = await import(tempFilePath);
    } catch (error) {
      logError(`Failed to load the bundled dictionary code: ${error}`);
      process.exit(1);
    } finally {
      // Clean up the temporary file
      await fs.promises.unlink(tempFilePath);
    }
    const unwrappedDictionary = unwrapDictionaryModule(dictionaryModule);
    dictionary = flattenDictionary(unwrappedDictionary);
  }

  // ----- CREATE PARTIAL UPDATES ----- //

  const updates: Updates = [];

  for (const id of Object.keys(dictionary)) {
    const {
      entry,
      metadata: props, // context, etc.
    } = getEntryAndMetadata(dictionary[id]);

    // Map $context to context
    const context = props?.$context;
    const metadata: Record<string, any> = {
      id,
      ...(context && { context }),
      // This hash isn't actually used by the GT API, just for consistency sake
      hash: hashSource({
        source: entry,
        ...(context && { context }),
        ...(id && { id }),
        dataFormat: 'ICU',
      }),
    };
    updates.push({
      dataFormat: 'ICU',
      source: entry,
      metadata,
    });
  }

  return updates;
}

function unwrapDictionaryModule(mod: any): any {
  let current = mod;

  // Keep unwrapping until we get to the actual dictionary
  while (current && typeof current === 'object') {
    const keys = Object.keys(current);

    // Check if this looks like a module namespace object (has only module-related keys)
    const isModuleNamespace = keys.every(
      (key) =>
        key === 'default' || key === 'module.exports' || key === '__esModule'
    );

    // Check if this is a module with named exports (has 'dictionary' export)
    // Only check for named exports if it's NOT a pure module namespace
    const hasNamedDictionary =
      !isModuleNamespace &&
      'dictionary' in current &&
      current.dictionary &&
      typeof current.dictionary === 'object' &&
      !Array.isArray(current.dictionary);

    if (hasNamedDictionary) {
      // If there's a named 'dictionary' export, use that
      return current.dictionary;
    } else if (isModuleNamespace) {
      // Try to get the default export
      if ('default' in current) {
        let result = current.default;

        // If the default export is a function (getter), call it
        if (typeof result === 'function') {
          try {
            result = result();
          } catch {
            // If calling fails, break the loop
            break;
          }
        }

        // If we have a valid object, check if we should continue unwrapping
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          const resultKeys = Object.keys(result);
          // Only continue unwrapping if this looks like a getter-based module layer
          // We should NOT continue if this is just a user dictionary with a 'default' property
          const hasGetterProperties = resultKeys.some((key) => {
            try {
              const descriptor = Object.getOwnPropertyDescriptor(result, key);
              return descriptor && typeof descriptor.get === 'function';
            } catch {
              return false;
            }
          });

          if (hasGetterProperties) {
            current = result;
            continue;
          } else {
            // This is the actual dictionary, return it
            return result;
          }
        }
      }

      // Try module.exports as fallback
      if ('module.exports' in current) {
        let result = current['module.exports'];

        if (typeof result === 'function') {
          try {
            result = result();
          } catch {
            // If calling fails, break the loop
            break;
          }
        }

        if (result && typeof result === 'object' && !Array.isArray(result)) {
          const resultKeys = Object.keys(result);
          // Only continue unwrapping if this looks like a getter-based module layer
          // We should NOT continue if this is just a user dictionary with a 'default' property
          const hasGetterProperties = resultKeys.some((key) => {
            try {
              const descriptor = Object.getOwnPropertyDescriptor(result, key);
              return descriptor && typeof descriptor.get === 'function';
            } catch {
              return false;
            }
          });

          if (hasGetterProperties) {
            current = result;
            continue;
          } else {
            // This is the actual dictionary, return it
            return result;
          }
        }
      }

      // If we can't unwrap further, break
      break;
    } else {
      // This appears to be the actual dictionary object, not a module wrapper
      break;
    }
  }

  return current || {};
}
