import { TransformState } from '../transform/types';
import {
  isBranchComponent,
  isTranslationComponent,
  isVariableComponent,
} from '../visitor/analysis';
import * as t from '@babel/types';
import { ScopeTracker } from '../visitor/scope-tracker';
import { ImportTracker } from '../visitor/import-tracker';
import { GT_COMPONENT_TYPES } from '../constants';

/**
 * Check if we should track this component based on imports or known components
 */
function shouldTrackComponentAsTranslation(
  name: string,
  scopeTracker: ScopeTracker
): boolean {
  const translationVariable = scopeTracker.getTranslationVariable(name);
  if (
    translationVariable &&
    isTranslationComponent(translationVariable.canonicalName)
  ) {
    return true;
  }
  return false;
}

/**
 * Check if we should track this component as a variable component
 */
function shouldTrackComponentAsVariable(
  name: string,
  scopeTracker: ScopeTracker
): boolean {
  const variable = scopeTracker.getVariable(name);
  if (variable && isVariableComponent(variable.canonicalName)) {
    return true;
  }
  return false;
}

/**
 * Check if we should track this component as a branch component
 */
function shouldTrackComponentAsBranch(
  name: string,
  scopeTracker: ScopeTracker
): boolean {
  const branchVariable = scopeTracker.getVariable(name);
  if (branchVariable && isBranchComponent(branchVariable.canonicalName)) {
    return true;
  }
  return false;
}

/**
 * Check if we should track a namespace component (GT.T, GT.Var, etc.)
 */
function shouldTrackNamespaceComponent(
  obj: string,
  prop: string,
  namespaceImports: Set<string>
): { isTranslation: boolean; isVariable: boolean; isBranch: boolean } {
  if (namespaceImports.has(obj)) {
    const isTranslation = isTranslationComponent(prop);
    const isVariable = isVariableComponent(prop);
    const isBranch = isBranchComponent(prop);
    return { isTranslation, isVariable, isBranch };
  }
  return { isTranslation: false, isVariable: false, isBranch: false };
}

/**
 * Determine component type from JSX element
 */
export function determineComponentType(
  element: t.JSXElement,
  importTracker: ImportTracker
): { isTranslation: boolean; isVariable: boolean; isBranch: boolean } {
  const elementName = element.openingElement.name;
  const scopeTracker = importTracker.scopeTracker;
  const namespaceImports = importTracker.namespaceImports;

  if (t.isJSXIdentifier(elementName)) {
    const name = elementName.name;
    const isTranslation = shouldTrackComponentAsTranslation(name, scopeTracker);
    const isVariable = shouldTrackComponentAsVariable(name, scopeTracker);
    const isBranch = shouldTrackComponentAsBranch(name, scopeTracker);
    return { isTranslation, isVariable, isBranch };
  } else if (t.isJSXMemberExpression(elementName)) {
    if (
      t.isJSXIdentifier(elementName.object) &&
      t.isJSXIdentifier(elementName.property)
    ) {
      const objName = elementName.object.name;
      const propName = elementName.property.name;
      return shouldTrackNamespaceComponent(objName, propName, namespaceImports);
    }
  }

  return { isTranslation: false, isVariable: false, isBranch: false };
}

/**
 * Looks up the component name as an alias to resolve canonical component name
 * @param element - The JSX element to look up the component type for
 * @param importTracker - The import tracker to use to look up the component type
 * @returns The component type or null if the component type is not found
 *
 * Will only return the name for gt components, other components will return null
 */
export function getComponentType(
  element: t.JSXElement,
  importTracker: ImportTracker
): GT_COMPONENT_TYPES | null {
  // Get the element name, eg T from <T>, GT.T from <GT.T>, etc., but wrapped
  const elementName = element.openingElement.name;

  if (t.isJSXIdentifier(elementName)) {
    // Get the string name, eg T from <T>
    const name = elementName.name;

    // Look up the canonical component name via the scope tracker
    const canonicalName =
      importTracker.scopeTracker.getTranslationVariable(name);
  } else if (
    t.isJSXMemberExpression(elementName) &&
    t.isJSXIdentifier(elementName.object) &&
    t.isJSXIdentifier(elementName.property)
  ) {
    const objName = elementName.object.name;
    const propName = elementName.property.name;

    // Check if the objec is GT namespace import
    if (!importTracker.namespaceImports.has(objName)) {
      return null;
    }

    // Look up the alias via the scope tracker
  }
}
