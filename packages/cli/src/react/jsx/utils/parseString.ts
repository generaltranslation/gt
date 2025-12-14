import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { ParsingConfigOptions } from '../../../types/parsing.js';
import { StringNode } from './types.js';
import { buildImportMap } from './buildImportMap.js';
import { resolveImportPath } from './resolveImportPath.js';
import { parse } from '@babel/parser';
import fs from 'node:fs';
import {
  warnDeclareStaticNoResultsSync,
  warnFunctionNotFoundSync,
  warnInvalidDeclareVarNameSync,
} from '../../../console/index.js';

import traverseModule from '@babel/traverse';
import { DECLARE_VAR_FUNCTION, GT_LIBRARIES, GTLibrary } from './constants.js';
import { declareVar } from 'generaltranslation/internal';
import { isStaticExpression } from '../evaluateJsx.js';
import generateModule from '@babel/generator';
// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/**
 * Cache for resolved import paths to avoid redundant I/O operations.
 */
const resolveImportPathCache = new Map<string, string | null>();

/**
 * Cache for processed functions to avoid re-parsing the same files.
 */
const processFunctionCache = new Map<string, StringNode | null>();

/**
 * Processes a string expression node and resolves any function calls within it
 * This handles cases like:
 *   - "hello" (string literal)
 *   - "hello" + world() (binary expression with function call)
 *   - Math.random() > 0.5 ? "day" : "night" (conditional expression)
 *   - greeting() (function call that returns string or conditional)
 *
 * @param node - The AST node to process
 * @param tPath - NodePath for scope resolution
 * @param file - Current file path
 * @param parsingOptions - Parsing configuration
 * @param warnings - Set to collect warning messages
 * @returns Node | null
 */
export function parseStringExpression(
  node: t.Node,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  warnings: Set<string> = new Set()
): StringNode | null {
  // Handle string literals
  if (t.isStringLiteral(node)) {
    return { type: 'text', text: node.value };
  }

  // Handle numeric literals
  if (t.isNumericLiteral(node)) {
    return { type: 'text', text: String(node.value) };
  }

  // Handle boolean literals
  if (t.isBooleanLiteral(node)) {
    return { type: 'text', text: String(node.value) };
  }

  // Handle null literal
  if (t.isNullLiteral(node)) {
    return { type: 'text', text: 'null' };
  }

  // Handle template literals
  if (t.isTemplateLiteral(node)) {
    const parts: StringNode[] = [];

    for (let index = 0; index < node.quasis.length; index++) {
      const quasi = node.quasis[index];
      const text = quasi.value.cooked ?? quasi.value.raw ?? '';
      if (text) {
        parts.push({ type: 'text', text });
      }
      const exprNode = node.expressions[index];
      if (exprNode && t.isExpression(exprNode)) {
        const result = parseStringExpression(
          exprNode,
          tPath,
          file,
          parsingOptions,
          warnings
        );
        if (result === null) {
          return null;
        }
        parts.push(result);
      }
    }

    if (parts.length === 0) {
      return { type: 'text', text: '' };
    }
    if (parts.length === 1) {
      return parts[0];
    }
    return { type: 'sequence', nodes: parts };
  }

  // Handle binary expressions (e.g., "hello" + world())
  if (t.isBinaryExpression(node) && node.operator === '+') {
    if (!t.isExpression(node.left) || !t.isExpression(node.right)) {
      return null;
    }

    const leftResult = parseStringExpression(
      node.left,
      tPath,
      file,
      parsingOptions,
      warnings
    );
    const rightResult = parseStringExpression(
      node.right,
      tPath,
      file,
      parsingOptions,
      warnings
    );

    if (leftResult === null || rightResult === null) {
      return null;
    }

    return { type: 'sequence', nodes: [leftResult, rightResult] };
  }

  // Handle conditional expressions (e.g., cond ? "day" : "night")
  if (t.isConditionalExpression(node)) {
    if (!t.isExpression(node.consequent) || !t.isExpression(node.alternate)) {
      return null;
    }

    const consequentResult = parseStringExpression(
      node.consequent,
      tPath,
      file,
      parsingOptions,
      warnings
    );
    const alternateResult = parseStringExpression(
      node.alternate,
      tPath,
      file,
      parsingOptions,
      warnings
    );

    if (consequentResult === null || alternateResult === null) {
      return null;
    }

    // Create a choice node with both branches
    return {
      type: 'choice',
      nodes: [consequentResult, alternateResult],
    };
  }

  // Handle variable references (e.g., result)
  if (t.isIdentifier(node)) {
    const binding = tPath.scope.getBinding(node.name);

    if (!binding) {
      // Variable not found in scope
      return null;
    }

    // Check if it's a const/let/var with an initializer
    if (binding.path.isVariableDeclarator() && binding.path.node.init) {
      const init = binding.path.node.init;
      if (t.isExpression(init)) {
        // Recursively resolve the initializer
        return parseStringExpression(
          init,
          binding.path,
          file,
          parsingOptions,
          warnings
        );
      }
    }

    // Not a resolvable variable
    return null;
  }

  // Handle function calls (e.g., getName())
  if (t.isCallExpression(node) && t.isIdentifier(node.callee)) {
    const functionName = node.callee.name;
    const calleeBinding = tPath.scope.getBinding(functionName);

    if (!calleeBinding) {
      // Function not found in scope
      warnings.add(
        warnFunctionNotFoundSync(
          file,
          functionName,
          `${node.callee.loc?.start?.line}:${node.callee.loc?.start?.column}`
        )
      );
      return null;
    }

    // Check if this is an imported function
    const programPath = tPath.scope.getProgramParent().path;
    const importedFunctionsMap = buildImportMap(programPath);

    if (importedFunctionsMap.has(functionName)) {
      // Function is imported - resolve cross-file
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

      const importPath = importedFunctionsMap.get(functionName)!;

      // Handle declareVar function
      if (
        originalName === DECLARE_VAR_FUNCTION &&
        GT_LIBRARIES.includes(importPath as GTLibrary)
      ) {
        // check for name field eg declareVar('test', { $name: 'test' })
        if (
          node.arguments.length > 1 &&
          t.isObjectExpression(node.arguments[1])
        ) {
          const name = node.arguments[1].properties
            .filter((prop) => t.isObjectProperty(prop))
            .find(
              (prop) => t.isIdentifier(prop.key) && prop.key.name === '$name'
            )?.value;
          if (name) {
            if (!t.isExpression(name)) {
              warnings.add(
                warnInvalidDeclareVarNameSync(
                  file,
                  generate(name).code,
                  `${node.arguments[1].loc?.start?.line}:${node.arguments[1].loc?.start?.column}`
                )
              );
              return null;
            }
            const staticResult = isStaticExpression(name);
            if (!staticResult.isStatic) {
              warnings.add(
                warnInvalidDeclareVarNameSync(
                  file,
                  generate(name).code,
                  `${node.arguments[1].loc?.start?.line}:${node.arguments[1].loc?.start?.column}`
                )
              );
              return null;
            }
            return {
              type: 'text',
              text: declareVar('', { $name: staticResult.value }),
            };
          }
        }
        return {
          type: 'text',
          text: declareVar(''),
        };
      }

      const filePath = resolveImportPath(
        file,
        importPath,
        parsingOptions,
        resolveImportPathCache
      );

      if (filePath && originalName) {
        return resolveFunctionInFile(
          filePath,
          originalName,
          parsingOptions,
          warnings
        );
      }
      return null;
    }

    // Resolve the function locally and get its return values
    return resolveFunctionCall(
      calleeBinding,
      tPath,
      file,
      parsingOptions,
      warnings
    );
  }

  // Handle parenthesized expressions
  if (t.isParenthesizedExpression(node)) {
    return parseStringExpression(
      node.expression,
      tPath,
      file,
      parsingOptions,
      warnings
    );
  }

  // Handle unary expressions (e.g., -123)
  if (t.isUnaryExpression(node)) {
    let operator = '';
    if (node.operator === '-') {
      operator = node.operator;
    }
    if (t.isNumericLiteral(node.argument)) {
      if (node.argument.value === 0) {
        return { type: 'text', text: '0' };
      } else {
        return {
          type: 'text',
          text: operator + node.argument.value.toString(),
        };
      }
    }
    return null;
  }

  // Unsupported expression type
  return null;
}

/**
 * Resolves a function call by traversing its body and collecting return values
 */
function resolveFunctionCall(
  calleeBinding: ReturnType<NodePath['scope']['getBinding']>,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  warnings: Set<string>
): StringNode | null {
  if (!calleeBinding) {
    return null;
  }

  const bindingPath = calleeBinding.path;
  const branches: StringNode[] = [];

  // Handle function declarations: function time() { return "day"; }
  if (bindingPath.isFunctionDeclaration()) {
    bindingPath.traverse({
      // Don't skip nested functions - let parseStringExpression handle function calls
      ReturnStatement(returnPath) {
        // Only process return statements that are direct children of this function
        // Skip return statements from nested functions (they'll be handled when those functions are called)
        const parentFunction = returnPath.getFunctionParent();
        if (parentFunction?.node !== bindingPath.node) {
          // This return belongs to a nested function, skip it
          return;
        }

        const returnArg = returnPath.node.argument;
        if (!returnArg || !t.isExpression(returnArg)) {
          return;
        }
        const returnResult = parseStringExpression(
          returnArg,
          returnPath,
          file,
          parsingOptions,
          warnings
        );
        if (returnResult !== null) {
          branches.push(returnResult);
        }
      },
    });
  }
  // Handle arrow functions: const time = () => "day"
  else if (bindingPath.isVariableDeclarator()) {
    const init = bindingPath.get('init');
    if (!init.isArrowFunctionExpression()) {
      return null;
    }

    const body = init.get('body');

    // Handle expression body: () => "day"
    if (body.isExpression()) {
      const bodyResult = parseStringExpression(
        body.node,
        body,
        file,
        parsingOptions,
        warnings
      );
      if (bodyResult !== null) {
        branches.push(bodyResult);
      }
    }
    // Handle block body: () => { return "day"; }
    else if (body.isBlockStatement()) {
      const arrowFunction = init.node;
      body.traverse({
        // Don't skip nested functions - let parseStringExpression handle function calls
        ReturnStatement(returnPath) {
          // Only process return statements that are direct children of this function
          // Skip return statements from nested functions (they'll be handled when those functions are called)
          const parentFunction = returnPath.getFunctionParent();
          if (parentFunction?.node !== arrowFunction) {
            // This return belongs to a nested function, skip it
            return;
          }

          const returnArg = returnPath.node.argument;
          if (!returnArg || !t.isExpression(returnArg)) {
            return;
          }
          const returnResult = parseStringExpression(
            returnArg,
            returnPath,
            file,
            parsingOptions,
            warnings
          );
          if (returnResult !== null) {
            branches.push(returnResult);
          }
        },
      });
    }
  }

  if (branches.length === 0) {
    return null;
  }

  if (branches.length === 1) {
    return branches[0];
  }

  return { type: 'choice', nodes: branches };
}

/**
 * Resolves a function definition in an external file
 */
function resolveFunctionInFile(
  filePath: string,
  functionName: string,
  parsingOptions: ParsingConfigOptions,
  warnings: Set<string>
): StringNode | null {
  // Check cache first
  const cacheKey = `${filePath}::${functionName}`;
  if (processFunctionCache.has(cacheKey)) {
    return processFunctionCache.get(cacheKey) ?? null;
  }

  let result: StringNode | null = null;

  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      // Handle re-exports: export * from './utils1'
      ExportAllDeclaration(path) {
        // Only follow re-exports if we haven't found the function yet
        if (result !== null) return;

        if (t.isStringLiteral(path.node.source)) {
          const reexportPath = path.node.source.value;
          const resolvedPath = resolveImportPath(
            filePath,
            reexportPath,
            parsingOptions,
            resolveImportPathCache
          );

          if (resolvedPath) {
            // Recursively resolve in the re-exported file
            const reexportResult = resolveFunctionInFile(
              resolvedPath,
              functionName,
              parsingOptions,
              warnings
            );
            if (reexportResult) {
              result = reexportResult;
            }
          }
        }
      },
      // Handle named re-exports: export { fn1 } from './utils'
      ExportNamedDeclaration(path) {
        // Only follow re-exports if we haven't found the function yet
        if (result !== null) return;

        // Check if this is a re-export with a source
        if (path.node.source && t.isStringLiteral(path.node.source)) {
          // Check if any of the exported specifiers match our function name
          const hasMatchingExport = path.node.specifiers.some((spec) => {
            if (t.isExportSpecifier(spec)) {
              const exportedName = t.isIdentifier(spec.exported)
                ? spec.exported.name
                : spec.exported.value;
              return exportedName === functionName;
            }
            return false;
          });

          if (hasMatchingExport) {
            const reexportPath = path.node.source.value;
            const resolvedPath = resolveImportPath(
              filePath,
              reexportPath,
              parsingOptions,
              resolveImportPathCache
            );

            if (resolvedPath) {
              // Find the original name in case it was renamed
              const specifier = path.node.specifiers.find((spec) => {
                if (t.isExportSpecifier(spec)) {
                  const exportedName = t.isIdentifier(spec.exported)
                    ? spec.exported.name
                    : spec.exported.value;
                  return exportedName === functionName;
                }
                return false;
              });

              let originalName = functionName;
              if (
                specifier &&
                t.isExportSpecifier(specifier) &&
                t.isIdentifier(specifier.local)
              ) {
                originalName = specifier.local.name;
              }

              // Recursively resolve in the re-exported file
              const reexportResult = resolveFunctionInFile(
                resolvedPath,
                originalName,
                parsingOptions,
                warnings
              );
              if (reexportResult) {
                result = reexportResult;
              }
            }
          }
        }
      },
      // Handle function declarations: function interjection() { ... }
      FunctionDeclaration(path) {
        if (path.node.id?.name === functionName && result === null) {
          const branches: StringNode[] = [];
          path.traverse({
            Function(innerPath) {
              // Skip nested functions
              innerPath.skip();
            },
            ReturnStatement(returnPath: NodePath) {
              if (!t.isReturnStatement(returnPath.node)) {
                return;
              }
              const returnArg = returnPath.node.argument;
              if (!returnArg || !t.isExpression(returnArg)) {
                return;
              }
              const returnResult = parseStringExpression(
                returnArg,
                returnPath,
                filePath,
                parsingOptions,
                warnings
              );
              if (returnResult !== null) {
                branches.push(returnResult);
              }
            },
          });

          if (branches.length === 1) {
            result = branches[0];
          } else if (branches.length > 1) {
            result = { type: 'choice', nodes: branches };
          }
        }
      },
      // Handle variable declarations: const interjection = () => { ... }
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.id) &&
          path.node.id.name === functionName &&
          path.node.init &&
          (t.isArrowFunctionExpression(path.node.init) ||
            t.isFunctionExpression(path.node.init)) &&
          result === null
        ) {
          const init = path.get('init');
          if (
            !init.isArrowFunctionExpression() &&
            !init.isFunctionExpression()
          ) {
            return;
          }

          const bodyPath = init.get('body');
          const branches: StringNode[] = [];

          // Handle expression body: () => "day"
          if (!Array.isArray(bodyPath) && t.isExpression(bodyPath.node)) {
            const bodyResult = parseStringExpression(
              bodyPath.node,
              bodyPath,
              filePath,
              parsingOptions,
              warnings
            );
            if (bodyResult !== null) {
              branches.push(bodyResult);
            }
          }
          // Handle block body: () => { return "day"; }
          else if (
            !Array.isArray(bodyPath) &&
            t.isBlockStatement(bodyPath.node)
          ) {
            const arrowFunction = init.node;
            bodyPath.traverse({
              Function(innerPath: NodePath) {
                // Skip nested functions
                innerPath.skip();
              },
              ReturnStatement(returnPath: NodePath) {
                // Only process return statements that are direct children of this function
                const parentFunction = returnPath.getFunctionParent();
                if (parentFunction?.node !== arrowFunction) {
                  return;
                }

                if (!t.isReturnStatement(returnPath.node)) {
                  return;
                }
                const returnArg = returnPath.node.argument;
                if (!returnArg || !t.isExpression(returnArg)) {
                  return;
                }
                const returnResult = parseStringExpression(
                  returnArg,
                  returnPath,
                  filePath,
                  parsingOptions,
                  warnings
                );
                if (returnResult !== null) {
                  branches.push(returnResult);
                }
              },
            });
          }

          if (branches.length === 1) {
            result = branches[0];
          } else if (branches.length > 1) {
            result = { type: 'choice', nodes: branches };
          }
        }
      },
    });
  } catch (error) {
    // File read or parse error - return null
    warnings.add(
      warnDeclareStaticNoResultsSync(
        filePath,
        functionName,
        'file read/parse error: ' + error
      )
    );
    result = null;
  }

  // Cache the result
  processFunctionCache.set(cacheKey, result);
  return result;
}

/**
 * Converts a Node tree to an array of all possible string combinations
 * This is a helper function for compatibility with existing code
 */
export function nodeToStrings(node: StringNode | null): string[] {
  if (node === null) {
    return [];
  }

  // Handle TextNode
  if (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'text'
  ) {
    return [node.text];
  }

  // Handle SequenceNode - concatenate all parts
  if (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'sequence'
  ) {
    const partResults: string[][] = node.nodes.map((n) => nodeToStrings(n));
    return cartesianProduct(partResults);
  }

  // Handle ChoiceNode - flatten all branches
  if (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'choice'
  ) {
    const allStrings: string[] = [];
    for (const branch of node.nodes) {
      allStrings.push(...nodeToStrings(branch));
    }
    return [...new Set(allStrings)]; // Deduplicate
  }

  return [];
}

/**
 * Creates cartesian product of string arrays and concatenates them
 * @example cartesianProduct([["Hello "], ["day", "night"]]) → ["Hello day", "Hello night"]
 */
function cartesianProduct(arrays: string[][]): string[] {
  if (arrays.length === 0) {
    return [];
  }

  if (arrays.length === 1) {
    return arrays[0];
  }

  // Start with first array
  let result = arrays[0];

  // Combine with each subsequent array
  for (let i = 1; i < arrays.length; i++) {
    const newResult: string[] = [];
    for (const prev of result) {
      for (const curr of arrays[i]) {
        newResult.push(prev + curr);
      }
    }
    result = newResult;
  }

  return result;
}
