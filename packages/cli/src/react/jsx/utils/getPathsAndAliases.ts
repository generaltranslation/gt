import traverseModule from '@babel/traverse';
import { NodePath } from '@babel/traverse';
import {
  GT_TRANSLATION_FUNCS,
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  INLINE_MESSAGE_HOOK,
  INLINE_MESSAGE_HOOK_ASYNC,
  MSG_TRANSLATION_HOOK,
  TRANSLATION_COMPONENT,
} from '../../jsx/utils/constants.js';
import { extractImportName } from './parseAst.js';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

/**
 *
 */
export function getPathsAndAliases(
  ast: any,
  pkg: 'gt-react' | 'gt-next'
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
      console.log('path1');
      if (path.node.source.value.startsWith(pkg)) {
        console.log('path1.1');
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
      console.log('path2');

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
