import fs from 'node:fs';
import path from 'node:path';
import os from 'os';
import { build, BuildOptions } from 'esbuild';
import { Options, Updates } from '../../types';
import flattenDictionary from '../utils/flattenDictionary';
import { splitStringToContent } from 'generaltranslation';
import loadJSON from '../../fs/loadJSON';
import { hashJsxChildren } from 'generaltranslation/id';
import getEntryAndMetadata from '../utils/getEntryAndMetadata';
import { logError, logErrorAndExit } from '../../console';

export default async function createDictionaryUpdates(
  options: Options,
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

    // Load the module using require
    let dictionaryModule;
    try {
      dictionaryModule = require(tempFilePath);
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

  if (!Object.keys(dictionary).length) {
    logErrorAndExit(
      `Dictionary filepath provided: "${options.dictionary}", but no entries found.`
    );
  }

  // ----- CREATE PARTIAL UPDATES ----- //

  let updates: Updates = [];

  for (const id of Object.keys(dictionary)) {
    let {
      entry,
      metadata: props, // context, etc.
    } = getEntryAndMetadata(dictionary[id]);

    const source = splitStringToContent(entry);
    const context = props?.context;
    const metadata: Record<string, any> = {
      id,
      ...(context && { context }),
      // This hash isn't actually used by the GT API, just for consistency sake
      hash: hashJsxChildren({
        source,
        ...(context && { context }),
        ...(id && { id }),
        dataFormat: 'JSX',
      }),
    };
    updates.push({
      dataFormat: 'JSX',
      source,
      metadata,
    });
  }

  return updates;
}
