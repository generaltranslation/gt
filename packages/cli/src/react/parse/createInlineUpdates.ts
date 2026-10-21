import fs from 'node:fs';
import { Updates } from '../../types/index.js';

import { parse } from '@babel/parser';
import { parseTranslationComponent } from '../jsx/utils/jsxParsing/parseJsx.js';
import { parseStrings } from '../jsx/utils/parseStringFunction.js';
import { logger } from '../../console/logger.js';
import { isPermissionError, matchFiles } from '../../fs/matchFiles.js';
import {
  DEFAULT_NODE_SRC_EXCLUDES,
  DEFAULT_NODE_SRC_PATTERNS,
  DEFAULT_SRC_PATTERNS,
} from '../../config/generateSettings.js';
import type {
  ParsingConfigOptions,
  GTParsingFlags,
} from '../../types/parsing.js';
import { resolveAutoderive } from '../../types/parsing.js';
import { getPathsAndAliases } from '../jsx/utils/getPathsAndAliases.js';
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
import { warnDeprecatedTSugarPropsSync } from '../../console/index.js';
import {
  ensureTAndVarImported,
  autoInsertJsxComponents,
} from '../jsx/utils/jsxParsing/autoInsertion.js';
import { INTERNAL_TRANSLATION_COMPONENT } from '../jsx/utils/constants.js';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
const traverse = traverseModule.default || traverseModule;

/**
 * @param skippedPaths - Receives the folders and files that the gt-node
 * default scan skipped because it could not read them.
 */
export async function createInlineUpdates(
  pkg: GTLibrary,
  validate: boolean,
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags,
  parsingOptions: ParsingConfigOptions,
  skippedPaths: string[] = []
): Promise<{ updates: Updates; errors: string[]; warnings: string[] }> {
  const updates: Updates = [];

  const errors: string[] = [];
  const warnings: Set<string> = new Set();
  // Deprecated $-prefixed <T> prop occurrences, consolidated into one warning
  const sugarPropLocations: string[] = [];

  const pkgs = getUpstreamPackages(pkg);

  const autoderive = resolveAutoderive(parsingFlags.autoderive);

  // Use the provided app directory or default to the current directory
  const isNodeDefaultScan = !filePatterns && pkg === Libraries.GT_NODE;
  const files = filePatterns
    ? matchFiles(process.cwd(), filePatterns)
    : isNodeDefaultScan
      ? // The whole-project scan skips folders it cannot read, such as a
        // database volume, instead of failing.
        matchFiles(
          process.cwd(),
          [
            ...DEFAULT_NODE_SRC_PATTERNS,
            ...DEFAULT_NODE_SRC_EXCLUDES.map((pattern) => `!${pattern}`),
          ],
          { unreadableFolders: skippedPaths }
        )
      : matchFiles(process.cwd(), DEFAULT_SRC_PATTERNS);

  for (const file of files) {
    let code: string;
    try {
      code = await fs.promises.readFile(file, 'utf8');
    } catch (error) {
      // The whole-project scan also skips files it cannot read. Files that
      // src patterns match must be readable.
      if (isNodeDefaultScan && isPermissionError(error)) {
        skippedPaths.push(file);
        continue;
      }
      throw error;
    }
    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        // CommonJS scripts may return at the top level.
        allowReturnOutsideFunction: true,
        plugins: ['jsx', 'typescript'],
      });
    } catch (error) {
      logger.error(`Error parsing file ${file}: ${error}`);
      continue;
    }
    removeTypeOnlyImports(ast);

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
          autoderiveMethod: autoderive.strings ? 'AUTO' : 'DISABLED',
        },
        { updates, errors, warnings }
      );
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
            autoderive: autoderive.jsx,
          },
          output: {
            errors,
            warnings,
            unwrappedExpressions: [],
            sugarPropLocations,
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
        ensureTAndVarImported(
          ast,
          importAliases,
          parsingFlags.legacyGtReactImportSource
        );

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
              autoderive: autoderive.jsx,
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

  // Warn once per scan about deprecated $-prefixed <T> props
  if (sugarPropLocations.length > 0) {
    warnings.add(warnDeprecatedTSugarPropsSync(sugarPropLocations));
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

/**
 * Removes type-only imports, which have no runtime value. Babel's scope
 * tracker counts them as bindings, so `import type { Foo }` next to
 * `let Foo` makes traversal throw, although TypeScript accepts a type and a
 * value with the same name.
 */
function removeTypeOnlyImports(ast: t.File): void {
  const isTypeOnly = (importKind?: string | null) =>
    importKind === 'type' || importKind === 'typeof';
  ast.program.body = ast.program.body.filter((node) => {
    if (t.isTSImportEqualsDeclaration(node))
      return !isTypeOnly(node.importKind);
    if (!t.isImportDeclaration(node)) return true;
    if (isTypeOnly(node.importKind)) return false;
    node.specifiers = node.specifiers.filter(
      (specifier) =>
        !t.isImportSpecifier(specifier) || !isTypeOnly(specifier.importKind)
    );
    return true;
  });
}

export { dedupeUpdates as _test_dedupeUpdates };
