import fs from 'node:fs';
import path from 'node:path';
import os from 'os';
import { build, BuildOptions } from 'esbuild';
import { Updates } from '../../types/index.js';
import flattenDictionary from '../utils/flattenDictionary.js';
import { splitStringToContent } from 'generaltranslation';
import loadJSON from '../../fs/loadJSON.js';
import { hashSource } from 'generaltranslation/id';
import getEntryAndMetadata from '../utils/getEntryAndMetadata.js';
import { logError } from '../../console/logging.js';

export default async function createDictionaryUpdates(
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
    dictionary = flattenDictionary(
      dictionaryModule.default ||
        dictionaryModule.dictionary ||
        dictionaryModule
    );
  }

  // ----- CREATE PARTIAL UPDATES ----- //

  const updates: Updates = [];

  for (const id of Object.keys(dictionary)) {
    const {
      entry,
      metadata: props, // context, etc.
    } = getEntryAndMetadata(dictionary[id]);

    const context = props?.context;
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
