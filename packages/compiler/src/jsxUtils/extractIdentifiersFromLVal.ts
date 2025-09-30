import * as t from '@babel/types';

/**
 * Extract identifiers from destructuring patterns
 */
export function extractIdentifiersFromLVal(pattern: t.LVal): string[] {
  const identifiers: string[] = [];
  // Get all variables from the LVal
  // ignore: MemberExpression | TSAsExpression | TSSatisfiesExpression | TSTypeAssertion | TSNonNullExpression
  if (t.isIdentifier(pattern)) {
    // Handle identifier: const t;
    identifiers.push(pattern.name);
  } else if (t.isRestElement(pattern)) {
    // Handle rest element: const { ...rest } = anything
    identifiers.push(...extractIdentifiersFromLVal(pattern.argument));
  } else if (t.isAssignmentPattern(pattern)) {
    // Handle assignment pattern: const { t } = anything
    identifiers.push(...extractIdentifiersFromLVal(pattern.left));
  } else if (t.isArrayPattern(pattern)) {
    // Handle array pattern: const [t, ...rest] = anything
    identifiers.push(...handleArrayPattern(pattern));
  } else if (t.isObjectPattern(pattern)) {
    // Handle object pattern: const { t, ...rest } = anything
    identifiers.push(...handleObjectPattern(pattern));
  } else if (t.isTSParameterProperty(pattern)) {
    // Handle TS parameter property: const { t }: { t: string } = anything
    identifiers.push(...extractIdentifiersFromLVal(pattern.parameter));
  }
  return identifiers;
}

/* =============================== */
/* Helper Functions */
/* =============================== */

/**
 * Handle object pattern: const { t } = anything
 */
function handleObjectPattern(pattern: t.ObjectPattern): string[] {
  const identifiers: string[] = [];
  for (const prop of pattern.properties) {
    if (t.isObjectProperty(prop)) {
      // LVal: const { t } = anything
      if (t.isLVal(prop.value)) {
        identifiers.push(...extractIdentifiersFromLVal(prop.value));
      }
      // Ignore Expressions, VoidPattern
    } else {
      // Rest element: const { ...rest } = anything
      identifiers.push(...extractIdentifiersFromLVal(prop.argument));
    }
  }
  return identifiers;
}

/**
 * Handle ArrayPattern: const [t, ...rest] = anything
 */
function handleArrayPattern(pattern: t.ArrayPattern): string[] {
  const identifiers: string[] = [];
  for (const elem of pattern.elements) {
    if (elem && t.isLVal(elem)) {
      identifiers.push(...extractIdentifiersFromLVal(elem));
    }
  }
  return identifiers;
}