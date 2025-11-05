import fs from 'node:fs';
import { Options, Updates } from '../../types/index.js';

import { parse } from '@babel/parser';
import { hashSource } from 'generaltranslation/id';
import { parseTranslationComponent } from '../jsx/utils/parseJsx.js';
import { parseStrings } from '../jsx/utils/parseStringFunction.js';
import { extractImportName } from '../jsx/utils/parseAst.js';
import { logError } from '../../console/logging.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';
import type { ParsingConfigOptions } from '../../types/parsing.js';
import { getPathsAndAliases } from '../jsx/utils/getPathsAndAliases.js';

export async function createInlineUpdates(
  pkg: 'gt-react' | 'gt-next',
  validate: boolean,
  filePatterns: string[] | undefined,
  parsingOptions: ParsingConfigOptions
): Promise<{ updates: Updates; errors: string[]; warnings: string[] }> {
  const updates: Updates = [];

  const errors: string[] = [];
  const warnings: Set<string> = new Set();

  // Use the provided app directory or default to the current directory
  const files = matchFiles(process.cwd(), filePatterns || DEFAULT_SRC_PATTERNS);

  for (const file of files) {
    const code = await fs.promises.readFile(file, 'utf8');
    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch (error) {
      logError(`Error parsing file ${file}: ${error}`);
      continue;
    }

    // First pass: collect imports and process translation functions
    const { importAliases, inlineTranslationPaths, translationComponentPaths } =
      getPathsAndAliases(ast, pkg);

    // Process translation functions asynchronously
    for (const {
      localName: name,
      originalName,
      path,
    } of inlineTranslationPaths) {
      parseStrings(
        name,
        originalName,
        path,
        updates,
        errors,
        warnings,
        file,
        parsingOptions
      );
    }

    // Parse <T> components
    for (const { localName, path } of translationComponentPaths) {
      parseTranslationComponent({
        importAliases: importAliases,
        originalName: localName,
        localName,
        ast,
        pkg,
        path,
        updates,
        errors,
        warnings,
        file,
        parsingOptions,
      });
    }

    // Extra validation (for Locadex)
    // Done in parseStrings() atm
    // if (validate) {
    //   for (const { localName: name, path, originalName } of translationPaths) {
    //     validateStringFunction(name, path, updates, errors, file, originalName);
    //   }
    // }
  }

  // Post-process to add a hash to each update
  await Promise.all(
    updates.map(async (update) => {
      const context = update.metadata.context;
      const hash = hashSource({
        source: update.source,
        ...(context && { context }),
        ...(update.metadata.id && { id: update.metadata.id }),
        dataFormat: update.dataFormat,
      });
      update.metadata.hash = hash;
    })
  );

  return { updates, errors, warnings: [...warnings] };
}
