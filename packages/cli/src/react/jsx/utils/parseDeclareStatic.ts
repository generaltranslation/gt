import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { ParsingConfigOptions } from '../../../types/parsing.js';
import { parseStringExpression, nodeToStrings } from './parseString.js';
import { Node } from './types.js';
import { buildImportMap } from './buildImportMap.js';
import { resolveImportPath } from './resolveImportPath.js';
import { parse } from '@babel/parser';
import fs from 'node:fs';
import {
  warnFunctionNotFoundSync,
  warnDeclareStaticNoResultsSync,
  warnDeclareStaticNotWrappedSync,
} from '../../../console/index.js';

import traverseModule from '@babel/traverse';
// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

// Nested arrays of strings (deprecated - kept for backwards compatibility)
export type StringTree = (string | StringTree)[];

/**
 * Cache for resolved import paths to avoid redundant I/O operations.
 * Key: `${currentFile}::${importPath}`
 * Value: resolved absolute path or null
 */
const resolveImportPathCache = new Map<string, string | null>();

/**
 * Cache for processed functions to avoid re-parsing the same files.
 * Key: `${filePath}::${functionName}`
 * Value: Node result or null
 */
const processFunctionCache = new Map<string, Node | null>();

/**
 * Checks if an expression is static or uses declareStatic
 * Returns a Node representing the parsed expression
 * @param expr - The expression to check
 * @param tPath - NodePath for scope resolution
 * @param file - Current file path
 * @param parsingOptions - Parsing configuration
 * @returns Node | null - The parsed node, or null if invalid
 */
export function handleStaticExpression(
  expr: t.Expression,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  errors: string[]
): Node | null {
  if (!expr) {
    return null;
  }

  // Handle expressions
  if (t.isCallExpression(expr)) {
    const variants = getDeclareStaticVariants(
      expr,
      tPath,
      file,
      parsingOptions,
      errors
    );
    if (variants) {
      // We found declareStatic -> return as ChoiceNode
      return {
        type: 'choice',
        nodes: variants.map((v) => ({ type: 'text', text: v })),
      };
    }

    // Call has no results
    errors.push(
      warnDeclareStaticNoResultsSync(
        file,
        expr.arguments[0].toString(),
        `${expr.loc?.start?.line}:${expr.loc?.start?.column}`
      )
    );

    return null;
  }

  // Handle direct string literals
  if (t.isStringLiteral(expr)) {
    return { type: 'text', text: expr.value };
  }

  // Handle template literals
  if (t.isTemplateLiteral(expr)) {
    const parts: Node[] = [];
    for (let index = 0; index < expr.quasis.length; index++) {
      const quasi = expr.quasis[index];
      const text = quasi.value.cooked ?? quasi.value.raw ?? '';
      if (text) {
        parts.push({ type: 'text', text });
      }
      const exprNode = expr.expressions[index];
      if (exprNode && t.isExpression(exprNode)) {
        const result = handleStaticExpression(
          exprNode,
          tPath,
          file,
          parsingOptions,
          errors
        );
        if (result === null) {
          // Early bailout if we can't handle something inside interpolation
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

  // Handle binary expressions
  if (t.isBinaryExpression(expr) && expr.operator === '+') {
    if (!t.isExpression(expr.left) || !t.isExpression(expr.right)) {
      return null;
    }
    const leftResult = handleStaticExpression(
      expr.left,
      tPath,
      file,
      parsingOptions,
      errors
    );
    const rightResult = handleStaticExpression(
      expr.right,
      tPath,
      file,
      parsingOptions,
      errors
    );

    if (leftResult === null || rightResult === null) {
      return null;
    }

    return { type: 'sequence', nodes: [leftResult, rightResult] };
  }

  // Handle parenthesized expressions
  if (t.isParenthesizedExpression(expr)) {
    return handleStaticExpression(
      expr.expression,
      tPath,
      file,
      parsingOptions,
      errors
    );
  }

  // Handle numeric literals by converting them to strings
  if (t.isNumericLiteral(expr)) {
    return { type: 'text', text: String(expr.value) };
  }

  // Handle unary expressions by converting them to strings
  if (t.isUnaryExpression(expr)) {
    let operator = '';
    if (expr.operator === '-') {
      operator = expr.operator;
    }
    if (t.isNumericLiteral(expr.argument)) {
      if (expr.argument.value === 0) {
        return { type: 'text', text: '0' };
      } else {
        return {
          type: 'text',
          text: operator + expr.argument.value.toString(),
        };
      }
    } else {
      // invalid
      return null;
    }
  }

  // Handle boolean literals by converting them to strings
  if (t.isBooleanLiteral(expr)) {
    return { type: 'text', text: String(expr.value) };
  }

  // Handle null literal
  if (t.isNullLiteral(expr)) {
    return { type: 'text', text: 'null' };
  }

  // Not a static expression
  return null;
}

/**
 * Given a CallExpression, if it is declareStatic(<call>) or declareStatic(await <call>),
 * return all possible string outcomes of that argument call as an array of strings.
 *
 * Examples:
 *   declareStatic(time()) -> ["day", "night"]
 *   declareStatic(await time()) -> ["day", "night"]
 *
 * Returns null if it can't be resolved.
 */
export function getDeclareStaticVariants(
  call: t.CallExpression,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  errors: string[]
): string[] | null {
  // Must be declareStatic(...) or an alias of it
  if (!t.isIdentifier(call.callee)) {
    errors.push(
      warnDeclareStaticNotWrappedSync(
        file,
        call.arguments[0].toString(),
        `${call.callee.loc?.start?.line}:${call.callee.loc?.start?.column}`
      )
    );
    return null;
  }

  // Check if this is declareStatic by name or by checking the import
  const calleeName = call.callee.name;
  const calleeBinding = tPath.scope.getBinding(calleeName);

  // If it's not literally named 'declareStatic', check if it's imported from GT
  if (calleeName !== 'declareStatic') {
    if (!calleeBinding) {
      return null;
    }

    // Check if it's imported from a GT package
    if (calleeBinding.path.isImportSpecifier()) {
      const imported = calleeBinding.path.node.imported;
      const originalName = t.isIdentifier(imported)
        ? imported.name
        : imported.value;

      // Only proceed if the original name is 'declareStatic'
      if (originalName !== 'declareStatic') {
        return null;
      }
    } else {
      // Not an import specifier, so it's not declareStatic
      errors.push(
        warnDeclareStaticNotWrappedSync(
          file,
          calleeName,
          `${call.callee.loc?.start?.line}:${call.callee.loc?.start?.column}`
        )
      );
      return null;
    }
  }

  if (call.arguments.length !== 1) return null;

  const arg = call.arguments[0];
  if (!t.isExpression(arg)) return null;

  // Handle await expression: declareStatic(await time())
  if (t.isAwaitExpression(arg)) {
    // Unwrap the await and check if it's a call expression
    if (!t.isCallExpression(arg.argument)) {
      return null;
    }
    // Resolve the inner call's possible string outcomes
    return resolveCallStringVariants(
      arg.argument,
      tPath,
      file,
      parsingOptions,
      errors
    );
  }

  // Handle direct call expression: declareStatic(time())
  if (!t.isCallExpression(arg)) return null;

  // Resolve the inner call's possible string outcomes
  return resolveCallStringVariants(arg, tPath, file, parsingOptions, errors);
}

export function resolveCallStringVariants(
  call: t.CallExpression,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  errors: string[]
): string[] | null {
  const results = new Set<string>();

  // Handle inline arrow functions: declareStatic(() => "day")
  if (t.isArrowFunctionExpression(call.callee)) {
    const body = call.callee.body;

    if (t.isStringLiteral(body)) {
      results.add(body.value);
    } else if (t.isConditionalExpression(body)) {
      collectConditionalStringVariants(body, results);
    }

    return results.size ? [...results] : null;
  }

  // Handle explicit conditional expression call:
  // declareStatic((cond ? "day" : "night")())
  if (t.isConditionalExpression(call.callee)) {
    collectConditionalStringVariants(call.callee, results);
    return results.size ? [...results] : null;
  }

  // Handle function identifier calls: declareStatic(time())
  if (t.isIdentifier(call.callee)) {
    const functionName = call.callee.name;

    // Use Binding to resolve the function
    const calleeBinding = tPath.scope.getBinding(functionName);

    if (calleeBinding) {
      // Check if the binding itself is an import (not just if the name exists in imports)
      const isImportBinding =
        calleeBinding.path.isImportSpecifier() ||
        calleeBinding.path.isImportDefaultSpecifier() ||
        calleeBinding.path.isImportNamespaceSpecifier();

      if (isImportBinding) {
        // Function is imported - resolve cross-file
        const importedFunctionsMap = buildImportMap(
          tPath.scope.getProgramParent().path
        );

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

        const importPath = importedFunctionsMap.get(functionName);
        if (importPath) {
          const filePath = resolveImportPath(
            file,
            importPath,
            parsingOptions,
            resolveImportPathCache
          );

          if (filePath && originalName) {
            const node = resolveFunctionInFile(
              filePath,
              originalName,
              parsingOptions,
              errors
            );
            if (node) {
              return nodeToStrings(node);
            }
          }
        }
      } else {
        // Function is local - use parseStringExpression with resolveFunctionCall
        const node = resolveFunctionCallFromBinding(
          calleeBinding,
          tPath,
          file,
          parsingOptions
        );
        if (node) {
          return nodeToStrings(node);
        }
      }
    } else {
      // Function not found in scope
      errors.push(
        warnFunctionNotFoundSync(
          file,
          functionName,
          `${call.callee.loc?.start?.line}:${call.callee.loc?.start?.column}`
        )
      );
      return null;
    }
  }

  // If we get here: cannot analyze this call statically
  return null;
}

/**
 * Resolves a function from a binding (local function) using parseStringExpression logic
 */
function resolveFunctionCallFromBinding(
  calleeBinding: ReturnType<NodePath['scope']['getBinding']>,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions
): Node | null {
  if (!calleeBinding) {
    return null;
  }

  const bindingPath = calleeBinding.path;
  const branches: Node[] = [];

  // Handle function declarations: function time() { return "day"; }
  if (bindingPath.isFunctionDeclaration()) {
    bindingPath.traverse({
      ReturnStatement(returnPath) {
        // Only process return statements that are direct children of this function
        const parentFunction = returnPath.getFunctionParent();
        if (parentFunction?.node !== bindingPath.node) {
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
          parsingOptions
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
        parsingOptions
      );
      if (bodyResult !== null) {
        branches.push(bodyResult);
      }
    }
    // Handle block body: () => { return "day"; }
    else if (body.isBlockStatement()) {
      const arrowFunction = init.node;
      body.traverse({
        ReturnStatement(returnPath) {
          // Only process return statements that are direct children of this function
          const parentFunction = returnPath.getFunctionParent();
          if (parentFunction?.node !== arrowFunction) {
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
            parsingOptions
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
  errors: string[]
): Node | null {
  // Check cache first
  const cacheKey = `${filePath}::${functionName}`;
  if (processFunctionCache.has(cacheKey)) {
    return processFunctionCache.get(cacheKey) ?? null;
  }

  let result: Node | null = null;

  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      // Handle re-exports: export * from './utils'
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
              errors
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
                errors
              );
              if (reexportResult) {
                result = reexportResult;
              }
            }
          }
        }
      },
      // Handle function declarations: function woah() { ... }
      FunctionDeclaration(path) {
        if (path.node.id?.name === functionName && result === null) {
          const branches: Node[] = [];
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
                parsingOptions
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
      // Handle variable declarations: const woah = () => { ... }
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
          const branches: Node[] = [];

          // Handle expression body: () => "day"
          if (!Array.isArray(bodyPath) && t.isExpression(bodyPath.node)) {
            const bodyResult = parseStringExpression(
              bodyPath.node,
              bodyPath,
              filePath,
              parsingOptions
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
                  parsingOptions
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
    errors.push(
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
 * Handle cond ? "a" : "b"
 * Collects string literals from both branches of a conditional expression
 */
function collectConditionalStringVariants(
  cond: t.ConditionalExpression,
  out: Set<string>
) {
  if (t.isStringLiteral(cond.consequent)) out.add(cond.consequent.value);
  if (t.isStringLiteral(cond.alternate)) out.add(cond.alternate.value);
}
