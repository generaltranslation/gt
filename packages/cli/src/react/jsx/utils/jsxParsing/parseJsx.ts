import { Updates } from '../../../../types/index.js';
import { randomUUID } from 'node:crypto';
import generateModule from '@babel/generator';
// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

import * as t from '@babel/types';
import fs from 'node:fs';
import { parse } from '@babel/parser';
import addGTIdentifierToSyntaxTree from './addGTIdentifierToSyntaxTree.js';
import {
  warnHasUnwrappedExpressionSync,
  warnNestedTComponent,
  warnFunctionNotFoundSync,
  warnMissingReturnSync,
  warnDuplicateFunctionDefinitionSync,
  warnInvalidStaticInitSync,
  warnRecursiveFunctionCallSync,
} from '../../../../console/index.js';
import { isAcceptedPluralForm, JsxChildren } from 'generaltranslation/internal';
import { isStaticExpression } from '../../evaluateJsx.js';
import {
  STATIC_COMPONENT,
  TRANSLATION_COMPONENT,
  VARIABLE_COMPONENTS,
} from '../constants.js';
import { Metadata, HTML_CONTENT_PROPS } from 'generaltranslation/types';
import { NodePath } from '@babel/traverse';
import { ParsingConfigOptions } from '../../../../types/parsing.js';
import { resolveImportPath } from '../resolveImportPath.js';

import traverseModule from '@babel/traverse';
import { buildImportMap } from '../buildImportMap.js';
import { getPathsAndAliases } from '../getPathsAndAliases.js';
import { parseTProps } from './parseTProps.js';
import { handleChildrenWhitespace } from './handleChildrenWhitespace.js';
import { MultiplicationNode, JsxTree, isElementNode } from './types.js';
import { multiplyJsxTree } from './multiplication/multiplyJsxTree.js';
import { removeNullChildrenFields } from './removeNullChildrenFields.js';
import { GTLibrary } from '../constants.js';
import path from 'node:path';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

// For tracking static
type StaticTracker = {
  isStatic: boolean;
};

/**
 * Immutable configuration options for parsing.
 */
type ConfigOptions = {
  parsingOptions: ParsingConfigOptions;
  importAliases: Record<string, string>;
  pkgs: GTLibrary[];
  file: string;
};

/**
 * Mutable state for tracking parsing progress.
 */
type StateTracker = {
  visited: Set<string> | null;
  callStack: string[];
  staticTracker: StaticTracker;
  importedFunctionsMap: Map<string, string>;
};

/**
 * Collectors for errors, warnings, and unwrapped expressions.
 */
type OutputCollector = {
  errors: string[];
  warnings: Set<string>;
  unwrappedExpressions: string[];
};

// TODO: currently we cover VariableDeclaration and FunctionDeclaration nodes, but are there others we should cover as well?

/**
 * Cache for resolved import paths to avoid redundant I/O operations.
 * Key: `${currentFile}::${importPath}`
 * Value: resolved absolute path or null
 */
const resolveImportPathCache = new Map<string, string | null>();

/**
 * Cache for processed functions to avoid re-parsing the same files.
 * Key: `${filePath}::${functionName}::${argIndex}`
 * Value: boolean indicating whether the function was found and processed
 */
const processFunctionCache = new Map<string, MultiplicationNode | null>();

/**
 * Entry point for JSX parsing
 */
export function parseTranslationComponent({
  originalName,
  importAliases,
  localName,
  path,
  updates,
  errors,
  warnings,
  file,
  parsingOptions,
  pkgs,
}: {
  ast: any;
  pkgs: GTLibrary[];
  originalName: string;
  importAliases: Record<string, string>;
  path: traverseModule.NodePath<traverseModule.Node>;
  localName: string;
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
  file: string;
  parsingOptions: ParsingConfigOptions;
}) {
  // First, collect all imports in this file to track cross-file function calls
  const importedFunctionsMap: Map<string, string> = buildImportMap(
    path.scope.getProgramParent().path
  );
  const referencePaths = path.scope.bindings[localName]?.referencePaths || [];
  for (const refPath of referencePaths) {
    // Only start at opening tag
    if (
      !t.isJSXOpeningElement(refPath.parent) ||
      !refPath.parentPath?.parentPath
    ) {
      continue;
    }

    // Get the JSX element NodePath
    const jsxElementPath = refPath.parentPath
      ?.parentPath as NodePath<t.JSXElement>;

    // Parse <T> component
    parseJSXElement({
      scopeNode: jsxElementPath,
      node: jsxElementPath.node,
      pkgs,
      originalName,
      importAliases,
      updates,
      errors,
      warnings,
      file,
      parsingOptions,
      importedFunctionsMap,
    });
  }
}

/**
 * Builds a JSX tree from a given node, recursively handling children.
 * @param node - The node to build the tree from
 * @param helperPath - NodePath for AST traversal
 * @param scopeNode - Scope node for binding resolution
 * @param insideT - Whether the current node is inside a <T> component
 * @param inStatic - Whether we're inside a Static component
 * @param config - Immutable configuration options
 * @param state - Mutable state tracking
 * @param output - Error/warning collectors
 * @returns The built JSX tree
 */
function buildJSXTree({
  node,
  helperPath,
  scopeNode,
  insideT,
  inStatic,
  config,
  state,
  output,
}: {
  node: any;
  helperPath: NodePath;
  scopeNode: NodePath;
  insideT: boolean;
  inStatic: boolean;
  config: ConfigOptions;
  state: StateTracker;
  output: OutputCollector;
}): JsxTree | MultiplicationNode {
  if (t.isJSXExpressionContainer(node)) {
    // Skip JSX comments
    if (t.isJSXEmptyExpression(node.expression)) {
      return null;
    }

    if (inStatic) {
      return processStaticExpression({
        config,
        state,
        output,
        expressionNodePath: helperPath.get(
          'expression'
        ) as NodePath<t.Expression>,
        scopeNode,
      });
    }

    const expr = node.expression;
    if (t.isJSXElement(expr) || t.isJSXFragment(expr)) {
      return buildJSXTree({
        node: expr,
        insideT,
        inStatic,
        scopeNode,
        helperPath: helperPath.get('expression'),
        config,
        state,
        output,
      });
    }

    const staticAnalysis = isStaticExpression(expr, true);
    if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
      // Preserve the exact whitespace for static string expressions
      return {
        nodeType: 'expression',
        result: staticAnalysis.value,
      };
    }

    // Keep existing behavior for non-static expressions
    const code = generate(node).code;
    output.unwrappedExpressions.push(code); // Keep track of unwrapped expressions for error reporting
    return code;
  } else if (t.isJSXText(node)) {
    // Updated JSX Text handling
    // JSX Text handling following React's rules
    const text = node.value;
    return text;
  } else if (t.isJSXElement(node)) {
    const element = node;
    const elementName = element.openingElement.name;

    let typeName;
    if (t.isJSXIdentifier(elementName)) {
      typeName = elementName.name;
    } else if (t.isJSXMemberExpression(elementName)) {
      typeName = generate(elementName).code;
    } else {
      typeName = null;
    }

    // Convert from alias to original name
    const componentType = config.importAliases[typeName ?? ''];

    if (componentType === TRANSLATION_COMPONENT && insideT) {
      // Add warning: Nested <T> components are allowed, but they are advised against
      output.warnings.add(
        warnNestedTComponent(
          config.file,
          `${element.loc?.start?.line}:${element.loc?.start?.column}`
        )
      );
    }

    // If this JSXElement is one of the recognized variable components,
    const elementIsVariable = VARIABLE_COMPONENTS.includes(componentType);

    const props: { [key: string]: any } = {};

    const elementIsPlural = componentType === 'Plural';
    const elementIsBranch = componentType === 'Branch';

    element.openingElement.attributes.forEach((attr, index) => {
      const helperAttribute = helperPath
        .get('openingElement')
        .get('attributes')[index];
      if (t.isJSXAttribute(attr)) {
        const attrName = attr.name.name;
        let attrValue = null;
        if (attr.value) {
          if (t.isStringLiteral(attr.value)) {
            attrValue = attr.value.value;
          } else if (t.isJSXExpressionContainer(attr.value)) {
            const helperValue = helperAttribute.get(
              'value'
            ) as NodePath<t.JSXExpressionContainer>;
            // Check if this is an HTML content prop (title, placeholder, alt, etc.)
            const isHtmlContentProp = Object.values(
              HTML_CONTENT_PROPS
            ).includes(attrName as any);

            // If its a plural or branch prop
            if (
              (elementIsPlural && isAcceptedPluralForm(attrName as string)) ||
              (elementIsBranch && attrName !== 'branch')
            ) {
              // Make sure that variable strings like {`I have ${count} book`} are invalid!
              if (
                t.isTemplateLiteral(attr.value.expression) &&
                !isStaticExpression(attr.value.expression, true).isStatic
              ) {
                output.unwrappedExpressions.push(generate(attr.value).code);
              }
              // If it's an array, flag as an unwrapped expression
              if (t.isArrayExpression(attr.value.expression)) {
                output.unwrappedExpressions.push(generate(attr.value.expression).code);
              }
              attrValue = buildJSXTree({
                node: attr.value,
                insideT: true,
                inStatic,
                scopeNode,
                helperPath: helperValue,
                config,
                state,
                output,
              });
            }
            // For HTML content props, only accept static string expressions
            else if (isHtmlContentProp) {
              const staticAnalysis = isStaticExpression(
                attr.value.expression,
                true
              );
              if (
                staticAnalysis.isStatic &&
                staticAnalysis.value !== undefined
              ) {
                attrValue = staticAnalysis.value;
              }
              // Otherwise attrValue stays null and won't be included
            }
          }
        }
        props[attrName as any] = attrValue;
      }
    });

    if (elementIsVariable) {
      if (componentType === STATIC_COMPONENT) {
        const helperElement = helperPath.get('children');
        const results = {
          nodeType: 'element' as const,
          type: STATIC_COMPONENT,
          props,
        };
        // Create children array if necessary
        if (element.children.length) {
          results.props.children = [];
        }
        if (state.visited === null) {
          state.visited = new Set();
        }
        for (let index = 0; index < element.children.length; index++) {
          const helperChild = helperElement[index];
          const result = buildJSXTree({
            node: helperChild.node,
            insideT: true,
            inStatic: true,
            scopeNode,
            helperPath: helperChild,
            config,
            state,
            output,
          });
          results.props.children.push(result);
        }
        return results;
      }

      return {
        nodeType: 'element',
        // if componentType is undefined, use typeName
        // Basically, if componentType is not a GT component, use typeName such as <div>
        type: componentType ?? typeName ?? '',
        props,
      };
    }

    const children: (JsxTree | MultiplicationNode)[] = element.children
      .map((child, index) =>
        buildJSXTree({
          node: child,
          insideT: true,
          inStatic,
          scopeNode,
          helperPath: helperPath.get('children')[index],
          config,
          state,
          output,
        })
      )
      .filter((child) => child !== null && child !== '');

    if (children.length === 1) {
      props.children = children[0];
    } else if (children.length > 1) {
      props.children = children;
    }

    return {
      nodeType: 'element',
      // if componentType is undefined, use typeName
      // Basically, if componentType is not a GT component, use typeName such as <div>
      type: componentType ?? typeName,
      props,
    };
  }
  // If it's a JSX fragment
  else if (t.isJSXFragment(node)) {
    const children = node.children
      .map((child: any, index: number) =>
        buildJSXTree({
          node: child,
          insideT: true,
          inStatic,
          scopeNode,
          helperPath: helperPath.get('children')[index],
          config,
          state,
          output,
        })
      )
      .filter((child: any) => child !== null && child !== '');

    const props: { [key: string]: any } = {};

    if (children.length === 1) {
      props.children = children[0];
    } else if (children.length > 1) {
      props.children = children;
    }

    return {
      nodeType: 'element',
      type: '',
      props,
    };
  }
  // If it's a string literal (standalone)
  else if (t.isStringLiteral(node)) {
    return node.value;
  }
  // If it's a template literal
  else if (t.isTemplateLiteral(node)) {
    // We've already checked that it's static, and and added a warning if it's not, this check is just for fallback behavior
    if (
      !isStaticExpression(node, true).isStatic ||
      node.quasis[0].value.cooked === undefined
    ) {
      return generate(node).code;
    }
    return node.quasis[0].value.cooked;
  } else if (t.isNullLiteral(node)) {
    // If it's null, return null
    return null;
  } else if (t.isBooleanLiteral(node)) {
    // If it's a boolean, return the boolean
    return node.value;
  } else if (t.isNumericLiteral(node)) {
    // If it's a number, return the number
    return node.value.toString();
  }
  // Negative
  else if (t.isUnaryExpression(node)) {
    // If it's a unary expression, return the expression
    const staticAnalysis = isStaticExpression(node, true);
    if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
      return staticAnalysis.value;
    }
    return generate(node).code;
  } else if (
    (t.isCallExpression(node) && t.isIdentifier(node.callee)) ||
    (t.isAwaitExpression(node) &&
      t.isCallExpression(node.argument) &&
      t.isIdentifier(node.argument.callee))
  ) {
    if (inStatic) {
      const callExpression = (
        node.type === 'AwaitExpression' ? node.argument : node
      ) as t.CallExpression;
      const callee = callExpression.callee as t.Identifier;
      const calleeBinding = scopeNode.scope.getBinding(callee.name);
      if (!calleeBinding) {
        output.warnings.add(
          warnFunctionNotFoundSync(
            config.file,
            callee.name,
            `${callee.loc?.start?.line}:${callee.loc?.start?.column}`
          )
        );
        return null;
      }
      return resolveStaticFunctionInvocationFromBinding({
        importAliases: config.importAliases,
        calleeBinding,
        callee,
        visited: state.visited!, // we know this is true bc of inStatic
        callStack: state.callStack,
        file: config.file,
        errors: output.errors,
        warnings: output.warnings,
        unwrappedExpressions: output.unwrappedExpressions,
        pkgs: config.pkgs,
        parsingOptions: config.parsingOptions,
        importedFunctionsMap: state.importedFunctionsMap,
        staticTracker: state.staticTracker,
      });
    } else {
      output.unwrappedExpressions.push(generate(node).code);
    }
  } else if (t.isParenthesizedExpression(node)) {
    const child = node.expression;
    return buildJSXTree({
      node: child,
      insideT,
      inStatic,
      scopeNode,
      helperPath: helperPath.get('expression'),
      config,
      state,
      output,
    });
  }
  // If it's some other JS expression
  else if (
    t.isIdentifier(node) ||
    t.isMemberExpression(node) ||
    t.isCallExpression(node) ||
    t.isBinaryExpression(node) ||
    t.isLogicalExpression(node) ||
    t.isConditionalExpression(node)
  ) {
    output.unwrappedExpressions.push(generate(node).code);
  } else {
    if (node === undefined) {
      output.unwrappedExpressions.push(node);
    } else {
      output.unwrappedExpressions.push(generate(node).code);
    }
  }
  return null;
}
// end buildJSXTree

// Parses a JSX element and adds it to the updates array
function parseJSXElement({
  importAliases,
  node,
  originalName,
  pkgs,
  updates,
  errors,
  warnings,
  file,
  parsingOptions,
  scopeNode,
  importedFunctionsMap,
}: {
  importAliases: Record<string, string>;
  node: t.JSXElement;
  originalName: string;
  pkgs: GTLibrary[];
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
  file: string;
  parsingOptions: ParsingConfigOptions;
  scopeNode: NodePath<t.JSXElement>;
  importedFunctionsMap: Map<string, string>;
}) {
  const openingElement = node.openingElement;
  const name = openingElement.name;

  // Only proceed if it's <T> ...
  // TODO: i don't think this condition is needed anymore
  if (
    !(name.type === 'JSXIdentifier' && originalName === TRANSLATION_COMPONENT)
  ) {
    return;
  }

  const componentErrors: string[] = [];
  const componentWarnings: Set<string> = new Set();
  const metadata: Metadata = {};
  const relativeFilepath = path.relative(process.cwd(), file);
  metadata.filePaths = [relativeFilepath];

  // We'll track this flag to know if any unwrapped {variable} is found in children
  const unwrappedExpressions: string[] = [];

  // Gather <T>'s props
  parseTProps({
    openingElement,
    metadata,
    componentErrors,
    file,
  });

  // Flag for if contains static content
  const staticTracker: StaticTracker = {
    isStatic: false,
  };

  // Build the JSX tree for this component
  const treeResult = buildJSXTree({
    node,
    scopeNode,
    insideT: false,
    inStatic: false,
    helperPath: scopeNode,
    config: {
      importAliases,
      parsingOptions,
      pkgs,
      file,
    },
    state: {
      visited: null,
      callStack: [],
      staticTracker,
      importedFunctionsMap,
    },
    output: {
      unwrappedExpressions,
      errors: componentErrors,
      warnings: componentWarnings,
    },
  }) as JsxTree;

  // Strip the outer <T> component if necessary
  const jsxTree =
    isElementNode(treeResult) && treeResult.props?.children
      ? // We know this b/c the direct children of <T> will never be a multiplication node
        (treeResult.props.children as JsxTree | JsxTree[])
      : treeResult;

  // Update warnings
  if (componentWarnings.size > 0) {
    componentWarnings.forEach((warning) => warnings.add(warning));
  }

  // Update errors
  if (componentErrors.length > 0) {
    errors.push(...componentErrors);
    return;
  }

  // Handle whitespace in children
  const whitespaceHandledTree = handleChildrenWhitespace(jsxTree);

  // Multiply the tree
  const multipliedTrees = multiplyJsxTree(whitespaceHandledTree);

  // Add GT identifiers to the tree
  // TODO: do this in parallel
  const minifiedTress: JsxChildren[] = [];
  for (const multipliedTree of multipliedTrees) {
    const minifiedTree = addGTIdentifierToSyntaxTree(multipliedTree);
    minifiedTress.push(
      Array.isArray(minifiedTree) && minifiedTree.length === 1
        ? minifiedTree[0]
        : minifiedTree
    );
  }

  // If we found an unwrapped expression, skip
  if (unwrappedExpressions.length > 0) {
    errors.push(
      warnHasUnwrappedExpressionSync(
        file,
        unwrappedExpressions,
        metadata.id,
        `${node.loc?.start?.line}:${node.loc?.start?.column}`
      )
    );
    return;
  }

  // Create a temporary unique flag for static content
  const temporaryStaticId = `static-temp-id-${randomUUID()}`;
  const isStatic = staticTracker.isStatic;

  // <T> is valid here
  for (const minifiedTree of minifiedTress) {
    // Clean the tree by removing null 'c' fields from JsxElements
    const cleanedTree = removeNullChildrenFields(minifiedTree);

    updates.push({
      dataFormat: 'JSX',
      source: cleanedTree,
      metadata: {
        // eslint-disable-next-line no-undef
        ...structuredClone(metadata),
        ...(isStatic && { staticId: temporaryStaticId }),
      },
    });
  }
}

function resolveStaticFunctionInvocationFromBinding({
  importAliases,
  calleeBinding,
  callee,
  unwrappedExpressions,
  visited,
  callStack,
  file,
  errors,
  warnings,
  parsingOptions,
  importedFunctionsMap,
  pkgs,
  staticTracker,
}: {
  importAliases: Record<string, string>;
  calleeBinding: traverseModule.Binding;
  callee: t.Identifier;
  unwrappedExpressions: string[];
  visited: Set<string>;
  callStack: string[];
  file: string;
  errors: string[];
  warnings: Set<string>;
  parsingOptions: ParsingConfigOptions;
  importedFunctionsMap: Map<string, string>;
  pkgs: GTLibrary[];
  staticTracker: StaticTracker;
}): MultiplicationNode | null {
  // Stop recursive calls
  type RecursiveGuardCallback = () =>
    | ReturnType<typeof processFunctionDeclarationNodePath>
    | ReturnType<typeof processVariableDeclarationNodePath>
    | ReturnType<typeof processFunctionInFile>;
  function withRecusionGuard({
    cb,
    filename,
    functionName,
  }: {
    cb: RecursiveGuardCallback;
    filename: string;
    functionName: string;
  }) {
    const cacheKey = `${filename}::${functionName}`;
    if (callStack.includes(cacheKey)) {
      errors.push(warnRecursiveFunctionCallSync(file, functionName));
      return null;
    }
    callStack.push(cacheKey);
    const result = cb();
    callStack.pop();
    return result;
  }

  // check for recursive calls
  if (calleeBinding.path.isFunctionDeclaration()) {
    // Handle function declarations: function getSubject() { ... }
    const functionName = callee.name;
    const path = calleeBinding.path;
    return withRecusionGuard({
      filename: file,
      functionName,
      cb: () =>
        processFunctionDeclarationNodePath({
          importAliases,
          functionName,
          path,
          unwrappedExpressions,
          callStack,
          errors,
          warnings,
          visited,
          file,
          parsingOptions,
          importedFunctionsMap,
          pkgs,
          staticTracker,
        }),
    });
  } else if (
    calleeBinding.path.isVariableDeclarator() &&
    calleeBinding.path.node.init &&
    (t.isArrowFunctionExpression(calleeBinding.path.node.init) ||
      t.isFunctionExpression(calleeBinding.path.node.init))
  ) {
    // Handle arrow functions assigned to variables: const getData = (t) => {...}
    const functionName = callee.name;
    const path = calleeBinding.path;
    return withRecusionGuard({
      filename: file,
      functionName,
      cb: () =>
        processVariableDeclarationNodePath({
          importAliases,
          functionName,
          path,
          unwrappedExpressions,
          callStack,
          pkgs,
          errors,
          visited,
          warnings,
          file,
          parsingOptions,
          importedFunctionsMap,
          staticTracker,
        }),
    });
  } else if (importedFunctionsMap.has(callee.name)) {
    // Get the original function name
    let originalName: string | undefined;
    if (calleeBinding.path.isImportSpecifier()) {
      originalName = t.isIdentifier(calleeBinding.path.node.imported)
        ? calleeBinding.path.node.imported.name
        : calleeBinding.path.node.imported.value;
    } else if (calleeBinding.path.isImportDefaultSpecifier()) {
      originalName = calleeBinding.path.node.local.name;
    } else if (calleeBinding.path.isImportNamespaceSpecifier()) {
      originalName = calleeBinding.path.node.local.name;
    }

    // Function is being imported
    const importPath = importedFunctionsMap.get(callee.name)!;
    const filePath = resolveImportPath(
      file,
      importPath,
      parsingOptions,
      resolveImportPathCache
    );
    if (filePath && originalName) {
      const result = withRecusionGuard({
        filename: filePath,
        functionName: originalName,
        cb: () =>
          processFunctionInFile({
            filePath,
            functionName: originalName,
            visited,
            callStack,
            unwrappedExpressions,
            errors,
            warnings,
            file,
            parsingOptions,
            pkgs,
            staticTracker,
          }),
      });
      if (result !== null) {
        return result;
      }
    }
  }
  warnings.add(
    warnFunctionNotFoundSync(
      file,
      callee.name,
      `${callee.loc?.start?.line}:${callee.loc?.start?.column}`
    )
  );
  return null;
}

/**
 * Searches for a specific user-defined function in a file.
 * This is the resolution logic
 *
 * Handles multiple function declaration patterns:
 * - function getInfo() { ... }
 * - export function getInfo() { ... }
 * - const getInfo = () => { ... }
 *
 * If the function is not found in the file, follows re-exports (export * from './other')
 */
function processFunctionInFile({
  filePath,
  functionName,
  visited,
  callStack,
  parsingOptions,
  errors,
  warnings,
  file,
  unwrappedExpressions,
  pkgs,
  staticTracker,
}: {
  filePath: string;
  functionName: string;
  visited: Set<string>;
  callStack: string[];
  parsingOptions: ParsingConfigOptions;
  errors: string[];
  warnings: Set<string>;
  file: string;
  unwrappedExpressions: string[];
  pkgs: GTLibrary[];
  staticTracker: StaticTracker;
}): MultiplicationNode | null {
  // Create a custom key for the function call
  const cacheKey = `${filePath}::${functionName}`;
  // Check cache first to avoid redundant parsing
  if (processFunctionCache.has(cacheKey)) {
    return processFunctionCache.get(cacheKey) ?? null;
  }

  // Prevent infinite loops from circular re-exports
  if (visited.has(filePath)) {
    return null;
  }
  visited.add(filePath);

  let result: MultiplicationNode | null | undefined = undefined;
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const { importAliases } = getPathsAndAliases(ast, pkgs);

    // Collect all imports in this file to track cross-file function calls
    let importedFunctionsMap: Map<string, string> = new Map();
    traverse(ast, {
      Program(path) {
        importedFunctionsMap = buildImportMap(path);
      },
    });

    const reExports: string[] = [];

    const warnDuplicateFuncDef = (path: NodePath) => {
      warnings.add(
        warnDuplicateFunctionDefinitionSync(
          filePath,
          functionName,
          `${path.node.loc?.start?.line}:${path.node.loc?.start?.column}`
        )
      );
    };

    traverse(ast, {
      // Handle function declarations: function getInfo() { ... }
      FunctionDeclaration(path) {
        if (path.node.id?.name === functionName) {
          if (result !== undefined) return warnDuplicateFuncDef(path);
          result = processFunctionDeclarationNodePath({
            importAliases,
            functionName,
            path,
            unwrappedExpressions,
            callStack,
            visited,
            pkgs,
            errors,
            warnings,
            file: filePath,
            parsingOptions,
            importedFunctionsMap,
            staticTracker,
          });
        }
      },
      // Handle variable declarations: const getInfo = () => { ... }
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.id) &&
          path.node.id.name === functionName &&
          path.node.init &&
          (t.isArrowFunctionExpression(path.node.init) ||
            t.isFunctionExpression(path.node.init))
        ) {
          if (result !== undefined) return warnDuplicateFuncDef(path);
          result = processVariableDeclarationNodePath({
            importAliases,
            functionName,
            path,
            callStack,
            pkgs,
            errors,
            warnings,
            visited,
            unwrappedExpressions,
            file: filePath,
            parsingOptions,
            importedFunctionsMap,
            staticTracker,
          });
        }
      },
      // Collect re-exports: export * from './other'
      ExportAllDeclaration(path) {
        if (t.isStringLiteral(path.node.source)) {
          reExports.push(path.node.source.value);
        }
      },
      // Collect named re-exports: export { foo } from './other'
      ExportNamedDeclaration(path) {
        if (path.node.source && t.isStringLiteral(path.node.source)) {
          // Check if this export includes our function
          const exportsFunction = path.node.specifiers.some((spec) => {
            if (t.isExportSpecifier(spec)) {
              const exportedName = t.isIdentifier(spec.exported)
                ? spec.exported.name
                : spec.exported.value;
              return exportedName === functionName;
            }
            return false;
          });
          if (exportsFunction) {
            reExports.push(path.node.source.value);
          }
        }
      },
    });

    // If function not found, follow re-exports
    if (result === undefined && reExports.length > 0) {
      for (const reExportPath of reExports) {
        const resolvedPath = resolveImportPath(
          filePath,
          reExportPath,
          parsingOptions,
          resolveImportPathCache
        );
        if (resolvedPath) {
          const foundResult = processFunctionInFile({
            filePath: resolvedPath,
            functionName,
            unwrappedExpressions,
            visited,
            callStack,
            parsingOptions,
            errors,
            warnings,
            file: filePath,
            pkgs,
            staticTracker,
          });
          if (foundResult != null) {
            result = foundResult;
            break;
          }
        }
      }
    }

    // Mark this function search as processed in the cache
    processFunctionCache.set(cacheKey, result !== undefined ? result : null);
  } catch {
    // Silently skip files that can't be parsed or accessed
    // Still mark as processed to avoid retrying failed parses
    processFunctionCache.set(cacheKey, null);
  }
  return result !== undefined ? result : null;
}

/**
 * Process a function declaration
 * function getInfo() { ... }
 */
function processFunctionDeclarationNodePath({
  functionName,
  path,
  importAliases,
  unwrappedExpressions,
  visited,
  callStack,
  errors,
  warnings,
  file,
  parsingOptions,
  importedFunctionsMap,
  pkgs,
  staticTracker,
}: {
  functionName: string;
  path: NodePath<t.FunctionDeclaration>;
  importAliases: Record<string, string>;
  unwrappedExpressions: string[];
  visited: Set<string>;
  callStack: string[];
  errors: string[];
  warnings: Set<string>;
  file: string;
  parsingOptions: ParsingConfigOptions;
  importedFunctionsMap: Map<string, string>;
  pkgs: GTLibrary[];
  staticTracker: StaticTracker;
}): MultiplicationNode | null {
  const result: MultiplicationNode = {
    nodeType: 'multiplication',
    branches: [],
  };
  path.traverse({
    Function(path) {
      path.skip();
    },
    ReturnStatement(returnPath) {
      const returnNodePath = returnPath.get('argument');
      if (!returnNodePath.isExpression()) {
        return;
      }
      result.branches.push(
        processStaticExpression({
          config: {
            parsingOptions,
            importAliases,
            pkgs,
            file,
          },
          state: {
            visited,
            callStack,
            staticTracker,
            importedFunctionsMap,
          },
          output: {
            errors,
            warnings,
            unwrappedExpressions,
          },
          expressionNodePath: returnNodePath,
          scopeNode: returnNodePath,
        })
      );
    },
  });
  if (result.branches.length === 0) {
    return null;
  }
  return result;
}

/**
 * Process a variable declaration of a function
 * const getInfo = () => { ... }
 *
 * IMPORTANT: the RHand value must be the function definition, or this will fail
 */
function processVariableDeclarationNodePath({
  functionName,
  path,
  importAliases,
  unwrappedExpressions,
  visited,
  callStack,
  errors,
  warnings,
  file,
  parsingOptions,
  importedFunctionsMap,
  pkgs,
  staticTracker,
}: {
  functionName: string;
  path: NodePath<t.VariableDeclarator>;
  importAliases: Record<string, string>;
  unwrappedExpressions: string[];
  visited: Set<string>;
  callStack: string[];
  errors: string[];
  warnings: Set<string>;
  file: string;
  parsingOptions: ParsingConfigOptions;
  importedFunctionsMap: Map<string, string>;
  pkgs: GTLibrary[];
  staticTracker: StaticTracker;
}): MultiplicationNode | null {
  const result: MultiplicationNode = {
    nodeType: 'multiplication',
    branches: [],
  };

  // Enforce the Rhand is a function definition
  const arrowFunctionPath = path.get('init');
  if (!arrowFunctionPath.isArrowFunctionExpression()) {
    errors.push(
      warnInvalidStaticInitSync(
        file,
        functionName,
        `${path.node.loc?.start?.line}:${path.node.loc?.start?.column}`
      )
    );
    return null;
  }

  const bodyNodePath = arrowFunctionPath.get('body');
  if (bodyNodePath.isExpression()) {
    // process expression return
    result.branches.push(
      processStaticExpression({
        config: {
          parsingOptions,
          importAliases,
          pkgs,
          file,
        },
        state: {
          visited,
          callStack,
          staticTracker,
          importedFunctionsMap,
        },
        output: {
          errors,
          warnings,
          unwrappedExpressions,
        },
        expressionNodePath: bodyNodePath,
        scopeNode: arrowFunctionPath,
      })
    );
  } else {
    // search for a return statement
    bodyNodePath.traverse({
      Function(path) {
        path.skip();
      },
      ReturnStatement(returnPath) {
        const returnNodePath = returnPath.get('argument');
        if (!returnNodePath.isExpression()) {
          return;
        }
        result.branches.push(
          processStaticExpression({
            config: {
              parsingOptions,
              importAliases,
              pkgs,
              file,
            },
            state: {
              visited,
              callStack,
              staticTracker,
              importedFunctionsMap,
            },
            output: {
              errors,
              warnings,
              unwrappedExpressions,
            },
            expressionNodePath: returnNodePath,
            scopeNode: returnPath,
          })
        );
      },
    });
  }

  if (result.branches.length === 0) {
    errors.push(
      warnMissingReturnSync(
        file,
        functionName,
        `${path.node.loc?.start?.line}:${path.node.loc?.start?.column}`
      )
    );
    return null;
  }
  return result;
}

/**
 * Process a <Static> expression
 */
function processStaticExpression({
  config,
  state,
  output,
  expressionNodePath,
  scopeNode,
}: {
  config: ConfigOptions;
  state: StateTracker;
  output: OutputCollector;
  expressionNodePath: NodePath<t.Expression>;
  scopeNode: NodePath;
}): JsxTree | MultiplicationNode {
  // Mark the static tracker as true
  state.staticTracker.isStatic = true;

  // Remove parentheses if they exist
  if (t.isParenthesizedExpression(expressionNodePath.node)) {
    // ex: return (value)
    return processStaticExpression({
      config,
      state,
      output,
      scopeNode,
      expressionNodePath: expressionNodePath.get('expression'),
    });
  } else if (
    t.isCallExpression(expressionNodePath.node) &&
    t.isIdentifier(expressionNodePath.node.callee)
  ) {
    // ex: return someFunc()
    const callee = expressionNodePath.node.callee;
    const calleeBinding = scopeNode.scope.getBinding(callee.name);
    if (!calleeBinding) {
      output.warnings.add(
        warnFunctionNotFoundSync(
          config.file,
          callee.name,
          `${callee.loc?.start?.line}:${callee.loc?.start?.column}`
        )
      );
      return null;
    }
    // Function is found
    return resolveStaticFunctionInvocationFromBinding({
      importAliases: config.importAliases,
      calleeBinding,
      callee,
      unwrappedExpressions: output.unwrappedExpressions,
      callStack: state.callStack,
      visited: state.visited!,
      file: config.file,
      errors: output.errors,
      warnings: output.warnings,
      pkgs: config.pkgs,
      parsingOptions: config.parsingOptions,
      importedFunctionsMap: state.importedFunctionsMap,
      staticTracker: state.staticTracker,
    });
  } else if (
    t.isAwaitExpression(expressionNodePath.node) &&
    t.isCallExpression(expressionNodePath.node.argument) &&
    t.isIdentifier(expressionNodePath.node.argument.callee)
  ) {
    // ex: return await someFunc()
    const callee = expressionNodePath.node.argument.callee;
    const calleeBinding = scopeNode.scope.getBinding(callee.name);
    if (!calleeBinding) {
      output.warnings.add(
        warnFunctionNotFoundSync(
          config.file,
          callee.name,
          `${callee.loc?.start?.line}:${callee.loc?.start?.column}`
        )
      );
      return null;
    }
    // Function is found
    return resolveStaticFunctionInvocationFromBinding({
      importAliases: config.importAliases,
      calleeBinding,
      callee,
      unwrappedExpressions: output.unwrappedExpressions,
      visited: state.visited!,
      callStack: state.callStack,
      file: config.file,
      errors: output.errors,
      warnings: output.warnings,
      pkgs: config.pkgs,
      parsingOptions: config.parsingOptions,
      importedFunctionsMap: state.importedFunctionsMap,
      staticTracker: state.staticTracker,
    });
  } else if (
    t.isJSXElement(expressionNodePath.node) ||
    t.isJSXFragment(expressionNodePath.node)
  ) {
    // ex: return <div>Jsx content</div>
    return buildJSXTree({
      importAliases: config.importAliases,
      node: expressionNodePath.node,
      unwrappedExpressions: output.unwrappedExpressions,
      visited: state.visited,
      callStack: state.callStack,
      errors: output.errors,
      warnings: output.warnings,
      file: config.file,
      insideT: true,
      parsingOptions: config.parsingOptions,
      scopeNode,
      importedFunctionsMap: state.importedFunctionsMap,
      pkgs: config.pkgs,
      inStatic: true,
      helperPath: expressionNodePath,
      staticTracker: state.staticTracker,
    });
  } else if (t.isConditionalExpression(expressionNodePath.node)) {
    // ex: return condition ? <div>Jsx content</div> : <div>Jsx content</div>
    // since two options here we must construct a new multiplication node
    const consequentNodePath = expressionNodePath.get('consequent');
    const alternateNodePath = expressionNodePath.get('alternate');
    const result: MultiplicationNode = {
      nodeType: 'multiplication' as const,
      branches: [consequentNodePath, alternateNodePath].map(
        (expressionNodePath) =>
          processStaticExpression({
            config,
            state,
            output,
            scopeNode,
            expressionNodePath,
          })
      ),
    };
    return result;
  } else {
    return buildJSXTree({
      importAliases: config.importAliases,
      node: expressionNodePath.node,
      unwrappedExpressions: output.unwrappedExpressions,
      visited: state.visited,
      callStack: state.callStack,
      errors: output.errors,
      warnings: output.warnings,
      file: config.file,
      insideT: true,
      parsingOptions: config.parsingOptions,
      scopeNode,
      importedFunctionsMap: state.importedFunctionsMap,
      pkgs: config.pkgs,
      inStatic: true,
      helperPath: expressionNodePath,
      staticTracker: state.staticTracker,
    });
  }
}
