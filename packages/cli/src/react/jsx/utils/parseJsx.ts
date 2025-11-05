import { Updates } from '../../../types/index.js';

import generateModule from '@babel/generator';
// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

import * as t from '@babel/types';
import fs from 'node:fs';
import { parse } from '@babel/parser';
import addGTIdentifierToSyntaxTree from '../../data-_gt/addGTIdentifierToSyntaxTree.js';
import {
  warnHasUnwrappedExpressionSync,
  warnVariablePropSync,
  warnNestedTComponent,
  warnInvalidStaticChildSync,
  warnInvalidReturnSync,
} from '../../../console/index.js';
import { isAcceptedPluralForm } from 'generaltranslation/internal';
import { handleChildrenWhitespace } from '../trimJsxStringChildren.js';
import { isStaticExpression } from '../evaluateJsx.js';
import {
  GT_ATTRIBUTES,
  mapAttributeName,
  STATIC_COMPONENT,
  TRANSLATION_COMPONENT,
  VARIABLE_COMPONENTS,
} from './constants.js';
import { Metadata, HTML_CONTENT_PROPS } from 'generaltranslation/types';
import { NodePath } from '@babel/traverse';
import { ParsingConfigOptions } from '../../../types/parsing.js';
import { resolveImportPath } from './resolveImportPath.js';

// Handle CommonJS/ESM interop
import traverseModule from '@babel/traverse';
import { buildImportMap } from './buildImportMap.js';
import { getPathsAndAliases } from './getPathsAndAliases.js';
const traverse = traverseModule.default || traverseModule;

type JsxTree = {
  expression?: boolean;
  result?: string;
  type?: string;
  props?: {
    children?: any;
  };
};
type JSXTreeResult = JsxTree | string | null;

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
}):
  | {
      expression?: boolean;
      result?: string;
      type?: string;
      props?: {
        children?: any;
      };
    }
  | string
  | null {
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
    const staticAnalysis = isStaticExpression(expr);
    if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
      // Preserve the exact whitespace for static string expressions
      return {
        expression: true,
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

    if (componentType === 'T' && insideT) {
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
              const staticAnalysis = isStaticExpression(attr.value.expression);
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
                  !isStaticExpression(attr.value.expression).isStatic
                ) {
                  unwrappedExpressions.push(generate(attr.value).code);
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
        return resolveStaticChildren({
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
        // if componentType is undefined, use typeName
        // Basically, if componentType is not a GT component, use typeName such as <div>
        type: componentType ?? typeName,
        props,
      };
    }

    const children = element.children
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
      type: '',
      props,
    };
  }
  // If it's a string literal (standalone)
  else if (t.isStringLiteral(node)) {
    return node.value;
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
  if (
    !(name.type === 'JSXIdentifier' && originalName === TRANSLATION_COMPONENT)
  ) {
    return;
  }
  console.log(
    `<${originalName}> component found at ${file}:${node.loc?.start?.line}:${node.loc?.start?.column}`
  );

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

  let jsxTree = undefined;
  if (treeResult && typeof treeResult === 'object') {
    jsxTree = treeResult.props?.children;
  } else {
    jsxTree = treeResult;
  }

  if (componentWarnings.size > 0) {
    componentWarnings.forEach((warning) => warnings.add(warning));
  }

  if (componentErrors.length > 0) {
    errors.push(...componentErrors);
    return;
  }

  // Handle whitespace in children
  const whitespaceHandledTree = handleChildrenWhitespace(jsxTree);

  // Add GT identifiers to the tree
  let minifiedTree = addGTIdentifierToSyntaxTree(whitespaceHandledTree);
  minifiedTree =
    Array.isArray(minifiedTree) && minifiedTree.length === 1
      ? minifiedTree[0]
      : minifiedTree;

  const id = metadata.id;

  // If we found an unwrapped expression, skip
  if (unwrappedExpressions.length > 0) {
    errors.push(
      warnHasUnwrappedExpressionSync(
        file,
        unwrappedExpressions,
        id,
        `${node.loc?.start?.line}:${node.loc?.start?.column}`
      )
    );
    return;
  }

  // <T> is valid here
  updates.push({
    dataFormat: 'JSX',
    source: minifiedTree,
    metadata,
  });
}

// Parse the props of a <T> component
function parseTProps({
  openingElement,
  metadata,
  componentErrors,
  file,
}: {
  openingElement: t.JSXOpeningElement;
  metadata: Metadata;
  componentErrors: string[];
  file: string;
}) {
  openingElement.attributes.forEach((attr) => {
    if (!t.isJSXAttribute(attr)) return;
    const attrName = attr.name.name;
    if (typeof attrName !== 'string') return;

    if (attr.value) {
      // If it's a plain string literal like id="hello"
      if (t.isStringLiteral(attr.value)) {
        metadata[attrName] = attr.value.value;
      }
      // If it's an expression container like id={"hello"}, id={someVar}, etc.
      else if (t.isJSXExpressionContainer(attr.value)) {
        const expr = attr.value.expression;
        const code = generate(expr).code;

        // Only check for static expressions on id and context props
        if (GT_ATTRIBUTES.includes(attrName)) {
          const staticAnalysis = isStaticExpression(expr);
          if (!staticAnalysis.isStatic) {
            componentErrors.push(
              warnVariablePropSync(
                file,
                attrName,
                code,
                `${expr.loc?.start?.line}:${expr.loc?.start?.column}`
              )
            );
          }
          // Use the static value if available
          if (staticAnalysis.isStatic && staticAnalysis.value !== undefined) {
            metadata[mapAttributeName(attrName)] = staticAnalysis.value;
          } else {
            // Only store the code if we couldn't extract a static value
            metadata[attrName] = code;
          }
        } else {
          // For other attributes that aren't id or context
          metadata[attrName] = code;
        }
      }
    }
  });
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
function resolveStaticChildren({
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
}): JSXTreeResult {
  const result: { type: 'Static'; props: { children: any[] } } = {
    type: 'Static',
    props: {
      children: [],
    },
  };

  for (const child of children) {
    // Ignore whitespace
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
      )
    ) {
      errors.push(
        warnInvalidStaticChildSync(
          file,
          `${child.loc?.start?.line}:${child.loc?.start?.column}`
        )
      );
      return null;
    }

    // Get callee and binding from scope
    const callee = (
      t.isAwaitExpression(child.expression)
        ? (child.expression.argument as t.CallExpression).callee
        : (child.expression as t.CallExpression).callee
    ) as t.Identifier;
    const calleeBinding = scopeNode.scope.getBinding(callee.name);

    if (calleeBinding) {
      // Function is found locally
      resolveStaticInvocation({
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
      });
    } else {
      console.log(
        `[resolveStaticInvocation] function ${callee.name} is not found in the scope or imported`
      );
    }
  }

  return null;
}

function resolveStaticInvocation({
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
}): void {
  if (calleeBinding.path.isFunctionDeclaration()) {
    // Handle function declarations: function getSubject() { ... }
    console.log(
      `function ${callee.name} is a function declaration at ${file}:${calleeBinding.path.node.loc?.start?.line}:${calleeBinding.path.node.loc?.start?.column}`
    );
    processFunctionDeclarationNode({
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
    console.log(
      `function ${callee.name} is a variable declaration at ${file}:${calleeBinding.path.node.loc?.start?.line}:${calleeBinding.path.node.loc?.start?.column}`
    );
    processVariableDeclarationNode({
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
    if (!resolvedPath) {
      console.log(`function ${callee.name} could not be resolved`);
      return;
    }
    processFunctionInFile({
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
  } else {
    console.log(
      `function ${callee.name} is not found in the scope or imported at ${file}:${callee.loc?.start?.line}:${callee.loc?.start?.column}`
    );
  }
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
}): void {
  // Check cache first to avoid redundant parsing
  const cacheKey = `${filePath}::${functionName}`;
  if (processFunctionCache.has(cacheKey)) {
    return;
  }

  // Prevent infinite loops from circular re-exports
  if (visited.has(filePath)) {
    return;
  }
  visited.add(filePath);

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

    let found = false;
    const reExports: string[] = [];

    traverse(ast, {
      // Handle function declarations: function getInfo() { ... }
      FunctionDeclaration(path) {
        if (path.node.id?.name === functionName) {
          found = true;
          processFunctionDeclarationNode({
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
        console.log('var declaration found');
        if (
          t.isIdentifier(path.node.id) &&
          path.node.id.name === functionName &&
          path.node.init &&
          (t.isArrowFunctionExpression(path.node.init) ||
            t.isFunctionExpression(path.node.init))
        ) {
          found = true;
          processVariableDeclarationNode({
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
        console.log('export * found');
        if (t.isStringLiteral(path.node.source)) {
          reExports.push(path.node.source.value);
        }
      },
      // Collect named re-exports: export { foo } from './other'
      ExportNamedDeclaration(path) {
        console.log('export { foo } found');
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
    if (!found && reExports.length > 0) {
      for (const reExportPath of reExports) {
        const resolvedPath = resolveImportPath(
          filePath,
          reExportPath,
          parsingOptions,
          resolveImportPathCache
        );
        if (resolvedPath) {
          processFunctionInFile({
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
    processFunctionCache.set(cacheKey, found);
  } catch {
    console.log(`function ${functionName} could not be parsed at ${filePath}`);
    // Silently skip files that can't be parsed or accessed
    // Still mark as processed to avoid retrying failed parses
    processFunctionCache.set(cacheKey, false);
  }
}

/**
 * Process a function declaration
 * function getInfo() { ... }
 */
function processFunctionDeclarationNode({
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
}): void {
  let functionDepth = 0;
  path.traverse({
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|Method|ObjectMethod':
      {
        enter() {
          functionDepth++;
        },
        exit() {
          functionDepth--;
        },
      },
    ReturnStatement(returnPath) {
      // Requires depth 0
      if (functionDepth !== 0) return;
      console.log('Found return!');
      processReturnStatement({
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
      });
    },
  });
}

/**
 * Process a variable declaration of a function
 * const getInfo = () => { ... }
 */
function processVariableDeclarationNode({
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
}): void {
  let functionDepth = 0;
  path.traverse({
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|Method|ObjectMethod':
      {
        enter() {
          functionDepth++;
        },
        exit() {
          functionDepth--;
        },
      },
    ReturnStatement(returnPath) {
      // Requires two entries
      if (functionDepth === 2) return;
      console.log('Found return!');
      processReturnStatement({
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
      });
    },
  });
}

/**
 * Process a return statement of a function
 */
function processReturnStatement({
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
}): void {
  // If the node is null, return
  if (node == null) return;

  // TODO: multiplication here

  // Remove parentheses if they exist
  if (t.isParenthesizedExpression(node)) {
    // return (value)
    processReturnStatement({
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
    // return someFunc()
    const calleeBinding = scopeNode.scope.getBinding(node.callee.name);
    if (calleeBinding) {
      // Function is found locally
      resolveStaticInvocation({
        importAliases,
        calleeBinding,
        callee: node.callee,
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
    } else {
      console.log(
        `[processReturnStatement] function ${node.callee.name} is not found in the scope or imported`
      );
    }
  } else if (
    t.isAwaitExpression(node) &&
    t.isCallExpression(node.argument) &&
    t.isIdentifier(node.argument.callee)
  ) {
    // return await someFunc()
    const calleeBinding = scopeNode.scope.getBinding(node.argument.callee.name);
    if (calleeBinding) {
      // Function is found locally
      resolveStaticInvocation({
        importAliases,
        calleeBinding,
        callee: node.argument.callee,
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
    } else {
      console.log(
        `[processReturnStatement] function ${node.argument.callee.name} is not found in the scope or imported`
      );
    }
  } else if (t.isJSXElement(node) || t.isJSXFragment(node)) {
    // return <div>Jsx content</div>
    buildJSXTree({
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
  } else if (t.isStringLiteral(node)) {
    // string literal
    if (!isStaticExpression(node).isStatic) {
      errors.push(
        warnInvalidReturnSync(
          file,
          functionName,
          `${scopeNode.node.loc?.start?.line}:${scopeNode.node.loc?.start?.column}`
        )
      );
    }
    // TODO: add to updates
  } else {
    // reject
    errors.push(
      warnInvalidReturnSync(
        file,
        functionName,
        `${scopeNode.node.loc?.start?.line}:${scopeNode.node.loc?.start?.column}`
      )
    );
  }
}
