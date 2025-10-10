import * as t from '@babel/types';
import { isGTImportSource } from '../../utils/constants/gt/helpers';
import { GT_ALL_FUNCTIONS } from '../../utils/constants/gt/constants';
import { isReactImportSource } from '../../utils/constants/react/helpers';
import { TransformState } from '../../state/types';

/**
 * Track import declarations for GT and React e.g. import { T, Var, useGT } from 'gt-next'
 * @param scopeTracker - Scope tracker to track variables
 * @param importDecl - Import declaration to track
 */
export function trackImportDeclaration(
  state: TransformState,
  importDecl: t.ImportDeclaration
): void {
  for (const specifier of importDecl.specifiers) {
    if (t.isImportSpecifier(specifier)) {
      handleImportSpecifier(state, specifier, importDecl.source.value);
    } else if (t.isImportDefaultSpecifier(specifier)) {
      handleImportDefaultSpecifier(state, specifier, importDecl.source.value);
    } else {
      handleImportNamespaceSpecifier(state, specifier, importDecl.source.value);
    }
  }
}

/**
 * Handle import specifiers
 * import { T, Var, useGT } from 'gt-next'
 */
function handleImportSpecifier(
  state: TransformState,
  importSpecifier: t.ImportSpecifier,
  importSource: string
): void {
  const alias = importSpecifier.local.name;
  const originalName = t.isIdentifier(importSpecifier.imported)
    ? importSpecifier.imported.name
    : importSpecifier.imported.value;
  if (isGTImportSource(importSource)) {
    state.scopeTracker.trackTranslationVariable(
      alias,
      originalName as GT_ALL_FUNCTIONS,
      0
    );
  } else if (isReactImportSource(importSource)) {
    state.scopeTracker.trackReactVariable(alias, originalName, 0);
  }
}

/**
 * Handle import default specifiers
 * import GT from 'gt-next'
 */
function handleImportDefaultSpecifier(
  state: TransformState,
  importNamespaceSpecifier: t.ImportDefaultSpecifier,
  importSource: string
): void {
  const namespace = importNamespaceSpecifier.local.name;
  if (isGTImportSource(importSource)) {
    state.scopeTracker.addNamespaceImport(namespace);
  } else if (isReactImportSource(importSource)) {
    // TODO: track React import default
    // scopeTracker.addNamespaceImport(namespace);
  }
}

/**
 * Handle import namespace specifiers
 * import * as GT from 'gt-next'
 */
function handleImportNamespaceSpecifier(
  state: TransformState,
  importNamespaceSpecifier: t.ImportNamespaceSpecifier,
  importSource: string
): void {
  const namespace = importNamespaceSpecifier.local.name;
  if (isGTImportSource(importSource)) {
    state.scopeTracker.addNamespaceImport(namespace);
  } else if (isReactImportSource(importSource)) {
    // TODO: track React import namespace
    // scopeTracker.addNamespaceImport(namespace);
  }
}
