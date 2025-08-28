/**
 * Scope Tracker - Handles variable scoping and import tracking
 *
 * Tracks useGT/getGT variable assignments across nested scopes
 * Manages variable shadowing and GT component imports
 */

/**
 * Information about a scope
 */
export interface ScopeInfo {
  /** The scope ID */
  id: number;
  /** The parent scope ID */
  parentId: number;
  /** The depth of the scope */
  depth: number;
}

/**
 * Variable type represents which group the variable belongs to
 */
export type VariableType = 'generaltranslation' | 'react' | 'other';

/**
 * Information about a scoped variable assignment
 */
export interface ScopedVariable {
  /** The scope ID */
  scopeId: number;
  /** The original name of the variable (useGT, getGT, T, etc.) */
  originalName: string;
  /** The variable name (t, translationFunction, etc.) */
  variableName: string;
  /** Whether the variable is a translation function */
  isTranslationFunction: boolean;
  type: VariableType;
  /** The identifier for the variable */
  identifier: number;
}

/**
 * Tracks scope hierarchy and variable assignments within scopes
 */
export class ScopeTracker {
  /** Next scope ID to assign */
  private nextScopeId: number = 1; // Start at 1, reserve 0 for "no scope"
  /** Current scope being processed */
  private currentScope: number = 0;
  /** Stack to track scope nesting for proper exit handling */
  private scopeStack: number[] = [];
  /** Information about each scope */
  private scopeInfo: Map<number, ScopeInfo> = new Map();
  /** Variables tracked per scope */
  private scopedVariables: Map<string, ScopedVariable[]> = new Map();
  /** Namespace imports (e.g., GT from 'gt-next') */
  private namespaceImports: Set<string> = new Set();

  /**
   * Enter a new scope and return the new scope ID
   */
  enterScope(): number {
    const newScopeId = this.nextScopeId;
    this.nextScopeId += 1;

    const scopeInfo: ScopeInfo = {
      id: newScopeId,
      parentId: this.currentScope,
      depth: this.currentScope !== 0 ? this.scopeStack.length + 1 : 0,
    };

    this.scopeInfo.set(newScopeId, scopeInfo);

    // Push current scope to stack
    this.scopeStack.push(this.currentScope);

    this.currentScope = newScopeId;
    return newScopeId;
  }

  /**
   * Exit the current scope and return to parent (with aggressive cleanup)
   */
  exitScope(): void {
    if (this.currentScope !== 0) {
      // Remove all variables from the exiting scope immediately
      for (const [varName, variables] of this.scopedVariables.entries()) {
        // Filter out variables from the current scope
        const filteredVars = variables.filter(
          (variable) => variable.scopeId !== this.currentScope
        );

        if (filteredVars.length === 0) {
          // Remove empty variable name entries
          this.scopedVariables.delete(varName);
        } else {
          this.scopedVariables.set(varName, filteredVars);
        }
      }

      // Get parent scope from the scope info before removing it
      const parentId = this.scopeInfo.get(this.currentScope)?.parentId || 0;

      // Remove scope info for the exiting scope
      this.scopeInfo.delete(this.currentScope);

      // Update current scope to parent
      this.currentScope = parentId;

      // Pop from stack if there are items
      if (this.scopeStack.length > 0) {
        this.scopeStack.pop();
      }
    }
  }

  /**
   * Track a variable assignment in the current scope
   */
  trackVariable(
    variableName: string,
    assignedValue: string,
    isTranslationFunction: boolean,
    type: VariableType,
    identifier: number
  ): void {
    const scopedVar: ScopedVariable = {
      scopeId: this.currentScope,
      originalName: assignedValue,
      variableName: variableName,
      isTranslationFunction,
      type,
      identifier,
    };

    const existingVars = this.scopedVariables.get(variableName) || [];
    existingVars.push(scopedVar);
    this.scopedVariables.set(variableName, existingVars);
  }

  /**
   * Track a translation function variable (convenience method)
   */
  trackTranslationVariable(
    variableName: string,
    functionName: string,
    identifier: number
  ): void {
    this.trackVariable(
      variableName,
      functionName,
      true,
      'generaltranslation',
      identifier
    );
  }

  /**
   * Track react variable
   */
  trackReactVariable(
    variableName: string,
    assignedValue: string,
    identifier: number
  ): void {
    this.trackVariable(variableName, assignedValue, false, 'react', identifier);
  }

  /**
   * Track a non-translation variable (convenience method)
   */
  trackRegularVariable(variableName: string, assignedValue: string): void {
    this.trackVariable(variableName, assignedValue, false, 'other', 0); // 0 because we don't care about the identifier
  }

  /**
   * Find if a variable is accessible in the current scope
   */
  getVariable(variableName: string): ScopedVariable | undefined {
    const variables = this.scopedVariables.get(variableName);
    if (variables && variables.length > 0) {
      // Return the last (most recent) variable - handles shadowing
      return variables[variables.length - 1];
    }
    return undefined;
  }

  /**
   * Get the translation variable info if it exists in current scope
   */
  getTranslationVariable(variableName: string): ScopedVariable | undefined {
    const variable = this.getVariable(variableName);
    return variable && variable.isTranslationFunction ? variable : undefined;
  }

  /**
   * Add a namespace import (e.g., GT from 'gt-next')
   */
  addNamespaceImport(name: string): void {
    this.namespaceImports.add(name);
  }

  /**
   * Check if a namespace import exists
   */
  hasNamespaceImport(name: string): boolean {
    return this.namespaceImports.has(name);
  }

  /**
   * Get scope info for debugging
   */
  getScopeInfo(scopeId: number): ScopeInfo | undefined {
    return this.scopeInfo.get(scopeId) || undefined;
  }
}
