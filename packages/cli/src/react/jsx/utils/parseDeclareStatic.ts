import * as t from '@babel/types';
import { JsxTree, MultiplicationNode } from './jsxParsing/types.js';
import { resolveStaticFunctionInvocationFromBinding } from './jsxParsing/parseJsx.js';
import { NodePath } from '@babel/traverse';
import { buildImportMap } from './buildImportMap.js';
import { ParsingConfigOptions } from '../../../types/parsing.js';
import { resolveImportPath } from './resolveImportPath.js';
import { getCalleeNameFromExpression } from './getCalleeNameFromExpression.js';
import { resolveVariableAliases } from './parseStringFunction.js';
import fs from 'node:fs';
import { parse } from '@babel/parser';
import { getPathsAndAliases } from './getPathsAndAliases.js';

// Nested arrays of strings
export type StringTree = (string | StringTree)[];

/**
 * Checks if an expression is static or uses declareStatic
 * Builds a tree of string values from the expression
 * @param expr - The expression to check
 * @param tree - The tree array to populate with string values
 * @returns boolean - true if the expression is valid (string literals, template literals, or declareStatic calls), false otherwise
 */
export function handleStaticExpression(
  expr: t.Expression,
  tree: StringTree,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  pkg: 'gt-react' | 'gt-next'
): boolean {
  if (!expr) {
    return false;
  }

  // Handle expressions
  if (t.isCallExpression(expr)) {
    const variants = getDeclareStaticVariants(
      expr,
      tPath,
      file,
      parsingOptions,
      pkg
    );
    if (variants) {
      // We found declareStatic -> push the variants array
      tree.push([...variants]);
      return true;
    }
    // We found a call that is not declareStatic -> bail out
    return false;
  }

  // Handle direct string literals
  if (t.isStringLiteral(expr)) {
    tree.push(expr.value);
    return true;
  }

  // Handle template literals
  if (t.isTemplateLiteral(expr)) {
    let isOk = true;
    for (let index = 0; index < expr.quasis.length; index++) {
      const quasi = expr.quasis[index];
      const text = quasi.value.cooked ?? quasi.value.raw ?? '';
      if (text) {
        tree.push(text);
      }
      const exprNode = expr.expressions[index];
      if (exprNode && t.isExpression(exprNode)) {
        if (
          !handleStaticExpression(
            exprNode,
            tree,
            tPath,
            file,
            parsingOptions,
            pkg
          )
        ) {
          // Early bailout if we can’t handle something inside interpolation
          isOk = false;
          break;
        }
      }
    }
    return isOk;
  }

  // Handle binary expressions
  if (t.isBinaryExpression(expr)) {
    if (!t.isExpression(expr.left) || !t.isExpression(expr.right)) {
      return false;
    }
    const leftOk = handleStaticExpression(
      expr.left,
      tree,
      tPath,
      file,
      parsingOptions,
      pkg
    );
    const rightOk = handleStaticExpression(
      expr.right,
      tree,
      tPath,
      file,
      parsingOptions,
      pkg
    );
    return leftOk && rightOk;
  }

  // Handle parenthesized expressions
  if (t.isParenthesizedExpression(expr)) {
    return handleStaticExpression(
      expr.expression,
      tree,
      tPath,
      file,
      parsingOptions,
      pkg
    );
  }

  // Handle numeric literals by converting them to strings
  if (t.isNumericLiteral(expr)) {
    tree.push(String(expr.value));
    return true;
  }

  // Handle unary expressions by converting them to strings
  if (t.isUnaryExpression(expr)) {
    let value: string;
    let operator = '';
    if (expr.operator === '-') {
      operator = expr.operator;
    }
    if (t.isNumericLiteral(expr.argument)) {
      if (expr.argument.value === 0) {
        value = '0';
      } else {
        value = operator + expr.argument.value.toString();
      }
      tree.push(value);
      return true;
    } else {
      // invalid
      return false;
    }
  }

  // Handle boolean literals by converting them to strings
  if (t.isBooleanLiteral(expr)) {
    tree.push(String(expr.value));
    return true;
  }

  // Handle null literal
  if (t.isNullLiteral(expr)) {
    tree.push('null');
    return true;
  }

  // Not a static expression
  return false;
}

/**
 * Given a CallExpression, if it is declareStatic(<call>), return all possible
 * string outcomes of that argument call as an array of strings.
 *
 * Returns null if it can't be resolved.
 */
export function getDeclareStaticVariants(
  call: t.CallExpression,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  pkg: 'gt-react' | 'gt-next'
): string[] | null {
  // Must be declareStatic(...)
  if (!t.isIdentifier(call.callee, { name: 'declareStatic' })) {
    return null;
  }
  if (call.arguments.length !== 1) return null;

  const arg = call.arguments[0];
  if (!t.isExpression(arg)) return null;

  // We only allow declareStatic(<CallExpression>) for now, e.g. declareStatic(time())
  if (!t.isCallExpression(arg)) return null;

  // Resolve the inner call’s possible string outcomes
  return resolveCallStringVariants(arg, tPath, file, parsingOptions, pkg);
}

export function resolveCallStringVariants(
  call: t.CallExpression,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  pkg: 'gt-react' | 'gt-next'
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
    const importMap = buildImportMap(tPath.scope.getProgramParent().path);
    console.log('importMap', importMap);
    const importPath = importMap.get(functionName);

    // If the function is imported, we need to parse the file
    if (importPath) {
      const resolveImportPathCache = new Map<string, string | null>();
      const resolvedPath = resolveImportPath(
        file,
        importPath,
        parsingOptions,
        resolveImportPathCache
      );
      console.log('resolvedPath', resolvedPath);

      if (resolvedPath) {
        const code = fs.readFileSync(resolvedPath, 'utf8');
        console.log('code', code);
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript'],
        });

        const { importAliases } = getPathsAndAliases(ast, pkg);
        console.log('resolvefile', resolvedPath);
        console.log('importAliases', importAliases);
      }
    }

    // Use Binding to resolve the function
    const calleeBinding = tPath.scope.getBinding(functionName);
    if (calleeBinding) {
      // Function found - use existing resolution logic
      const multiplicationNode = resolveStaticFunctionInvocationFromBinding({
        importAliases: {},
        calleeBinding,
        callee: call.callee,
        unwrappedExpressions: [],
        visited: new Set(),
        callStack: [],
        file,
        updates: [],
        errors: [],
        warnings: new Set(),
        pkg: 'gt-react', // Default to gt-react, could be parameterized if needed
        parsingOptions,
        importedFunctionsMap: buildImportMap(
          tPath.scope.getProgramParent().path
        ),
      });

      if (multiplicationNode) {
        const strings = flattenToStrings(multiplicationNode);
        return strings.length > 0 ? strings : null;
      }
    } else {
      const importMap = buildImportMap(tPath.scope.getProgramParent().path);
      console.log('importMap', importMap);
      const importPath = importMap.get(functionName);

      if (importPath) {
        const resolveImportPathCache = new Map<string, string | null>();
        const resolvedPath = resolveImportPath(
          file,
          importPath,
          parsingOptions,
          resolveImportPathCache
        );

        if (resolvedPath) {
          // For imported functions, we would need to parse that file
          // This is complex - for now, return null
          // TODO: Implement cross-file resolution similar to processFunctionInFile
          console.warn(
            `declareStatic: Cannot resolve imported function "${functionName}" from "${importPath}"`
          );
          return null;
        }
      }
    }
  }

  // If we get here: cannot analyze this call statically
  return null;
}

/**
 * Flattens a MultiplicationNode tree and extracts only string values
 */
function flattenToStrings(node: JsxTree | MultiplicationNode | null): string[] {
  const results: string[] = [];

  function traverse(n: JsxTree | MultiplicationNode | null) {
    if (n === null) return;

    // String primitive
    if (typeof n === 'string') {
      results.push(n);
      return;
    }

    // Number/boolean - convert to string
    if (typeof n === 'number' || typeof n === 'boolean') {
      results.push(String(n));
      return;
    }

    // MultiplicationNode - recurse on branches
    if (typeof n === 'object' && 'nodeType' in n) {
      if (n.nodeType === 'multiplication') {
        n.branches.forEach((branch) => traverse(branch));
      } else if (n.nodeType === 'expression') {
        traverse(n.result);
      }
      // Skip ElementNode - we only want strings
    }
  }

  traverse(node);
  return [...new Set(results)]; // Deduplicate
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
