import traverseModule from '@babel/traverse';
import { NodePath } from '@babel/traverse';
import {
  GT_TRANSLATION_FUNCS,
  TRANSLATION_COMPONENT,
  INTERNAL_TRANSLATION_COMPONENT,
} from '../../jsx/utils/constants.js';
import { GTLibrary, isGTImportSource } from '../../../types/libraries.js';
import { extractImportName } from './parseAst.js';
import * as t from '@babel/types';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

/**
 * Constructs tracking for gt related variables of interest
 * translationComponentPaths: these are just <T> components
 * importAliases: any other GT related imports
 */
export function getPathsAndAliases(
  ast: t.Node,
  pkgs: GTLibrary[]
): {
  importAliases: Record<string, string>;
  translationComponentPaths: Array<{
    localName: string;
    path: NodePath;
    originalName: string;
  }>;
} {
  // First pass: collect imports and process translation functions
  const importAliases: Record<string, string> = {};
  const translationComponentPaths: Array<{
    localName: string;
    path: NodePath;
    originalName: string;
  }> = [];

  traverse(ast, {
    ImportDeclaration(path) {
      if (isGTImportSource(path.node.source.value, pkgs)) {
        const importName = extractImportName(
          path.node,
          pkgs,
          GT_TRANSLATION_FUNCS
        );
        for (const name of importName) {
          if (
            name.original === TRANSLATION_COMPONENT ||
            name.original === INTERNAL_TRANSLATION_COMPONENT
          ) {
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
          isGTImportSource((args[0] as t.StringLiteral).value, pkgs)
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
                name.original === TRANSLATION_COMPONENT ||
                name.original === INTERNAL_TRANSLATION_COMPONENT
              ) {
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
    translationComponentPaths,
  };
}
