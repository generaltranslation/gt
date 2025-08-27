import fs from 'node:fs';
import { Options, Updates } from '../../types/index.js';

import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import { NodePath } from '@babel/traverse';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

import { hashSource } from 'generaltranslation/id';
import { parseJSXElement } from '../jsx/utils/parseJsx.js';
import { parseStrings } from '../jsx/utils/parseStringFunction.js';
import { extractImportName } from '../jsx/utils/parseAst.js';
import { logError } from '../../console/logging.js';
import {
  GT_TRANSLATION_FUNCS,
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  INLINE_MESSAGE_HOOK,
  INLINE_MESSAGE_HOOK_ASYNC,
  MSG_TRANSLATION_HOOK,
} from '../jsx/utils/constants.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';

export async function createInlineUpdates(
  pkg: 'gt-react' | 'gt-next',
  validate: boolean,
  filePatterns: string[] | undefined
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

    const importAliases: Record<string, string> = {};

    // First pass: collect imports and process translation functions
    const translationPaths: Array<{
      localName: string;
      path: NodePath;
      originalName: string;
    }> = [];

    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value.startsWith(pkg)) {
          const importName = extractImportName(
            path.node,
            pkg,
            GT_TRANSLATION_FUNCS
          );
          for (const name of importName) {
            if (
              name.original === INLINE_TRANSLATION_HOOK ||
              name.original === INLINE_TRANSLATION_HOOK_ASYNC ||
              name.original === INLINE_MESSAGE_HOOK ||
              name.original === INLINE_MESSAGE_HOOK_ASYNC ||
              name.original === MSG_TRANSLATION_HOOK
            ) {
              translationPaths.push({
                localName: name.local,
                path,
                originalName: name.original,
              });
            } else {
              importAliases[name.local] = name.original;
            }
          }
        }
      },
      VariableDeclarator(path) {
        // Check if the init is a require call
        if (
          path.node.init?.type === 'CallExpression' &&
          path.node.init.callee.type === 'Identifier' &&
          path.node.init.callee.name === 'require'
        ) {
          // Check if it's requiring our package
          const args = path.node.init.arguments;
          if (
            args.length === 1 &&
            args[0].type === 'StringLiteral' &&
            args[0].value.startsWith(pkg)
          ) {
            const parentPath = path.parentPath;
            if (parentPath.isVariableDeclaration()) {
              const importName = extractImportName(
                parentPath.node,
                pkg,
                GT_TRANSLATION_FUNCS
              );
              for (const name of importName) {
                if (
                  name.original === INLINE_TRANSLATION_HOOK ||
                  name.original === INLINE_TRANSLATION_HOOK_ASYNC ||
                  name.original === INLINE_MESSAGE_HOOK ||
                  name.original === INLINE_MESSAGE_HOOK_ASYNC ||
                  name.original === MSG_TRANSLATION_HOOK
                ) {
                  translationPaths.push({
                    localName: name.local,
                    path: parentPath,
                    originalName: name.original,
                  });
                } else {
                  importAliases[name.local] = name.original;
                }
              }
            }
          }
        }
      },
    });

    // Process translation functions asynchronously
    for (const { localName: name, originalName, path } of translationPaths) {
      parseStrings(name, originalName, path, updates, errors, file);
    }

    // Parse <T> components
    traverse(ast, {
      JSXElement(path) {
        parseJSXElement(
          importAliases,
          path.node,
          updates,
          errors,
          warnings,
          file
        );
      },
    });

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
