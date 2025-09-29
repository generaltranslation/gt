import * as t from '@babel/types';
import { hashSource } from 'generaltranslation/id';
import traverse from '@babel/traverse';

// Analysis and utilities
import { createDynamicContentWarning } from '../visitor/errors';
import { NodePath } from '@babel/traverse';
import {
  isTranslationComponent,
  isVariableComponent,
  isBranchComponent,
  isTranslationFunction,
  isTranslationFunctionCallback,
  isJsxFunction,
} from '../visitor/analysis';
import {
  extractComponentNameFromJSXCall,
  extractPropFromJSXCall,
} from './jsxUtils';

// Hashing
import { hashJsx } from '../hash/hashJsx';

// Types
import { TransformState } from './types';
import { getAttr } from '../jsxUtils/attributes/getAttr';
import { annotateJsxElement } from '../jsxUtils/annotation/annotateJsxElement';
import { determineComponentType } from '../jsxUtils/determineComponentType';

/**
 * Generate warning message for dynamic function call violations
 * Ported from Rust: create_dynamic_function_warning (lines 15-29)
 */
export function createDynamicFunctionWarning(
  filename?: string,
  functionName?: string,
  violationType?: string
): string {
  if (filename) {
    return `gt-next in ${filename}: ${functionName}() function call uses ${violationType} which prevents proper translation key generation. Use string literals instead.`;
  } else {
    return `gt-next: ${functionName}() function call uses ${violationType} which prevents proper translation key generation. Use string literals instead.`;
  }
}

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

export function trackImportDeclaration(
  state: TransformState,
  importDecl: t.ImportDeclaration,
  shouldTrackDeclaration: (originalName: string) => boolean,
  trackDeclaration: (
    localName: string,
    originalName: string,
    counterId: number
  ) => void,
  trackNamespaceImport: (localName: string) => void
): void {
  // Process named imports: import { T, Var, useGT } from 'gt-next'
  for (const specifier of importDecl.specifiers) {
    if (t.isImportSpecifier(specifier)) {
      // Named import
      const localName = specifier.local.name;
      const originalName =
        specifier.imported && t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : localName;

      // Store the mapping: local_name -> original_name
      if (shouldTrackDeclaration(originalName)) {
        if (state.settings.filename?.endsWith('page.tsx')) {
          console.log(
            '[transform] Tracking translation: import {',
            localName,
            'as',
            originalName,
            '}'
          );
        }
        // Note: Need to implement these methods in ImportTracker
        trackDeclaration(localName, originalName, 0);
      }
    } else if (t.isImportNamespaceSpecifier(specifier)) {
      // Handle namespace imports: import * as GT from 'gt-next'
      trackNamespaceImport(specifier.local.name);
    }
  }
}

/**
 * Process import declarations to track GT imports
 * Ported from Rust: process_gt_import_declaration (lines 252-299)
 */
export function processImportDeclaration(
  path: NodePath<t.ImportDeclaration>,
  state: TransformState
): void {
  const importDecl = path.node;
  const srcValue = importDecl.source.value;

  // Only process gt-next imports
  if (
    srcValue === 'gt-next' ||
    srcValue === 'gt-next/client' ||
    srcValue === 'gt-next/server'
  ) {
    const shouldTrackDeclaration = (originalName: string) =>
      isTranslationComponent(originalName) ||
      isVariableComponent(originalName) ||
      isBranchComponent(originalName) ||
      isTranslationFunction(originalName);

    const trackDeclaration = (
      localName: string,
      originalName: string,
      counterId: number
    ) =>
      state.importTracker.scopeTracker.trackTranslationVariable(
        localName,
        originalName,
        counterId
      );

    trackImportDeclaration(
      state,
      importDecl,
      shouldTrackDeclaration,
      trackDeclaration,
      state.importTracker.namespaceImports.add
    );
  } else if (srcValue === 'react/jsx-dev-runtime') {
    const shouldTrackDeclaration = (originalName: string) =>
      isJsxFunction(originalName);

    const trackDeclaration = (
      localName: string,
      originalName: string,
      counterId: number
    ) =>
      state.importTracker.scopeTracker.trackReactVariable(
        localName,
        originalName,
        counterId
      );

    trackImportDeclaration(
      state,
      importDecl,
      shouldTrackDeclaration,
      trackDeclaration,
      state.importTracker.namespaceImports.add
    );
  }
}

/**
 * Track variable assignments like: const t = useGT()
 * Ported from Rust: track_variable_assignment (lines 580-623)
 */
export function trackVariableAssignment(
  path: NodePath<t.VariableDeclarator>,
  state: TransformState
): void {
  const varDeclarator = path.node;

  if (varDeclarator.init) {
    // Handle simple identifier assignment: const t = useGT()
    if (t.isIdentifier(varDeclarator.id)) {
      const variableName = varDeclarator.id.name;

      if (
        t.isCallExpression(varDeclarator.init) &&
        t.isIdentifier(varDeclarator.init.callee)
      ) {
        if (state.settings.filename?.endsWith('page.tsx')) {
          console.log(
            '[transform] trackVariableAssignment',
            variableName,
            '=',
            varDeclarator.init.callee.name
          );
        }
        // Only direct assignments can be translation functions
        trackFunctionCallAssignment(
          varDeclarator.init.callee.name,
          variableName,
          state
        );
      } else if (
        t.isAwaitExpression(varDeclarator.init) &&
        t.isCallExpression(varDeclarator.init.argument) &&
        t.isIdentifier(varDeclarator.init.argument.callee)
      ) {
        if (state.settings.filename?.endsWith('page.tsx')) {
          console.log(
            '[transform] trackVariableAssignment',
            variableName,
            '= await',
            varDeclarator.init.argument.callee.name
          );
        }
        // Only direct assignments can be translation functions
        trackFunctionCallAssignment(
          varDeclarator.init.argument.callee.name,
          variableName,
          state
        );
      } else {
        // Not a function call, treat as overriding
        trackOverridingVariable(variableName, state);
      }
    } else if (t.isLVal(varDeclarator.id)) {
      // Handle ALL destructuring patterns: const { t } = anything
      const identifiers = extractIdentifiersFromPattern(varDeclarator.id);
      for (const identifier of identifiers) {
        trackOverridingVariable(identifier, state);
      }
    }
  }
}

/**
 * Track function call assignments
 * Ported from Rust: track_function_call_assignment (lines 542-578)
 */
export function trackFunctionCallAssignment(
  calleeName: string,
  variableName: string,
  state: TransformState
): void {
  // Check if the callee is a translation function
  const translationVariable =
    state.importTracker.scopeTracker.getTranslationVariable(calleeName);

  if (translationVariable) {
    // This will be either useGT or getGT, not the alias
    const originalName = translationVariable.canonicalName;

    // Check if its getGT or useGT
    if (isTranslationFunction(originalName)) {
      // Get counter_id
      const counterId = state.stringCollector.incrementCounter();
      // Create a new entry in the string collector for this call
      state.stringCollector.initializeAggregator(counterId);

      // Track translation function using scope system (useGT_callback, getGT_callback)
      state.importTracker.scopeTracker.trackTranslationVariable(
        variableName,
        `${originalName}_callback`,
        counterId
      );

      if (state.settings.filename?.endsWith('page.tsx')) {
        console.log(
          `[transform] trackFunctionCallAssignment - tracked callback [${counterId}]: ${variableName} -> ${originalName}_callback`
        );
      }
    }
  } else {
    // Not a translation function, treat as overriding
    trackOverridingVariable(variableName, state);
  }
}

/**
 * Track overriding variables (ones that shadow existing GT imports)
 */
export function trackOverridingVariable(
  variableName: string,
  state: TransformState
): void {
  if (state.importTracker.scopeTracker.getVariable(variableName)) {
    state.importTracker.scopeTracker.trackRegularVariable(
      variableName,
      'other'
    );
  }
}

/**
 * Extract identifiers from destructuring patterns
 * Ported from Rust: extract_identifiers_from_pattern (lines 465-503)
 */
export function extractIdentifiersFromPattern(pattern: t.LVal): string[] {
  const identifiers: string[] = [];

  if (t.isIdentifier(pattern)) {
    identifiers.push(pattern.name);
  } else if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isObjectProperty(prop)) {
        if (t.isIdentifier(prop.value)) {
          identifiers.push(prop.value.name);
        } else if (t.isLVal(prop.value)) {
          identifiers.push(...extractIdentifiersFromPattern(prop.value));
        }
      } else if (t.isRestElement(prop)) {
        identifiers.push(...extractIdentifiersFromPattern(prop.argument));
      }
    }
  } else if (t.isArrayPattern(pattern)) {
    for (const elem of pattern.elements) {
      if (elem && t.isLVal(elem)) {
        identifiers.push(...extractIdentifiersFromPattern(elem));
      }
    }
  } else if (t.isAssignmentPattern(pattern)) {
    identifiers.push(...extractIdentifiersFromPattern(pattern.left));
  } else if (t.isRestElement(pattern)) {
    identifiers.push(...extractIdentifiersFromPattern(pattern.argument));
  }

  return identifiers;
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
 * Track t() function calls
 * Ported from Rust: track_translation_callback (lines 164-201)
 */
export function trackTranslationCallback(
  callExpr: t.CallExpression,
  stringArg: t.Expression | t.SpreadElement,
  identifier: number,
  state: TransformState
): void {
  // Get the options (second argument)
  const secondArg =
    callExpr.arguments.length > 1 ? callExpr.arguments[1] : undefined;
  const options =
    secondArg && !t.isArgumentPlaceholder(secondArg) ? secondArg : undefined;

  // Get context and id from options
  const { context, id } = extractIdAndContextFromOptions(options);

  // Calculate hash for the call expression
  const { hash } = calculateHashForCallExpr(stringArg, options);

  if (extractStringFromExpr(stringArg)) {
    const message = extractStringFromExpr(stringArg);
    if (hash && message) {
      // Construct the translation content object
      const translationContent = createTranslationContent(
        message,
        hash,
        id,
        context
      );

      // Add the translation content to the string collector
      state.stringCollector.setTranslationContent(
        identifier,
        translationContent
      );

      // Store the t() function call
      const counterId = state.stringCollector.incrementCounter();
      state.stringCollector.initializeAggregator(counterId);

      // Add the message to the string collector for the t() function
      state.stringCollector.setTranslationHash(
        counterId,
        createTranslationHash(hash)
      );
    }
  }
}

/**
 * Helper function to extract string content from expressions
 * Ported from Rust: extract_string_from_expr
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
 * Calculate hash for a call expression
 * Ported from Rust: calculate_hash_for_call_expr (lines 345-377)
 */
export function calculateHashForCallExpr(
  stringArg: t.Expression | t.SpreadElement,
  options: t.Expression | t.SpreadElement | undefined
): { hash?: string; jsonString?: string } {
  // Extract the string content
  const stringContent = extractStringFromExpr(stringArg);
  if (!stringContent) {
    return {};
  }

  // Extract the options content
  const { id, context } = extractIdAndContextFromOptions(options);

  // Construct the sanitized data object matching generaltranslation/id format
  const sanitizedData = {
    source: [stringContent], // JsxChildren expects array of strings/components
    id,
    context,
    dataFormat: 'ICU' as const,
  };

  // Calculate hash using hashSource from generaltranslation/id
  const hash = hashSource(sanitizedData);
  const jsonString = JSON.stringify(sanitizedData);

  return { hash, jsonString };
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
 * Process call expressions to detect t() calls (FIRST PASS - Collection only)
 * Ported from Rust: visit_mut_call_expr (lines 118-142)
 */
export function processCallExpression(
  path: NodePath<t.CallExpression>,
  state: TransformState
): boolean {
  const callExpr = path.node;

  // Get function name from callee - matches Rust get_callee_expr_function_name
  const functionName = getCalleeExprFunctionName(callExpr);
  if (!functionName) {
    return false;
  }

  // Check if this is a tracked translation function call
  const variable = state.importTracker.scopeTracker.getVariable(functionName);
  if (state.settings.filename?.endsWith('page.tsx')) {
    console.log(
      `[transform] functionName: ${functionName}, ${variable?.canonicalName}`
    );
  }

  if (variable && variable.type !== 'other') {
    // Register the useGT/getGT as aggregators on the string collector
    const originalName = variable.canonicalName;
    const identifier = variable.identifier;

    // Detect t() calls (translation function callbacks)
    if (isTranslationFunctionCallback(originalName)) {
      if (callExpr.arguments && callExpr.arguments.length > 0) {
        const firstArg = callExpr.arguments[0];
        if (t.isArgumentPlaceholder(firstArg)) {
          return false;
        }

        // Check for violations
        checkCallExprForViolations(firstArg, functionName, state);

        // Track the t() function call
        trackTranslationCallback(callExpr, firstArg, identifier, state);
      }
    } else if (isJsxFunction(originalName)) {
      // For JSX function, process their children

      // Get the name of the component
      const componentName = extractComponentNameFromJSXCall(callExpr);
      if (!componentName) {
        return false;
      }

      // Map it back to an original name
      const translationVariable =
        state.importTracker.scopeTracker.getTranslationVariable(componentName);
      if (!translationVariable) {
        return false;
      }
      const originalName = translationVariable.canonicalName;
      const identifier = translationVariable.identifier;

      if (isTranslationComponent(originalName)) {
        // Get children
        const children = extractPropFromJSXCall(callExpr, 'children');
        if (!children) {
          return false;
        }

        // Get id & context
        const id = extractPropFromJSXCall(callExpr, 'id');
        const context = extractPropFromJSXCall(callExpr, 'context');

        // TODO: Check for violations

        // Calculate hash
        // TODO: add id & context to options
        // const { hash } = hashExpression(children, undefined);
        // if (!hash) {
        //   return false;
        // }

        // TODO: add to string collector
        // TODO: add to string collector for the t() function
      } else if (isVariableComponent(originalName)) {
      } else if (isBranchComponent(originalName)) {
      } else {
        return false;
      }
    }
  }

  return false; // This is collection pass - no transformations yet
}

/**
 * Process JSX elements to detect GT components and collect content
 * Ported from Rust: (to be implemented)
 */
export function processJSXElement(
  path: NodePath<t.JSXElement>,
  state: TransformState
): boolean {
  const element = path.node;
  const componentType = determineComponentType(element, state.importTracker);
  if (state.settings.filename?.endsWith('page.tsx')) {
    console.log(`[transform] componentType: ${componentType}`);
  }
  if (componentType.isTranslation) {
    state.statistics.jsxElementCount += 1;

    if (state.settings.compileTimeHash) {
      if (state.settings.filename?.endsWith('page.tsx')) {
        console.log(`[transform] processJSXElement: ${element}`);
      }
      trackHashAttributes(path, state);
      return true; // Transformation may be applied later
    }
  }

  return false;
}

/**
 * Track hash attributes on JSX elements
 * Ported from Rust: track_hash_attributes (lines 141-162)
 */
export function trackHashAttributes(
  nodePath: NodePath<t.JSXElement>,
  state: TransformState
): void {
  // Check if hash attribute already exists
  if (!getAttr(nodePath.node, '_hash')) {
    // Strip aliased names from element (<_T> -> <T>)
    const annotatedElement: t.JSXElement = annotateJsxElement(
      nodePath.node,
      state
    );

    // Calculate real hash using AST traversal
    const hash = hashJsx(annotatedElement);

    // Store the translation JSX
    const counterId = state.stringCollector.incrementCounter();
    state.stringCollector.initializeAggregator(counterId);

    // Add the message to the string collector for the JSX element
    if (state.settings.filename?.endsWith('page.tsx')) {
      console.log(`[transform] trackHashAttributes: ${hash}`);
    }
    state.stringCollector.setTranslationJsx(
      counterId,
      createTranslationJsx(hash)
    );
  }
}

// /**
//  * Calculate element hash given an annotated element
//  */
// export function calculateElementHash(element: t.JSXElement, state: TransformState): {
//   hash: string;
// } {
//   // Simplified hash calculation - in full implementation this would use JsxTraversal
//   // to properly traverse the JSX element and extract content like the Rust version
//   const hash = hashJsx(state, element);

//   // Create a simplified data structure for hashing that matches the expected format
//   // In full implementation this would use JsxTraversal to properly extract JSX content
//   // const sanitizedData = {
//   //   source: ['<T>'], // Simplified JSX representation as array of strings
//   //   dataFormat: 'ICU' as const,
//   // };

//   // const hash = hashSource(sanitizedData);
//   // const jsonString = JSON.stringify(sanitizedData);
//   return { hash };
// }

/**
 * Create translation JSX object
 * Ported from Rust: StringCollector::create_translation_jsx
 */
export function createTranslationJsx(hash: string): any {
  return { hash };
}

/**
 * Track function parameter overrides that could shadow variables
 * Ported from Rust: track_parameter_overrides (lines 520-528)
 */
export function trackParameterOverrides(
  path: NodePath<t.Function>,
  state: TransformState
): void {
  const func = path.node;
  const params = func.params || [];

  for (const param of params) {
    if (t.isLVal(param)) {
      const identifiers = extractIdentifiersFromPattern(param);
      for (const identifier of identifiers) {
        trackOverridingVariable(identifier, state);
      }
    }
  }
}

/**
 * Track arrow function parameter overrides
 * Ported from Rust: track_arrow_parameter_overrides (lines 531-539)
 */
export function trackArrowParameterOverrides(
  path: NodePath<t.ArrowFunctionExpression>,
  state: TransformState
): void {
  const arrowFunc = path.node;
  const params = arrowFunc.params || [];

  for (const param of params) {
    if (t.isLVal(param)) {
      const identifiers = extractIdentifiersFromPattern(param);
      for (const identifier of identifiers) {
        trackOverridingVariable(identifier, state);
      }
    }
  }
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
): boolean {
  if (state.settings.filename?.endsWith('page.tsx')) {
    console.log('[gt-unplugin] ===============================');
    console.log('[gt-unplugin]         PASS 2');
    console.log('[gt-unplugin] ===============================');
  }
  // Reset counter for second pass - matches Rust TransformVisitor::new()
  state.stringCollector.resetCounter();

  let hasTransformations = false;

  // Complete second-pass traversal matching Rust Fold trait
  traverse(ast, {
    // Process import declarations to track GT-Next imports (fold_import_decl)
    ImportDeclaration(path) {
      processImportDeclaration(path, state);
    },

    // Process variable declarations to track assignments (fold_var_declarator)
    VariableDeclarator(path) {
      trackVariableAssignment(path, state);
    },

    // Process function calls - inject content arrays and hashes (fold_call_expr)
    CallExpression(callPath: NodePath<t.CallExpression>) {
      const callExpr = callPath.node;

      const functionName = getCalleeExprFunctionName(callExpr);
      if (functionName) {
        const translationVariable =
          state.importTracker.scopeTracker.getTranslationVariable(functionName);

        if (state.settings.filename?.endsWith('page.tsx')) {
          console.log(
            `[transform] callExpression: ${functionName}`,
            translationVariable
          );
        }

        if (translationVariable) {
          const originalName = translationVariable.canonicalName;

          // Detect useGT/getGT calls - inject content arrays
          if (isTranslationFunction(originalName)) {
            const modifiedCallExpr = injectContentArrayOnTranslationFunction(
              callExpr,
              state
            );
            if (state.settings.filename?.endsWith('page.tsx')) {
              console.log(
                `[transform] inject content array: ${originalName} ${modifiedCallExpr}`
              );
            }
            if (modifiedCallExpr) {
              callPath.replaceWith(modifiedCallExpr);
              hasTransformations = true;
              return;
            }
          }
          // Detect t() calls - inject hash attributes
          else if (isTranslationFunctionCallback(originalName)) {
            const modifiedCallExpr = injectHashOnTranslationFunction(
              callExpr,
              state
            );
            if (modifiedCallExpr) {
              callPath.replaceWith(modifiedCallExpr);
              hasTransformations = true;
              return;
            }
          }
        }
      }
    },

    // Process JSX attributes - matches Rust fold_jsx_attr
    JSXAttribute(jsxPath) {
      // TODO: Implement JSX attribute traversal state management
      // This should track in_jsx_attribute state like Rust version
    },

    // Process JSX elements - inject hash attributes (fold_jsx_element)
    JSXElement(jsxPath: NodePath<t.JSXElement>) {
      const element = jsxPath.node;
      state.statistics.jsxElementCount += 1;

      // TODO: Implement full traversal state management like Rust
      // Save state, determine context, inject attributes, restore state
      const componentType = determineComponentType(
        element,
        state.importTracker
      );

      // Inject hash attributes on translation components
      if (state.settings.compileTimeHash && componentType.isTranslation) {
        const modifiedElement = injectHashAttributes(element, state);
        if (modifiedElement) {
          jsxPath.replaceWith(modifiedElement);
          hasTransformations = true;
        }
      }
    },

    // Scope management - matches Rust fold_* methods
    BlockStatement: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    Function: {
      enter(path) {
        state.importTracker.enterScope();
        trackParameterOverrides(path, state);
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    ArrowFunctionExpression: {
      enter(path) {
        state.importTracker.enterScope();
        trackArrowParameterOverrides(path, state);
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    // Missing from Rust Fold - function expressions
    FunctionExpression: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    // Additional scope-creating constructs from Rust
    ClassDeclaration: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    // Missing from Rust Fold - method definitions
    ClassMethod: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    ObjectMethod: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    ForStatement: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    ForInStatement: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    ForOfStatement: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    CatchClause: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    WhileStatement: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },

    SwitchStatement: {
      enter(_path) {
        state.importTracker.enterScope();
      },
      exit(_path) {
        state.importTracker.exitScope();
      },
    },
  });
  return hasTransformations;
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
