/** Automatic JSX insertion preserves the caller's original Babel/TypeScript AST. */
import * as t from '@babel/types';
import traverseModule from '@babel/traverse';
import {
  INTERNAL_TRANSLATION_COMPONENT,
  INTERNAL_VAR_COMPONENT,
  getGtReactImportSource,
} from '../constants.js';
import { insertAutoJsx } from './autoInsertion/insert.js';
import { prependImport } from './autoInsertion/imports.js';
import type { AutoJsxRuntimeContext } from './autoInsertion/projectRuntime.js';
const traverse: typeof traverseModule.default =
  traverseModule.default || traverseModule;

/** Tracks which AST nodes were auto-inserted by this module */
const autoInsertedNodes = new WeakSet<t.Node>();

/** Check if a node was auto-inserted */
export function isAutoInserted(node: t.Node): boolean {
  return autoInsertedNodes.has(node);
}

// ===== Public API ===== //

/**
 * Ensure GtInternalTranslateJsx and GtInternalVar are imported in the AST.
 * Adds: import { GtInternalTranslateJsx, GtInternalVar } from 'gt-react';
 * These are distinct from user T/Var so there's no ambiguity.
 *
 * Updates importAliases in-place.
 */
export function ensureTAndVarImported(
  ast: t.File,
  importAliases: Record<string, string>,
  legacyGtReactImportSource = false
): void {
  // Check if internal components are already imported
  const hasInternalT = Object.values(importAliases).includes(
    INTERNAL_TRANSLATION_COMPONENT
  );
  const hasInternalVar = Object.values(importAliases).includes(
    INTERNAL_VAR_COMPONENT
  );

  if (hasInternalT && hasInternalVar) return;

  const specifiers: t.ImportSpecifier[] = [];
  if (!hasInternalT) {
    specifiers.push(
      t.importSpecifier(
        t.identifier(INTERNAL_TRANSLATION_COMPONENT),
        t.identifier(INTERNAL_TRANSLATION_COMPONENT)
      )
    );
    importAliases[INTERNAL_TRANSLATION_COMPONENT] =
      INTERNAL_TRANSLATION_COMPONENT;
  }
  if (!hasInternalVar) {
    specifiers.push(
      t.importSpecifier(
        t.identifier(INTERNAL_VAR_COMPONENT),
        t.identifier(INTERNAL_VAR_COMPONENT)
      )
    );
    importAliases[INTERNAL_VAR_COMPONENT] = INTERNAL_VAR_COMPONENT;
  }

  const importDecl = t.importDeclaration(
    specifiers,
    t.stringLiteral(getGtReactImportSource(legacyGtReactImportSource))
  );

  traverse(ast, {
    Program(path) {
      prependImport(path, importDecl);
      path.stop();
    },
  });
}

export function autoInsertJsxComponents(
  ast: t.File,
  importAliases: Record<string, string>,
  context?: AutoJsxRuntimeContext
): void {
  insertAutoJsx(
    ast,
    importAliases,
    (node) => autoInsertedNodes.add(node),
    context
  );
}
