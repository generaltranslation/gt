import traverseModule from '@babel/traverse';
import { NodePath } from '@babel/traverse';
import {
  GT_TRANSLATION_FUNCS,
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  INLINE_MESSAGE_HOOK,
  INLINE_MESSAGE_HOOK_ASYNC,
  MSG_REGISTRATION_FUNCTION,
  TRANSLATION_COMPONENT,
} from '../../jsx/utils/constants.js';
import { GTLibrary } from '../../../types/libraries.js';
import { extractImportName } from './parseAst.js';
import * as t from '@babel/types';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

/**
 * Constructs tracking for gt related variables of interest
 * inlineTranslationPaths: these are string-related translation functions
 * translationComponentPaths: these are just <T> components
 * importAliases: any other GT related imports
 */
export function getPathsAndAliases(
  ast: any,
  pkgs: GTLibrary[]
): {
  importAliases: Record<string, string>;
  inlineTranslationPaths: Array<{
    localName: string;
    path: NodePath;
    originalName: string;
  }>;
  translationComponentPaths: Array<{
    localName: string;
    path: NodePath;
    originalName: string;
  }>;
} {
  // First pass: collect imports and process translation functions
  const importAliases: Record<string, string> = {};
  const inlineTranslationPaths: Array<{
    localName: string;
    path: NodePath;
    originalName: string;
  }> = [];

  const translationComponentPaths: Array<{
    localName: string;
    path: NodePath;
    originalName: string;
  }> = [];

  traverse(ast, {
    ImportDeclaration(path) {
      if (pkgs.some((pkg) => path.node.source.value.startsWith(pkg))) {
        const importName = extractImportName(
          path.node,
          pkgs,
          GT_TRANSLATION_FUNCS
        );
        for (const name of importName) {
          if (
            name.original === INLINE_TRANSLATION_HOOK ||
            name.original === INLINE_TRANSLATION_HOOK_ASYNC ||
            name.original === INLINE_MESSAGE_HOOK ||
            name.original === INLINE_MESSAGE_HOOK_ASYNC ||
            name.original === MSG_REGISTRATION_FUNCTION
          ) {
            inlineTranslationPaths.push({
              localName: name.local,
              path,
              originalName: name.original,
            });
          } else if (name.original === TRANSLATION_COMPONENT) {
            translationComponentPaths.push({
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
          pkgs.some((pkg) => (args[0] as t.StringLiteral).value.startsWith(pkg))
        ) {
          const parentPath = path.parentPath;
          if (parentPath.isVariableDeclaration()) {
            const importName = extractImportName(
              parentPath.node,
              pkgs,
              GT_TRANSLATION_FUNCS
            );
            for (const name of importName) {
              if (
                name.original === INLINE_TRANSLATION_HOOK ||
                name.original === INLINE_TRANSLATION_HOOK_ASYNC ||
                name.original === INLINE_MESSAGE_HOOK ||
                name.original === INLINE_MESSAGE_HOOK_ASYNC
              ) {
                inlineTranslationPaths.push({
                  localName: name.local,
                  path: parentPath,
                  originalName: name.original,
                });
              } else if (name.original === TRANSLATION_COMPONENT) {
                translationComponentPaths.push({
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
  return {
    importAliases,
    inlineTranslationPaths,
    translationComponentPaths,
  };
}
