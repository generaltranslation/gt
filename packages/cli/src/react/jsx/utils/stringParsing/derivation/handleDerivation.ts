import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { parseStringExpression, nodeToStrings } from '../../parseString.js';
import { StringNode } from '../../types.js';
import { buildImportMap } from '../../buildImportMap.js';
import { resolveImportPath } from '../../resolveImportPath.js';
import { parse } from '@babel/parser';
import fs from 'node:fs';
import {
  warnFunctionNotFoundSync,
  warnDeriveFunctionNoResultsSync,
  warnDeriveFunctionNotWrappedSync,
  warnNonStringSync,
  warnInvalidIcuSync,
} from '../../../../../console/index.js';

import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import { isDeriveCall } from './isDeriveCall.js';
import { InlineMetadata } from '../processTranslationCall/extractStringEntryMetadata.js';
import { ParsingConfig, ParsingOutput } from '../types.js';
import { isValidIcu } from '../../../evaluateJsx.js';
import { indexVars } from 'generaltranslation/internal';
import { randomUUID } from 'node:crypto';
// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

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
const processFunctionCache = new Map<string, StringNode | null>();

/**
 * Extracts content if an expression is derivable (statically analyzable) or uses derive()
 * Returns a Node representing the parsed expression
 * @param expr - The expression to check
 * @param tPath - NodePath for scope resolution
 * @param file - Current file path
 * @param parsingOptions - Parsing configuration
 * @param errors - Errors to add to
 * @param enableRuntimeInterpolation - For template macros, enables runtime interpolation for non-derive calls
 * @returns Node | null - The parsed node, or null if invalid
 *
 * @note enableRuntimeInterpolation
 *  - Only mark true on entry for template macros, otherwise always false
 *  - t`Hello {nonDerivableValue}` -> t`Hello {0}`
 */
export function handleDerivation({
  expr,
  tPath,
  file,
  parsingOptions,
  errors,
  enableRuntimeInterpolation = false,
}: {
  expr: t.Expression;
  tPath: NodePath;
  file: string;
  parsingOptions: ParsingConfigOptions;
  errors: string[];
  enableRuntimeInterpolation?: boolean;
}): StringNode | null {
  if (!expr) {
    return null;
  }

  // Handle expressions
  if (t.isCallExpression(expr)) {
    const variants = getDeriveVariants({
      call: expr,
      tPath,
      file,
      parsingOptions,
      errors,
    });
    if (variants) {
      // We found derive() -> return as ChoiceNode
      return {
        type: 'choice',
        nodes: variants.map((v) => ({ type: 'text', text: v })),
      };
    }

    // Call has no results
    const code =
      expr.arguments.length > 0
        ? generate(expr.arguments[0]).code
        : 'no arguments';
    errors.push(
      warnDeriveFunctionNoResultsSync(
        file,
        code,
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
    const parts: StringNode[] = [];
    let runtimeInterpolationIndex = 0;
    for (let index = 0; index < expr.quasis.length; index++) {
      const quasi = expr.quasis[index];
      const text = quasi.value.cooked ?? quasi.value.raw ?? '';
      if (text) {
        parts.push({ type: 'text', text });
      }
      const exprNode = expr.expressions[index];
      if (exprNode && t.isExpression(exprNode)) {
        if (
          enableRuntimeInterpolation &&
          !isDeriveCall({ expr: exprNode, tPath })
        ) {
          parts.push({ type: 'text', text: `{${runtimeInterpolationIndex}}` });
          runtimeInterpolationIndex++;
        } else {
          const result = handleDerivation({
            expr: exprNode,
            tPath,
            file,
            parsingOptions,
            errors,
          });
          if (result === null) {
            // Early bailout if we can't handle something inside interpolation
            return null;
          }
          parts.push(result);
        }
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
    const leftResult = handleDerivation({
      expr: expr.left,
      tPath,
      file,
      parsingOptions,
      errors,
    });
    const rightResult = handleDerivation({
      expr: expr.right,
      tPath,
      file,
      parsingOptions,
      errors,
    });

    if (leftResult === null || rightResult === null) {
      return null;
    }

    return { type: 'sequence', nodes: [leftResult, rightResult] };
  }

  // Handle parenthesized expressions
  if (t.isParenthesizedExpression(expr)) {
    return handleDerivation({
      expr: expr.expression,
      tPath,
      file,
      parsingOptions,
      errors,
    });
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

  // Not a derivable expression
  return null;
}

/**
 * Given a CallExpression, if it is derive(<call>) or derive(await <call>),
 * return all possible string outcomes of that argument call as an array of strings.
 *
 * Examples:
 *   derive(time()) -> ["day", "night"]
 *   derive(await time()) -> ["day", "night"]
 *
 * Returns null if it can't be resolved.
 */
function getDeriveVariants({
  call,
  tPath,
  file,
  parsingOptions,
  errors,
}: {
  call: t.CallExpression;
  tPath: NodePath;
  file: string;
  parsingOptions: ParsingConfigOptions;
  errors: string[];
}): string[] | null {
  // --- Validate Callee --- //

  // Must be a derive(...) call or an alias of it
  if (!isDeriveCall({ expr: call, tPath })) {
    const calleeName = t.isIdentifier(call.callee)
      ? call.callee.name
      : generate(call.callee).code;
    errors.push(
      warnDeriveFunctionNotWrappedSync(
        file,
        calleeName,
        `${call.callee.loc?.start?.line}:${call.callee.loc?.start?.column}`
      )
    );
    return null;
  }

  // --- Validate Arguments --- //

  if (call.arguments.length !== 1) return null;

  const arg = call.arguments[0];
  if (!t.isExpression(arg)) return null;

  // Handle await expression: derive(await time())
  if (t.isAwaitExpression(arg)) {
    // Resolve the inner call's possible string outcomes
    return resolveCallStringVariants(
      arg.argument,
      tPath,
      file,
      parsingOptions,
      errors
    );
  }
  // Resolve the inner call's possible string outcomes
  return resolveCallStringVariants(arg, tPath, file, parsingOptions, errors);
}

function resolveCallStringVariants(
  expression: t.Expression,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  errors: string[]
): string[] | null {
  // Handle function identifier calls: derive(time())
  if (t.isCallExpression(expression) && t.isIdentifier(expression.callee)) {
    const functionName = expression.callee.name;

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
          `${expression.callee.loc?.start?.line}:${expression.callee.loc?.start?.column}`
        )
      );
      return null;
    }
  }

  // If we get here: analyze this call as derivable (statically analyzable)
  const node = parseStringExpression(expression, tPath, file, parsingOptions);
  if (node) {
    return nodeToStrings(node);
  }
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
): StringNode | null {
  if (!calleeBinding) {
    return null;
  }

  const bindingPath = calleeBinding.path;
  const branches: StringNode[] = [];

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
          const branches: StringNode[] = [];

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
      warnDeriveFunctionNoResultsSync(
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
