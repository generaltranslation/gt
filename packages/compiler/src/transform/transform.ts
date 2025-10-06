import * as t from '@babel/types';
import traverse from '@babel/traverse';

// Analysis and utilities
import { NodePath } from '@babel/traverse';
import {
  isTranslationFunction,
  isTranslationFunctionCallback,
} from '../utils/constants/gt/helpers';
// Types
import { TransformState } from '../state/types';
import { createDynamicFunctionWarning } from '../utils/errors';
import { basePass } from '../passes/basePass';
import { processVariableDeclarator } from '../processing/second-pass/processVariableDeclarator';
import { processCallExpression } from '../processing/second-pass/processCallExpression';
/**
 * Helper function to get callee function name
 * Ported from Rust: get_callee_expr_function_name
 */
export function getCalleeExprFunctionName(
  callExpr: t.CallExpression
): string | null {
  if (t.isIdentifier(callExpr.callee)) {
    return callExpr.callee.name;
  }
  return null;
}

/**
 * Check for violations in a call expression
 * Ported from Rust: check_call_expr_for_violations (lines 302-343)
 */
export function checkCallExprForViolations(
  arg: t.Expression | t.SpreadElement,
  functionName: string,
  state: TransformState
): void {
  const expr = t.isSpreadElement(arg) ? arg.argument : arg;

  if (t.isTemplateLiteral(expr)) {
    // Template literals: t(`Hello ${name}`)
    if (expr.expressions.length > 0 && !state.settings.disableBuildChecks) {
      state.statistics.dynamicContentViolations += 1;
      const warning = createDynamicFunctionWarning(
        state.settings.filename,
        functionName,
        'template literals'
      );
      state.logger.logError(warning);
    }
  } else if (t.isBinaryExpression(expr)) {
    // String concatenation: t("Hello " + name)
    if (expr.operator === '+') {
      // Check if it's string concatenation (at least one side is a string)
      const leftIsString =
        t.isStringLiteral(expr.left) ||
        (t.isLiteral(expr.left) &&
          'value' in expr.left &&
          typeof expr.left.value === 'string');
      const rightIsString =
        t.isStringLiteral(expr.right) ||
        (t.isLiteral(expr.right) &&
          'value' in expr.right &&
          typeof expr.right.value === 'string');

      if (leftIsString || rightIsString) {
        if (!state.settings.disableBuildChecks) {
          state.statistics.dynamicContentViolations += 1;
          const warning = createDynamicFunctionWarning(
            state.settings.filename,
            functionName,
            'string concatenation'
          );
          state.logger.logError(warning);
        }
      }
    }
  }
  // Valid usage (string literal, variable, etc.) - no action needed
}

/**
 * Helper function to extract string content from expressions
 */
export function extractStringFromExpr(
  expr: t.Expression | t.SpreadElement
): string | null {
  if (t.isStringLiteral(expr)) {
    return expr.value;
  }
  if (t.isLiteral(expr) && 'value' in expr && typeof expr.value === 'string') {
    return expr.value;
  }
  return null;
}

/**
 * Helper function to extract id and context from options
 * Ported from Rust: extract_id_and_context_from_options
 */
export function extractIdAndContextFromOptions(
  options: t.Expression | t.SpreadElement | undefined
): {
  context?: string;
  id?: string;
} {
  if (!options || !t.isObjectExpression(options)) {
    return {};
  }

  let context: string | undefined;
  let id: string | undefined;

  for (const prop of options.properties) {
    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
      if (prop.key.name === 'context' && t.isStringLiteral(prop.value)) {
        context = prop.value.value;
      } else if (
        prop.key.name === 'context' &&
        t.isLiteral(prop.value) &&
        'value' in prop.value &&
        typeof prop.value.value === 'string'
      ) {
        context = prop.value.value;
      } else if (prop.key.name === 'id' && t.isStringLiteral(prop.value)) {
        id = prop.value.value;
      } else if (
        prop.key.name === 'id' &&
        t.isLiteral(prop.value) &&
        'value' in prop.value &&
        typeof prop.value.value === 'string'
      ) {
        id = prop.value.value;
      }
    }
  }

  return { context, id };
}

/**
 * Create translation content object
 * Ported from Rust: StringCollector::create_translation_content
 */
export function createTranslationContent(
  message: string,
  hash: string,
  id?: string,
  context?: string
): any {
  return {
    message,
    hash,
    id,
    context,
  };
}

/**
 * Create translation hash object
 * Ported from Rust: StringCollector::create_translation_hash
 */
export function createTranslationHash(hash: string): any {
  return { hash };
}

/**
 * Perform the second pass transformation using collected data
 * Ported from Rust: lib.rs Fold trait implementation (lines 195-351)
 *
 * This is a complete Fold-style traversal that processes the entire AST
 * and applies transformations based on collected data from the first pass.
 */
export function performSecondPassTransformation(
  ast: t.File,
  state: TransformState
): void {
  if (state.settings.filename?.endsWith('page.tsx')) {
    console.log('[GT_PLUGIN] ===============================');
    console.log('[GT_PLUGIN]         PASS 2');
    console.log('[GT_PLUGIN] ===============================');
  }
  // Reset counter for second pass - matches Rust TransformVisitor::new()
  state.stringCollector.resetCounter();

  // Complete second-pass traversal matching Rust Fold trait
  traverse(ast, {
    ...basePass(state),
    // const gt = useGT();
    CallExpression: processCallExpression(state),
    // let T = ...
    VariableDeclarator: processVariableDeclarator(state),

    // // Process function calls - inject content arrays and hashes (fold_call_expr)
    // CallExpression(callPath: NodePath<t.CallExpression>) {
    //   const callExpr = callPath.node;

    //   const functionName = getCalleeExprFunctionName(callExpr);
    //   if (functionName) {
    //     const translationVariable =
    //       state.importTracker.scopeTracker.getTranslationVariable(functionName);

    //     if (translationVariable) {
    //       const originalName = translationVariable.canonicalName;

    //       // Detect useGT/getGT calls - inject content arrays
    //       if (isTranslationFunction(originalName)) {
    //         const modifiedCallExpr = injectContentArrayOnTranslationFunction(
    //           callExpr,
    //           state
    //         );
    //         if (modifiedCallExpr) {
    //           callPath.replaceWith(modifiedCallExpr);
    //           hasTransformations = true;
    //           return;
    //         }
    //       }
    //       // Detect t() calls - inject hash attributes
    //       else if (isTranslationFunctionCallback(originalName)) {
    //         const modifiedCallExpr = injectHashOnTranslationFunction(
    //           callExpr,
    //           state
    //         );
    //         if (modifiedCallExpr) {
    //           callPath.replaceWith(modifiedCallExpr);
    //           hasTransformations = true;
    //           return;
    //         }
    //       }
    //     }
    //   }
    // },

    // // Process JSX attributes - matches Rust fold_jsx_attr
    // JSXAttribute(jsxPath) {
    //   // TODO: Implement JSX attribute traversal state management
    //   // This should track in_jsx_attribute state like Rust version
    // },

    // // Process JSX elements - inject hash attributes (fold_jsx_element)
    // JSXElement(jsxPath: NodePath<t.JSXElement>) {
    //   const element = jsxPath.node;
    //   state.statistics.jsxElementCount += 1;

    //   // TODO: Implement full traversal state management like Rust
    //   // Save state, determine context, inject attributes, restore state
    //   const componentType = determineComponentType(
    //     element,
    //     state.importTracker
    //   );

    //   // Inject hash attributes on translation components
    //   if (state.settings.compileTimeHash && componentType.isTranslation) {
    //     const modifiedElement = injectHashAttributes(element, state);
    //     if (modifiedElement) {
    //       jsxPath.replaceWith(modifiedElement);
    //       hasTransformations = true;
    //     }
    //   }
    // },
  });
}

/**
 * Inject content array on translation function calls (useGT/getGT)
 * Ported from Rust: inject_content_array_on_translation_function_call (lines 95-112)
 */
export function injectContentArrayOnTranslationFunction(
  callExpr: t.CallExpression,
  state: TransformState
): t.CallExpression | null {
  const counterId = state.stringCollector.getCounter();
  const content = state.stringCollector.getTranslationData(counterId);

  if (content && content.content.length > 0) {
    // Create the content array using Babel types
    const contentArrayElements = content.content.map((item) => {
      const properties: t.ObjectProperty[] = [
        t.objectProperty(
          t.identifier('message'),
          t.stringLiteral(item.message)
        ),
        t.objectProperty(t.identifier('$_hash'), t.stringLiteral(item.hash)),
      ];

      if (item.id) {
        properties.push(
          t.objectProperty(t.identifier('$id'), t.stringLiteral(item.id))
        );
      }
      if (item.context) {
        properties.push(
          t.objectProperty(
            t.identifier('$context'),
            t.stringLiteral(item.context)
          )
        );
      }

      return t.objectExpression(properties);
    });

    const contentArray = t.arrayExpression(contentArrayElements);

    // Check for existing content
    if (!callExpr.arguments || callExpr.arguments.length === 0) {
      // Create new call expression with content array as first argument
      return t.callExpression(t.cloneNode(callExpr.callee), [contentArray]);
    }
  }

  return null;
}

/**
 * Inject hash on translation function calls (t() calls)
 * Ported from Rust: inject_hash_attributes_on_translation_function_call (lines 114-139)
 */
export function injectHashOnTranslationFunction(
  callExpr: t.CallExpression,
  state: TransformState
): t.CallExpression | null {
  if (callExpr.arguments && callExpr.arguments.length > 0) {
    // Get the hash from the string collector
    const counterId = state.stringCollector.getCounter();
    const translationHash = state.stringCollector.getTranslationHash(counterId);

    if (translationHash) {
      // Create new call expression with hash injected
      return createCallExpressionWithHash(callExpr, translationHash.hash);
    }
  }
  return null;
}

/**
 * Inject hash attributes on translation components
 * Ported from Rust: inject_hash_attributes (lines 74-92)
 */
export function injectHashAttributes(
  element: t.JSXElement,
  state: TransformState
): t.JSXElement | null {
  // Get the hash from the string collector
  const counterId = state.stringCollector.getCounter();
  const translationJsx = state.stringCollector.getTranslationJsx(counterId);

  if (translationJsx) {
    // Create new element with hash attribute
    return createJSXElementWithHash(element, translationJsx.hash);
  }
  return null;
}

/**
 * Create call expression with hash in options
 * Based on Rust implementation
 */
export function createCallExpressionWithHash(
  callExpr: t.CallExpression,
  hash: string
): t.CallExpression {
  const hashProperty = t.objectProperty(
    t.identifier('$_hash'),
    t.stringLiteral(hash)
  );

  // Add hash to options object (second argument)
  if (callExpr.arguments.length === 1) {
    // Create new options object with hash
    const optionsObject = t.objectExpression([hashProperty]);
    return t.callExpression(t.cloneNode(callExpr.callee), [
      t.cloneNode(callExpr.arguments[0]),
      optionsObject,
    ]);
  } else if (callExpr.arguments.length > 1) {
    // Merge with existing options
    const existingOptions = callExpr.arguments[1];
    if (t.isObjectExpression(existingOptions)) {
      const newProperties = [
        ...existingOptions.properties.map((prop) => t.cloneNode(prop)),
        hashProperty,
      ];
      const newOptions = t.objectExpression(newProperties);
      return t.callExpression(t.cloneNode(callExpr.callee), [
        t.cloneNode(callExpr.arguments[0]),
        newOptions,
        ...callExpr.arguments.slice(2).map((arg) => t.cloneNode(arg)),
      ]);
    }
  }

  // Fallback: return original if we can't modify
  return callExpr;
}

/**
 * Create JSX element with hash attribute
 * Based on Rust implementation
 */
export function createJSXElementWithHash(
  element: t.JSXElement,
  hash: string
): t.JSXElement {
  // Create the _hash attribute using proper Babel types
  const hashAttribute = t.jsxAttribute(
    t.jsxIdentifier('_hash'),
    t.stringLiteral(hash)
  );

  // Clone existing attributes and add the hash attribute
  const existingAttributes = element.openingElement.attributes.map((attr) =>
    t.cloneNode(attr)
  );
  const newAttributes = [...existingAttributes, hashAttribute];

  // Create new opening element with updated attributes
  const newOpeningElement = t.jsxOpeningElement(
    t.cloneNode(element.openingElement.name),
    newAttributes,
    element.openingElement.selfClosing
  );

  // Create new JSX element
  return t.jsxElement(
    newOpeningElement,
    element.closingElement ? t.cloneNode(element.closingElement) : null,
    element.children.map((child) => t.cloneNode(child)),
    element.selfClosing
  );
}
