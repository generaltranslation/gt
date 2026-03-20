import fs from 'node:fs';
import { Updates } from '../../types/index.js';

import { parse } from '@babel/parser';
import { parseTranslationComponent } from '../jsx/utils/jsxParsing/parseJsx.js';
import { parseStrings } from '../jsx/utils/parseStringFunction.js';
import { logger } from '../../console/logger.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';
import type {
  ParsingConfigOptions,
  GTParsingFlags,
} from '../../types/parsing.js';
import { getPathsAndAliases } from '../jsx/utils/getPathsAndAliases.js';
import {
  GTLibrary,
  GT_LIBRARIES_UPSTREAM,
  REACT_LIBRARIES,
  ReactLibrary,
} from '../../types/libraries.js';
import {
  calculateHashes,
  dedupeUpdates,
  linkDeriveUpdates,
} from '../../extraction/postProcess.js';

export async function createInlineUpdates(
  pkg: GTLibrary,
  validate: boolean,
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions
): Promise<{ updates: Updates; errors: string[]; warnings: string[] }> {
  const updates: Updates = [];

  const errors: string[] = [];
  const warnings: Set<string> = new Set();

  const pkgs = getUpstreamPackages(pkg);

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
      logger.error(`Error parsing file ${file}: ${error}`);
      continue;
    }

    // First pass: collect imports and process translation functions
    const { importAliases, inlineTranslationPaths, translationComponentPaths } =
      getPathsAndAliases(ast, pkgs);

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
        {
          parsingOptions,
          file,
          ignoreInlineMetadata: false,
          ignoreDynamicContent: false,
          ignoreInvalidIcu: false,
          ignoreInlineListContent: false,
          includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
          ignoreTaggedTemplates: false,
          ignoreGlobalTaggedTemplates: false,
          // User configurable, otherwise default to AUTO
          enableAutoDerive: parsingFlags.autoDerive ? 'AUTO' : 'DISABLED',
        },
        { updates, errors, warnings }
      );
    }

    // Parse <T> components
    if (REACT_LIBRARIES.includes(pkg as ReactLibrary)) {
      for (const { localName, path } of translationComponentPaths) {
        parseTranslationComponent({
          originalName: localName,
          localName,
          path,
          updates,
          config: {
            importAliases,
            parsingOptions,
            pkgs,
            file,
            includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
          },
          output: {
            errors,
            warnings,
            unwrappedExpressions: [],
          },
        });
      }
    }
  }

  // Post processing steps:
  await calculateHashes(updates);
  dedupeUpdates(updates);
  linkDeriveUpdates(updates);

  return { updates, errors, warnings: [...warnings] };
}

/**
 * Given a package name, return the upstream packages that it depends on
 * @param pkg - The package name
 * @returns The upstream packages that the package depends on
 */
function getUpstreamPackages(pkg: GTLibrary): GTLibrary[] {
  return GT_LIBRARIES_UPSTREAM[pkg];
}

export { dedupeUpdates as _test_dedupeUpdates };
