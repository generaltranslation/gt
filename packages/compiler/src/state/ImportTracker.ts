/**
 * Import tracking utilities for GT components
 */

import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { ScopeTracker } from './ScopeTracker';
import {
  isTranslationComponent,
  isVariableComponent,
  isBranchComponent,
  isTranslationFunction,
} from '../utils/constants/gt/helpers';

/**
 * Import tracker for GT components and functions
 * TODO: what if someone has a namespace that overrides the imported namespace?
 */
export class ImportTracker {
  /** Scope tracker for tracking variables */
  public scopeTracker: ScopeTracker = new ScopeTracker();
  /** Namespace imports (e.g., GT from 'gt-next') */
  public namespaceImports: Set<string> = new Set();

  /**
   * Process GT-Next import declarations to track imports and aliases
   */
  // processGTImportDeclaration(path: NodePath<t.ImportDeclaration>): void {
  //   const importDecl = path.node;
  //   const srcValue = importDecl.source.value;

  //   // Only process GT imports
  //   if (!['gt-next', 'gt-next/client', 'gt-next/server'].includes(srcValue)) {
  //     return;
  //   }

  //   // Process each import specifier
  //   for (const specifier of importDecl.specifiers) {
  //     if (t.isImportSpecifier(specifier)) {
  //       // Handle named imports: import { T, Var, useGT } from 'gt-next'
  //       const localName = specifier.local.name;
  //       const originalName = t.isIdentifier(specifier.imported)
  //         ? specifier.imported.name
  //         : specifier.imported.value;

  //       // Store the mapping: localName -> originalName
  //       if (
  //         isTranslationComponent(originalName) ||
  //         isVariableComponent(originalName) ||
  //         isBranchComponent(originalName) ||
  //         isTranslationFunction(originalName)
  //       ) {
  //         console.log(
  //           `[import-tracker] tracking import {${localName} as ${originalName}} from 'gt-next';`
  //         );
  //         this.scopeTracker.trackTranslationVariable(
  //           localName,
  //           originalName,
  //           0 // We don't care about the identifier for imports
  //         );
  //       }
  //     } else if (t.isImportNamespaceSpecifier(specifier)) {
  //       // Handle namespace imports: import * as GT from 'gt-next'
  //       this.namespaceImports.add(specifier.local.name);
  //     }
  //   }
  // }

  /**
   * Check if we should track this component as a translation component
   */
  shouldTrackComponentAsTranslation(name: string): boolean {
    const variable = this.scopeTracker.getTranslationVariable(name);
    if (variable && isTranslationComponent(variable.canonicalName)) {
      return true;
    }
    return false;
  }

  /**
   * Check if we should track this component as a variable component
   */
  shouldTrackComponentAsVariable(name: string): boolean {
    const variable = this.scopeTracker.getVariable(name);
    if (variable && isVariableComponent(variable.canonicalName)) {
      return true;
    }
    return false;
  }

  /**
   * Check if we should track this component as a branch component
   */
  shouldTrackComponentAsBranch(name: string): boolean {
    const variable = this.scopeTracker.getVariable(name);
    if (variable && isBranchComponent(variable.canonicalName)) {
      return true;
    }
    return false;
  }

  /**
   * Check if we should track a namespace component (GT.T, GT.Var, etc.)
   */
  shouldTrackNamespaceComponent(
    objName: string,
    propName: string
  ): [boolean, boolean, boolean] {
    if (this.namespaceImports.has(objName)) {
      const isTranslation = isTranslationComponent(propName);
      const isVariable = isVariableComponent(propName);
      const isBranch = isBranchComponent(propName);
      return [isTranslation, isVariable, isBranch];
    }
    return [false, false, false];
  }

  /**
   * Enter a new scope (delegate to scope tracker)
   */
  enterScope(): number {
    return this.scopeTracker.enterScope();
  }

  /**
   * Exit the current scope (delegate to scope tracker)
   */
  exitScope(): void {
    this.scopeTracker.exitScope();
  }

  /**
   * Helper convert to string
   */
  serialize(): any {
    return {
      scopeTracker: this.scopeTracker.serialize(),
      namespaceImports: Array.from(this.namespaceImports),
    };
  }

  /**
   * Helper to repopulate
   */
  unserialize(input: any): void {
    this.scopeTracker.unserialize(input.scopeTracker);
    this.namespaceImports = input.namespaceImports;
  }
}

/**
 * Process GT-Next import declarations to track imports and aliases
 * (standalone function for backward compatibility)
 */
// export function processGTImportDeclaration(
//   path: NodePath<t.ImportDeclaration>,
//   importTracker: ImportTracker
// ): void {
//   importTracker.processGTImportDeclaration(path);
// }
