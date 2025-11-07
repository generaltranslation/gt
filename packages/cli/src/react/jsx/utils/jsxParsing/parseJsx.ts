import { Updates } from '../../../../types/index.js';

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
  warnInvalidStaticChildSync,
  warnInvalidReturnSync as warnInvalidReturnExpressionSync,
  warnFunctionNotFoundSync,
  warnMissingReturnSync,
  warnDuplicateFunctionDefinitionSync,
  warnInvalidStaticInitSync,
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
import {
  MultiplicationNode,
  JsxTree,
  isElementNode,
  ElementNode,
  ExpressionNode,
} from './types.js';
import { multiplyJsxTree } from './multiplication/multiplyJsxTree.js';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

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
const processFunctionCache = new Map<string, boolean>();

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
  pkg,
}: {
  ast: any;
  pkg: 'gt-react' | 'gt-next';
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
      pkg,
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
 * @param unwrappedExpressions - An array to store unwrapped expressions
 * @param updates - The updates array
 * @param errors - The errors array
 * @param file - The file name
 * @param insideT - Whether the current node is inside a <T> component
 * @returns The built JSX tree
 */
export function buildJSXTree({
  importAliases,
  node,
  unwrappedExpressions,
  visited,
  updates,
  errors,
  warnings,
  file,
  insideT,
  parsingOptions,
  scopeNode,
  importedFunctionsMap,
  pkg,
}: {
  importAliases: Record<string, string>;
  node: any;
  unwrappedExpressions: string[];
  visited: Set<string>;
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
  file: string;
  insideT: boolean;
  parsingOptions: ParsingConfigOptions;
  scopeNode: NodePath;
  importedFunctionsMap: Map<string, string>;
  pkg: 'gt-react' | 'gt-next';
}): JsxTree {
  if (t.isJSXExpressionContainer(node)) {
    // Skip JSX comments
    if (t.isJSXEmptyExpression(node.expression)) {
      return null;
    }

    const expr = node.expression;
    if (t.isJSXElement(expr)) {
      return buildJSXTree({
        importAliases,
        node: expr,
        unwrappedExpressions,
        visited,
        updates,
        errors: errors,
        warnings: warnings,
        file,
        insideT,
        parsingOptions,
        scopeNode,
        importedFunctionsMap,
        pkg,
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
    unwrappedExpressions.push(code); // Keep track of unwrapped expressions for error reporting
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
    const componentType = importAliases[typeName ?? ''];

    if (componentType === TRANSLATION_COMPONENT && insideT) {
      // Add warning: Nested <T> components are allowed, but they are advised against
      warnings.add(
        warnNestedTComponent(
          file,
          `${element.loc?.start?.line}:${element.loc?.start?.column}`
        )
      );
    }

    // If this JSXElement is one of the recognized variable components,
    const elementIsVariable = VARIABLE_COMPONENTS.includes(componentType);

    const props: { [key: string]: any } = {};

    const elementIsPlural = componentType === 'Plural';
    const elementIsBranch = componentType === 'Branch';

    element.openingElement.attributes.forEach((attr) => {
      if (t.isJSXAttribute(attr)) {
        const attrName = attr.name.name;
        let attrValue = null;
        if (attr.value) {
          if (t.isStringLiteral(attr.value)) {
            attrValue = attr.value.value;
          } else if (t.isJSXExpressionContainer(attr.value)) {
            // Check if this is an HTML content prop (title, placeholder, alt, etc.)
            const isHtmlContentProp = Object.values(
              HTML_CONTENT_PROPS
            ).includes(attrName as any);

            if (isHtmlContentProp) {
              // For HTML content props, only accept static string expressions
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
            } else {
              // For non-HTML-content props, validate plural/branch then build tree
              if (
                (elementIsPlural && isAcceptedPluralForm(attrName as string)) ||
                (elementIsBranch && attrName !== 'branch')
              ) {
                // Make sure that variable strings like {`I have ${count} book`} are invalid!
                if (
                  t.isTemplateLiteral(attr.value.expression) &&
                  !isStaticExpression(attr.value.expression, true).isStatic
                ) {
                  unwrappedExpressions.push(generate(attr.value).code);
                }
                // If it's an array, flag as an unwrapped expression
                if (t.isArrayExpression(attr.value.expression)) {
                  unwrappedExpressions.push(
                    generate(attr.value.expression).code
                  );
                }
              }
              attrValue = buildJSXTree({
                importAliases,
                node: attr.value.expression,
                unwrappedExpressions,
                visited,
                updates,
                errors: errors,
                warnings: warnings,
                file: file,
                insideT: true,
                parsingOptions,
                scopeNode,
                importedFunctionsMap,
                pkg,
              });
            }
          }
        }
        props[attrName as any] = attrValue;
      }
    });

    if (elementIsVariable) {
      if (componentType === STATIC_COMPONENT) {
        return resolveStaticComponentChildren({
          importAliases,
          scopeNode,
          children: element.children,
          unwrappedExpressions,
          visited,
          updates,
          errors,
          warnings,
          file,
          parsingOptions,
          importedFunctionsMap,
          pkg,
          props,
        });
      }

      // I do not see why this is being called, i am disabling this for now:
      // parseJSXElement({
      //   importAliases,
      //   node: element,
      //   updates,
      //   errors,
      //   warnings,
      //   file,
      //   parsingOptions,
      // });
      return {
        nodeType: 'element',
        // if componentType is undefined, use typeName
        // Basically, if componentType is not a GT component, use typeName such as <div>
        type: componentType ?? typeName ?? '',
        props,
      };
    }

    const children: JsxTree[] = element.children
      .map((child) =>
        buildJSXTree({
          importAliases,
          node: child,
          unwrappedExpressions,
          visited,
          updates,
          errors,
          warnings,
          file,
          insideT: true,
          parsingOptions,
          scopeNode,
          importedFunctionsMap,
          pkg,
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
      .map((child: any) =>
        buildJSXTree({
          importAliases,
          node: child,
          unwrappedExpressions,
          visited,
          updates,
          errors,
          warnings,
          file,
          insideT: true,
          parsingOptions,
          scopeNode,
          importedFunctionsMap,
          pkg,
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
    return generate(node).code;
  } else {
    return generate(node).code;
  }
}
// end buildJSXTree

// Parses a JSX element and adds it to the updates array
export function parseJSXElement({
  importAliases,
  node,
  originalName,
  pkg,
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
  pkg: 'gt-react' | 'gt-next';
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

  // We'll track this flag to know if any unwrapped {variable} is found in children
  const unwrappedExpressions: string[] = [];

  // Gather <T>'s props
  parseTProps({
    openingElement,
    metadata,
    componentErrors,
    file,
  });

  // Build the JSX tree for this component
  const treeResult = buildJSXTree({
    importAliases,
    node,
    scopeNode,
    visited: new Set(),
    pkg,
    unwrappedExpressions,
    updates,
    errors: componentErrors,
    warnings: componentWarnings,
    file,
    insideT: false,
    parsingOptions,
    importedFunctionsMap,
  });

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

  // <T> is valid here
  for (const minifiedTree of minifiedTress) {
    updates.push({
      dataFormat: 'JSX',
      source: minifiedTree,
      // eslint-disable-next-line no-undef
      metadata: { ...structuredClone(metadata) },
    });
  }
}

/**
 * Resolves an invocation inside of a <Static> component. It will resolve the function, and build
 * a jsx tree for each return inside of the function definition.
 *
 * function getOtherSubject() {
 *   return <div>Jane</div>;
 * }
 *
 * function getSubject() {
 *   if (condition) return getOtherSubject();
 *   return <div>John</div>;
 * }
 * ...
 * <Static>
 *   {getSubject()}
 * </Static>
 */
function resolveStaticComponentChildren({
  importAliases,
  scopeNode,
  children,
  unwrappedExpressions,
  visited,
  updates,
  errors,
  warnings,
  file,
  parsingOptions,
  importedFunctionsMap,
  pkg,
  props,
}: {
  importAliases: Record<string, string>;
  scopeNode: NodePath;
  children: (
    | t.JSXExpressionContainer
    | t.JSXText
    | t.JSXElement
    | t.JSXFragment
    | t.JSXSpreadChild
  )[];
  unwrappedExpressions: string[];
  visited: Set<string>;
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
  file: string;
  parsingOptions: ParsingConfigOptions;
  importedFunctionsMap: Map<string, string>;
  pkg: 'gt-react' | 'gt-next';
  props: { [key: string]: any };
}): ElementNode {
  const result = {
    nodeType: 'element' as const,
    type: STATIC_COMPONENT,
    props,
  };
  let found = false;

  // Create children array if necessary
  if (children.length) {
    result.props.children = [];
  }

  for (const child of children) {
    // Ignore whitespace outside of jsx container
    if (t.isJSXText(child) && child.value.trim() === '') {
      result.props.children.push(child.value);
      continue;
    }
    // Must be an expression container with a function invocation
    if (
      !t.isJSXExpressionContainer(child) ||
      !(
        (t.isCallExpression(child.expression) &&
          t.isIdentifier(child.expression.callee)) ||
        (t.isAwaitExpression(child.expression) &&
          t.isCallExpression(child.expression.argument) &&
          t.isIdentifier(child.expression.argument.callee))
      ) ||
      found // There can only be one invocation inside of a <Static> component
    ) {
      errors.push(
        warnInvalidStaticChildSync(
          file,
          `${child.loc?.start?.line}:${child.loc?.start?.column}`
        )
      );
      continue;
    }

    // Set found to true
    found = true;

    // Get callee and binding from scope
    const callee = (
      t.isAwaitExpression(child.expression)
        ? (child.expression.argument as t.CallExpression).callee
        : (child.expression as t.CallExpression).callee
    ) as t.Identifier;
    const calleeBinding = scopeNode.scope.getBinding(callee.name);

    if (!calleeBinding) {
      warnFunctionNotFoundSync(
        file,
        callee.name,
        `${callee.loc?.start?.line}:${callee.loc?.start?.column}`
      );
      continue;
    }

    // Function is found locally, return wrapped in an expression
    const staticFunctionInvocation = resolveStaticFunctionInvocationFromBinding(
      {
        importAliases,
        calleeBinding,
        callee,
        visited,
        file,
        updates,
        errors,
        warnings,
        unwrappedExpressions,
        pkg,
        parsingOptions,
        importedFunctionsMap,
      }
    );
    result.props.children.push({
      nodeType: 'expression',
      result: staticFunctionInvocation,
    });
  }

  return result;
}

function resolveStaticFunctionInvocationFromBinding({
  importAliases,
  calleeBinding,
  callee,
  unwrappedExpressions,
  visited,
  file,
  updates,
  errors,
  warnings,
  parsingOptions,
  importedFunctionsMap,
  pkg,
}: {
  importAliases: Record<string, string>;
  calleeBinding: traverseModule.Binding;
  callee: t.Identifier;
  unwrappedExpressions: string[];
  visited: Set<string>;
  file: string;
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
  parsingOptions: ParsingConfigOptions;
  importedFunctionsMap: Map<string, string>;
  pkg: 'gt-react' | 'gt-next';
}): MultiplicationNode | null {
  if (calleeBinding.path.isFunctionDeclaration()) {
    // Handle function declarations: function getSubject() { ... }
    return processFunctionDeclarationNodePath({
      importAliases,
      functionName: callee.name,
      path: calleeBinding.path,
      unwrappedExpressions,
      updates,
      errors,
      warnings,
      visited,
      file,
      parsingOptions,
      importedFunctionsMap,
      pkg,
    });
  } else if (
    calleeBinding.path.isVariableDeclarator() &&
    calleeBinding.path.node.init &&
    (t.isArrowFunctionExpression(calleeBinding.path.node.init) ||
      t.isFunctionExpression(calleeBinding.path.node.init))
  ) {
    // Handle arrow functions assigned to variables: const getData = (t) => {...}
    return processVariableDeclarationNodePath({
      importAliases,
      functionName: callee.name,
      path: calleeBinding.path,
      unwrappedExpressions,
      updates,
      pkg,
      errors,
      visited,
      warnings,
      file,
      parsingOptions,
      importedFunctionsMap,
    });
  } else if (importedFunctionsMap.has(callee.name)) {
    // Function is being imported
    const importPath = importedFunctionsMap.get(callee.name)!;
    const resolvedPath = resolveImportPath(
      file,
      importPath,
      parsingOptions,
      resolveImportPathCache
    );
    if (resolvedPath) {
      return processFunctionInFile({
        filePath: resolvedPath,
        functionName: callee.name,
        visited,
        unwrappedExpressions,
        updates,
        errors,
        warnings,
        file,
        parsingOptions,
        pkg,
      });
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
  parsingOptions,
  updates,
  errors,
  warnings,
  file,
  unwrappedExpressions,
  pkg,
}: {
  filePath: string;
  functionName: string;
  visited: Set<string>;
  parsingOptions: ParsingConfigOptions;
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
  file: string;
  unwrappedExpressions: string[];
  pkg: 'gt-react' | 'gt-next';
}): MultiplicationNode | null {
  // Check cache first to avoid redundant parsing
  const cacheKey = `${filePath}::${functionName}`;
  if (processFunctionCache.has(cacheKey)) {
    return null;
  }

  // Prevent infinite loops from circular re-exports
  if (visited.has(filePath)) return null;
  visited.add(filePath);

  let result: MultiplicationNode | null | undefined = undefined;
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const { importAliases } = getPathsAndAliases(ast, pkg);

    // Collect all imports in this file to track cross-file function calls
    let importedFunctionsMap: Map<string, string>;
    traverse(ast, {
      Program(path) {
        importedFunctionsMap = buildImportMap(path);
      },
    });

    const reExports: string[] = [];

    const warnDuplicateFuncDef = (path: NodePath) => {
      warnings.add(
        warnDuplicateFunctionDefinitionSync(
          file,
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
            visited,
            pkg,
            updates,
            errors,
            warnings,
            file,
            parsingOptions,
            importedFunctionsMap,
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
            pkg,
            updates,
            errors,
            warnings,
            visited,
            unwrappedExpressions,
            file,
            parsingOptions,
            importedFunctionsMap,
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
          result = processFunctionInFile({
            filePath: resolvedPath,
            functionName,
            unwrappedExpressions,
            visited,
            parsingOptions,
            updates,
            errors,
            warnings,
            file,
            pkg,
          });
        }
      }
    }

    // Mark this function search as processed in the cache
    processFunctionCache.set(cacheKey, result !== undefined);
  } catch {
    // Silently skip files that can't be parsed or accessed
    // Still mark as processed to avoid retrying failed parses
    processFunctionCache.set(cacheKey, false);
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
  updates,
  errors,
  warnings,
  file,
  parsingOptions,
  importedFunctionsMap,
  pkg,
}: {
  functionName: string;
  path: NodePath<t.FunctionDeclaration>;
  importAliases: Record<string, string>;
  unwrappedExpressions: string[];
  visited: Set<string>;
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
  file: string;
  parsingOptions: ParsingConfigOptions;
  importedFunctionsMap: Map<string, string>;
  pkg: 'gt-react' | 'gt-next';
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
      // Requires depth 0
      result.branches.push(
        processReturnExpression({
          unwrappedExpressions,
          functionName,
          pkg,
          scopeNode: returnPath,
          node: returnPath.node.argument,
          importAliases,
          visited,
          updates,
          errors,
          warnings,
          file,
          parsingOptions,
          importedFunctionsMap,
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
 * TODO: handle no return eg const getInfo = () => "value"
 *
 * IMPORTANT: the RHand value must be the function definition, or this will fail
 */
function processVariableDeclarationNodePath({
  functionName,
  path,
  importAliases,
  unwrappedExpressions,
  visited,
  updates,
  errors,
  warnings,
  file,
  parsingOptions,
  importedFunctionsMap,
  pkg,
}: {
  functionName: string;
  path: NodePath<t.VariableDeclarator>;
  importAliases: Record<string, string>;
  unwrappedExpressions: string[];
  visited: Set<string>;
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
  file: string;
  parsingOptions: ParsingConfigOptions;
  importedFunctionsMap: Map<string, string>;
  pkg: 'gt-react' | 'gt-next';
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

  if (t.isExpression(arrowFunctionPath.node.body)) {
    // process expression return
    result.branches.push(
      processReturnExpression({
        unwrappedExpressions,
        functionName,
        pkg,
        scopeNode: arrowFunctionPath,
        node: arrowFunctionPath.node.body,
        importAliases,
        visited,
        updates,
        errors,
        warnings,
        file,
        parsingOptions,
        importedFunctionsMap,
      })
    );
  } else {
    // search for a return statement
    arrowFunctionPath.get('body').traverse({
      Function(path) {
        path.skip();
      },
      ReturnStatement(returnPath) {
        result.branches.push(
          processReturnExpression({
            unwrappedExpressions,
            functionName,
            pkg,
            scopeNode: returnPath,
            node: returnPath.node.argument,
            importAliases,
            visited,
            updates,
            errors,
            warnings,
            file,
            parsingOptions,
            importedFunctionsMap,
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
 * Process a expression being returned from a function
 * // TODO: here add ternary
 */
function processReturnExpression({
  unwrappedExpressions,
  scopeNode,
  node,
  importAliases,
  visited,
  updates,
  errors,
  warnings,
  file,
  parsingOptions,
  importedFunctionsMap,
  functionName,
  pkg,
}: {
  functionName: string;
  unwrappedExpressions: string[];
  scopeNode: NodePath;
  node: t.Expression | null | undefined;
  importAliases: Record<string, string>;
  visited: Set<string>;
  updates: Updates;
  errors: string[];
  warnings: Set<string>;
  file: string;
  parsingOptions: ParsingConfigOptions;
  importedFunctionsMap: Map<string, string>;
  pkg: 'gt-react' | 'gt-next';
}): JsxTree | MultiplicationNode {
  // If the node is null, return
  if (node == null) return null;

  // Remove parentheses if they exist
  if (t.isParenthesizedExpression(node)) {
    // ex: return (value)
    return processReturnExpression({
      unwrappedExpressions,
      importAliases,
      scopeNode,
      node: node.expression,
      visited,
      updates,
      errors,
      warnings,
      file,
      parsingOptions,
      functionName,
      importedFunctionsMap,
      pkg,
    });
  } else if (t.isCallExpression(node) && t.isIdentifier(node.callee)) {
    // ex: return someFunc()
    const callee = node.callee;
    const calleeBinding = scopeNode.scope.getBinding(callee.name);
    if (!calleeBinding) {
      warnFunctionNotFoundSync(
        file,
        callee.name,
        `${callee.loc?.start?.line}:${callee.loc?.start?.column}`
      );
      return null;
    }
    // Function is found locally
    return resolveStaticFunctionInvocationFromBinding({
      importAliases,
      calleeBinding,
      callee,
      unwrappedExpressions,
      visited,
      file,
      updates,
      errors,
      warnings,
      pkg,
      parsingOptions,
      importedFunctionsMap,
    });
  } else if (
    t.isAwaitExpression(node) &&
    t.isCallExpression(node.argument) &&
    t.isIdentifier(node.argument.callee)
  ) {
    // ex: return await someFunc()
    const callee = node.argument.callee;
    const calleeBinding = scopeNode.scope.getBinding(callee.name);
    if (!calleeBinding) {
      warnFunctionNotFoundSync(
        file,
        callee.name,
        `${callee.loc?.start?.line}:${callee.loc?.start?.column}`
      );
      return null;
    }
    // Function is found locally
    return resolveStaticFunctionInvocationFromBinding({
      importAliases,
      calleeBinding,
      callee,
      unwrappedExpressions,
      visited,
      file,
      updates,
      errors,
      warnings,
      pkg,
      parsingOptions,
      importedFunctionsMap,
    });
  } else if (t.isJSXElement(node) || t.isJSXFragment(node)) {
    // ex: return <div>Jsx content</div>
    return buildJSXTree({
      importAliases,
      node,
      unwrappedExpressions,
      visited,
      updates,
      errors,
      warnings,
      file,
      insideT: true,
      parsingOptions,
      scopeNode,
      importedFunctionsMap,
      pkg,
    });
  } else {
    // Handle static expressions (e.g. return 'static string')
    const staticAnalysis = isStaticExpression(node);
    if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
      // Preserve the exact whitespace for static string expressions
      return staticAnalysis.value;
    }
    // reject
    errors.push(
      warnInvalidReturnExpressionSync(
        file,
        functionName,
        generate(node).code,
        `${scopeNode.node.loc?.start?.line}:${scopeNode.node.loc?.start?.column}`
      )
    );
    return null;
  }
}
