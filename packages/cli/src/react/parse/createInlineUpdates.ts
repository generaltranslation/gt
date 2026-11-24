import fs from 'node:fs';
import nodePath from 'node:path';
import { Updates } from 'generaltranslation';
import { extractFromSvelteModule } from '@generaltranslation/svelte-extractor/integration';

import { parse } from '@babel/parser';
import { parseTranslationComponent } from '../jsx/utils/jsxParsing/parseJsx.js';
import { logger } from '../../console/logger.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';
import type {
  ParsingConfigOptions,
  ResolvedGTParsingFlags,
} from '../../types/parsing.js';
import { getPathsAndAliases } from '../jsx/utils/getPathsAndAliases.js';
import { getSourceParserPlugins } from '../jsx/utils/sourceParserPlugins.js';
import { extractMessageTrees } from '../jsx/utils/stringParsing/extractMessageTrees/index.js';
import { createHelperFollower } from '../jsx/utils/stringParsing/extractMessageTrees/followHelpers.js';
import type { ParsingConfig } from '../jsx/utils/stringParsing/types.js';
import {
  GTLibrary,
  GT_LIBRARIES_UPSTREAM,
  Libraries,
  REACT_LIBRARIES,
  ReactLibrary,
} from '../../types/libraries.js';
import {
  calculateHashes,
  dedupeUpdates,
  linkDeriveUpdates,
} from '../../extraction/postProcess.js';
import {
  ensureTAndVarImported,
  autoInsertJsxComponents,
} from '../jsx/utils/jsxParsing/autoInsertion.js';
import { INTERNAL_TRANSLATION_COMPONENT } from '../jsx/utils/constants.js';
import { resetTypeCheckers } from '../jsx/utils/typeChecker.js';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;

export async function createInlineUpdates(
  pkg: GTLibrary,
  validate: boolean,
  filePatterns: string[] | undefined,
  parsingFlags: ResolvedGTParsingFlags,
  parsingOptions: ParsingConfigOptions,
  /** Receives each file that could not be parsed: its messages are missing from the updates. */
  skippedFiles: string[] = []
): Promise<{ updates: Updates; errors: string[]; warnings: string[] }> {
  resetTypeCheckers();
  const updates: Updates = [];

  const errors: string[] = [];
  const warnings: Set<string> = new Set();

  const pkgs = getUpstreamPackages(pkg);
  const helperFollower = createHelperFollower(parsingOptions);

  // Use the provided app directory or default to the current directory
  const files = matchFiles(process.cwd(), filePatterns || DEFAULT_SRC_PATTERNS);

  for (const file of files) {
    const code = await fs.promises.readFile(file, 'utf8');
    let ast;
    let pathsAndAliases;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: getSourceParserPlugins(file),
      });
      // First pass: collect imports and process translation functions. Babel
      // can parse some files whose scopes it cannot build.
      pathsAndAliases = getPathsAndAliases(ast, pkgs);
    } catch (error) {
      logger.error(`Error parsing file ${file}: ${error}`);
      skippedFiles.push(file);
      continue;
    }
    const { importAliases, translationComponentPaths } = pathsAndAliases;

    const stringParsingConfig: ParsingConfig = {
      file,
      includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
      skippedMessagesAreErrors: validate,
    };

    // Tagged-template messages, extracted as message trees
    await extractMessageTrees(
      ast,
      pkgs,
      stringParsingConfig,
      { updates, errors, warnings },
      helperFollower
    );

    // gt-svelte's string API. Its extractor reads ESTree, as in a .svelte file's scripts
    if (pkg === Libraries.GT_SVELTE) {
      const strings = extractFromSvelteModule(code, {
        relativePath: nodePath.relative(process.cwd(), file),
        parse: (source) =>
          parse(source, {
            sourceType: 'module',
            plugins: ['estree', ...getSourceParserPlugins(file)],
          }).program,
        includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
      });
      updates.push(...strings.updates);
      errors.push(...strings.errors);
      for (const warning of strings.warnings) warnings.add(warning);
    }

    // Parse <T> components — PASS 1: user-written T
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
            autoderive: parsingFlags.autoderive,
          },
          output: {
            errors,
            warnings,
            unwrappedExpressions: [],
          },
        });
      }

      // PASS 2: Auto-inject GtInternalTranslateJsx and GtInternalVar and extract (flag-gated)
      if (parsingFlags.enableAutoJsxInjection) {
        // Add translation component names to importAliases so autoInsertJsxComponents
        // recognizes user T as hands-off (getPathsAndAliases separates them out)
        for (const { localName, originalName } of translationComponentPaths) {
          importAliases[localName] = originalName;
        }

        // Ensure GtInternalTranslateJsx and GtInternalVar are imported in the AST
        ensureTAndVarImported(ast, importAliases);

        // Insert T/Var into the AST
        autoInsertJsxComponents(ast, importAliases);

        // Refresh scope to pick up new T references
        traverse(ast, {
          Program(programPath) {
            programPath.scope.crawl();
          },
        });

        // Re-collect with updated AST
        const refreshed = getPathsAndAliases(ast, pkgs);

        // Add translation component names to refreshed aliases so parseJsx
        // can recognize GtInternalTranslateJsx inside Derive for transparent unwrap
        for (const {
          localName: tLocalName,
          originalName: tOrigName,
        } of refreshed.translationComponentPaths) {
          refreshed.importAliases[tLocalName] = tOrigName;
        }

        // Extract only from auto-injected GtInternalTranslateJsx — never re-extract user T
        for (const {
          localName,
          path,
          originalName,
        } of refreshed.translationComponentPaths) {
          if (originalName !== INTERNAL_TRANSLATION_COMPONENT) continue;
          parseTranslationComponent({
            originalName: localName,
            localName,
            path,
            updates,
            config: {
              importAliases: refreshed.importAliases,
              parsingOptions,
              pkgs,
              file,
              includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
              enableAutoJsxInjection: true,
              autoderive: parsingFlags.autoderive,
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
