import * as t from '@babel/types';
import { isGTImportSource } from '../../utils/constants/gt/helpers';
import { ScopeTracker } from '../../state/ScopeTracker';
import { GT_ALL_FUNCTIONS } from '../../utils/constants/gt/constants';
import { isReactImportSource } from '../../utils/constants/react/helpers';

/**
 * Track import declarations for GT and React e.g. import { T, Var, useGT } from 'gt-next'
 * @param scopeTracker - Scope tracker to track variables
 * @param importSource - Import source e.g. 'gt-next' or 'react/jsx-dev-runtime'
 * @param importDecl - Import declaration to track
 */
export function trackImportDeclaration(
  scopeTracker: ScopeTracker,
  importSource: string,
  importDecl: t.ImportDeclaration
): void {
  for (const specifier of importDecl.specifiers) {
    if (t.isImportSpecifier(specifier)) {
      handleImportSpecifier(scopeTracker, specifier, importSource);
    } else if (t.isImportDefaultSpecifier(specifier)) {
      handleImportDefaultSpecifier(scopeTracker, specifier, importSource);
    } else {
      handleImportNamespaceSpecifier(scopeTracker, specifier, importSource);
    }
  }
}

/**
 * Handle import specifiers
 * import { T, Var, useGT } from 'gt-next'
 */
function handleImportSpecifier(
  scopeTracker: ScopeTracker,
  importSpecifier: t.ImportSpecifier,
  importSource: string
): void {
  const alias = importSpecifier.local.name;
  const originalName = t.isIdentifier(importSpecifier.imported)
    ? importSpecifier.imported.name
    : importSpecifier.imported.value;
  if (isGTImportSource(importSource)) {
    scopeTracker.trackTranslationVariable(
      alias,
      originalName as GT_ALL_FUNCTIONS,
      0
    );
  } else if (isReactImportSource(importSource)) {
    scopeTracker.trackReactVariable(alias, originalName, 0);
  }
}

/**
 * Handle import default specifiers
 * import GT from 'gt-next'
 */
function handleImportDefaultSpecifier(
  scopeTracker: ScopeTracker,
  importNamespaceSpecifier: t.ImportDefaultSpecifier,
  importSource: string
): void {
  const namespace = importNamespaceSpecifier.local.name;
  if (isGTImportSource(importSource)) {
    scopeTracker.addNamespaceImport(namespace);
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
  scopeTracker: ScopeTracker,
  importNamespaceSpecifier: t.ImportNamespaceSpecifier,
  importSource: string
): void {
  const namespace = importNamespaceSpecifier.local.name;
  if (isGTImportSource(importSource)) {
    scopeTracker.addNamespaceImport(namespace);
  } else if (isReactImportSource(importSource)) {
    // TODO: track React import namespace
    // scopeTracker.addNamespaceImport(namespace);
  }
}
