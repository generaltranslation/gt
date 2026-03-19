import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { ParsingConfigOptions } from '../../../types/parsing.js';
import { StringNode } from './types.js';
import { buildImportMap } from './buildImportMap.js';
import { resolveImportPath } from './resolveImportPath.js';
import { parse } from '@babel/parser';
import fs from 'node:fs';
import {
  warnDeriveFunctionNoResultsSync,
  warnFunctionNotFoundSync,
  warnInvalidDeclareVarNameSync,
  warnDeriveNonConstVariableSync,
  warnDeriveUnresolvableValueSync,
  warnDeriveOptionalChainingSync,
  warnDeriveDestructuringSync,
  warnDeriveCircularSpreadSync,
} from '../../../console/index.js';

import traverseModule from '@babel/traverse';
import { DECLARE_VAR_FUNCTION } from '../../jsx/utils/constants.js';
import { GTLibrary, GT_LIBRARIES } from '../../../types/libraries.js';
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
 * Cache for resolved object nodes to avoid re-parsing the same files.
 */
const resolveObjectNodeCache = new Map<string, ResolvedObject[]>();

/**
 * Guard against infinite recursion when resolving identifier chains.
 * Tracks AST nodes currently being resolved to detect circular references.
 */
const resolvingIdentifiers = new Set<t.Node>();

/**
 * Unwraps TypeScript type annotations to get the underlying expression.
 * Handles: as, satisfies, non-null assertion (!), and angle-bracket assertions.
 */
function unwrapTypeAnnotation(node: t.Expression): t.Expression {
  if (t.isTSAsExpression(node)) return node.expression;
  if (t.isTSSatisfiesExpression(node)) return node.expression;
  if (t.isTSNonNullExpression(node)) return node.expression;
  if (t.isTSTypeAssertion(node)) return node.expression;
  return node;
}

// ===== Object Property Collection & Nesting Helpers ===== //
//
// Known limitations (not yet supported in derive):
// - Destructuring syntax: const { x } = obj; const [a, b] = arr;
// - Enum member values: Color.Red (enum declarations aren't resolved)
// - Object.freeze / Object.assign wrappers (CallExpression around ObjectExpression)
// - Logical expressions as values: x || 'default', x ?? 'fallback' (could be undefined)
// - Optional chaining: O?.a (implies possible undefined)
// - Angle bracket type assertions in .tsx files (<string>x conflicts with JSX)
//

interface ObjectEntry {
  key: string | null;
  value: t.Expression;
}

interface ResolvedObject {
  objExpr: t.ObjectExpression | t.ArrayExpression;
  tPath: NodePath;
  file: string;
}

/**
 * Collects all resolvable property entries from an ObjectExpression,
 * including entries from spread sources.
 */
function collectObjectProperties(
  objExpr: t.ObjectExpression,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  warnings: Set<string>,
  errors: string[] = []
): ObjectEntry[] {
  const entries: ObjectEntry[] = [];

  for (const prop of objExpr.properties) {
    if (t.isObjectProperty(prop)) {
      const key =
        !prop.computed && t.isIdentifier(prop.key)
          ? prop.key.name
          : t.isStringLiteral(prop.key)
            ? prop.key.value
            : t.isNumericLiteral(prop.key)
              ? String(prop.key.value)
              : null;
      if (t.isExpression(prop.value)) {
        entries.push({ key, value: prop.value });
      }
    } else if (t.isSpreadElement(prop)) {
      // Handle inline ObjectExpression spread: { ...({ a: 'x' }) }
      const spreadArg = unwrapTypeAnnotation(prop.argument);
      if (t.isObjectExpression(spreadArg)) {
        entries.push(
          ...collectObjectProperties(
            spreadArg,
            tPath,
            file,
            parsingOptions,
            warnings,
            errors
          )
        );
        continue;
      }

      if (!t.isIdentifier(prop.argument)) continue;

      const spreadBinding = tPath.scope.getBinding(prop.argument.name);
      if (!spreadBinding) continue;

      // Same-file: VariableDeclarator
      if (spreadBinding.path.isVariableDeclarator()) {
        const spreadDecl = spreadBinding.path.parentPath;
        if (
          spreadDecl?.isVariableDeclaration() &&
          spreadDecl.node.kind !== 'const'
        )
          continue;
        const spreadInit = spreadBinding.path.node.init;
        if (!spreadInit) continue;
        // Guard against circular spreads
        if (resolvingIdentifiers.has(spreadInit)) {
          errors.push(
            warnDeriveCircularSpreadSync(
              file,
              prop.argument.name,
              `${prop.loc?.start?.line}:${prop.loc?.start?.column}`
            )
          );
          continue;
        }
        resolvingIdentifiers.add(spreadInit);
        const spreadObj = unwrapTypeAnnotation(spreadInit);
        if (!t.isObjectExpression(spreadObj)) {
          resolvingIdentifiers.delete(spreadInit);
          continue;
        }
        entries.push(
          ...collectObjectProperties(
            spreadObj,
            spreadBinding.path,
            file,
            parsingOptions,
            warnings,
            errors
          )
        );
        resolvingIdentifiers.delete(spreadInit);
      }
      // Cross-file: ImportSpecifier or ImportDefaultSpecifier
      else if (
        spreadBinding.path.isImportSpecifier() ||
        spreadBinding.path.isImportDefaultSpecifier()
      ) {
        const programPath = tPath.scope.getProgramParent().path;
        const importMap = buildImportMap(programPath);
        const importPath = importMap.get(prop.argument.name);
        if (!importPath) continue;

        let originalName = prop.argument.name;
        if (spreadBinding.path.isImportSpecifier()) {
          const imported = spreadBinding.path.node.imported;
          originalName = t.isIdentifier(imported)
            ? imported.name
            : imported.value;
        }

        const resolvedFilePath = resolveImportPath(
          file,
          importPath,
          parsingOptions,
          resolveImportPathCache
        );
        if (!resolvedFilePath) continue;

        const crossFileObjects = resolveObjectNodesInFile(
          resolvedFilePath,
          originalName,
          parsingOptions,
          warnings
        );
        for (const crossObj of crossFileObjects) {
          const crossEntries = t.isArrayExpression(crossObj.objExpr)
            ? collectArrayElements(
                crossObj.objExpr,
                crossObj.tPath,
                crossObj.file,
                parsingOptions,
                warnings
              )
            : collectObjectProperties(
                crossObj.objExpr,
                crossObj.tPath,
                crossObj.file,
                parsingOptions,
                warnings,
                errors
              );
          entries.push(...crossEntries);
        }
      }
    }
    // Skip ObjectMethod (getters, setters, methods)
  }

  return entries;
}

/**
 * Collects elements from an ArrayExpression as ObjectEntry[] with index as key.
 * Handles spread elements by resolving the source array.
 */
function collectArrayElements(
  arrExpr: t.ArrayExpression,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  warnings: Set<string>,
  errors: string[] = []
): ObjectEntry[] {
  const entries: ObjectEntry[] = [];
  let index = 0;
  for (const el of arrExpr.elements) {
    if (!el) {
      index++;
      continue;
    } // sparse hole
    if (t.isSpreadElement(el)) {
      if (!t.isIdentifier(el.argument)) {
        continue;
      }
      const spreadBinding = tPath.scope.getBinding(el.argument.name);
      if (!spreadBinding) continue;

      // Same-file spread
      if (spreadBinding.path.isVariableDeclarator()) {
        const spreadDecl = spreadBinding.path.parentPath;
        if (
          spreadDecl?.isVariableDeclaration() &&
          spreadDecl.node.kind !== 'const'
        ) {
          errors.push(
            warnDeriveNonConstVariableSync(
              file,
              el.argument.name,
              spreadDecl.node.kind,
              `${el.loc?.start?.line}:${el.loc?.start?.column}`
            )
          );
          continue;
        }
        const spreadInit = spreadBinding.path.node.init;
        if (!spreadInit) continue;
        const spreadUnwrapped = unwrapTypeAnnotation(spreadInit);
        if (t.isArrayExpression(spreadUnwrapped)) {
          const spreadEntries = collectArrayElements(
            spreadUnwrapped,
            spreadBinding.path,
            file,
            parsingOptions,
            warnings
          );
          for (const e of spreadEntries) {
            entries.push({ key: String(index++), value: e.value });
          }
          continue;
        }
      }
      // Cross-file spread
      else if (
        spreadBinding.path.isImportSpecifier() ||
        spreadBinding.path.isImportDefaultSpecifier()
      ) {
        const programPath = tPath.scope.getProgramParent().path;
        const importMap = buildImportMap(programPath);
        const importPath = importMap.get(el.argument.name);
        if (!importPath) continue;

        let originalName = el.argument.name;
        if (spreadBinding.path.isImportSpecifier()) {
          const imported = spreadBinding.path.node.imported;
          originalName = t.isIdentifier(imported)
            ? imported.name
            : imported.value;
        }

        const resolvedFilePath = resolveImportPath(
          file,
          importPath,
          parsingOptions,
          resolveImportPathCache
        );
        if (!resolvedFilePath) continue;

        const crossFileNodes = resolveObjectNodesInFile(
          resolvedFilePath,
          originalName,
          parsingOptions,
          warnings
        );
        for (const crossNode of crossFileNodes) {
          if (t.isArrayExpression(crossNode.objExpr)) {
            const spreadEntries = collectArrayElements(
              crossNode.objExpr,
              crossNode.tPath,
              crossNode.file,
              parsingOptions,
              warnings
            );
            for (const e of spreadEntries) {
              entries.push({ key: String(index++), value: e.value });
            }
          }
        }
      }
      continue;
    }
    if (t.isExpression(el)) {
      entries.push({ key: String(index), value: unwrapTypeAnnotation(el) });
    }
    index++;
  }
  return entries;
}

/**
 * Resolves an expression to ObjectExpression or ArrayExpression AST node(s).
 * Handles Identifier (local + imported) and MemberExpression (nested access chains).
 */
function resolveToObjectNodes(
  node: t.Expression,
  tPath: NodePath,
  file: string,
  parsingOptions: ParsingConfigOptions,
  warnings: Set<string>,
  errors: string[] = []
): ResolvedObject[] {
  // Case 1: Identifier — base case
  if (t.isIdentifier(node)) {
    const binding = tPath.scope.getBinding(node.name);
    if (!binding) return [];

    // Local variable
    if (binding.path.isVariableDeclarator()) {
      const declaration = binding.path.parentPath;
      if (
        declaration?.isVariableDeclaration() &&
        declaration.node.kind !== 'const'
      ) {
        warnings.add(
          warnDeriveNonConstVariableSync(
            file,
            node.name,
            declaration.node.kind,
            `${node.loc?.start?.line}:${node.loc?.start?.column}`
          )
        );
        return [];
      }
      const init = binding.path.node.init;
      if (!init) return [];
      const unwrapped = unwrapTypeAnnotation(init);
      if (t.isObjectExpression(unwrapped) || t.isArrayExpression(unwrapped)) {
        return [{ objExpr: unwrapped, tPath: binding.path, file }];
      }
      // Handle identifier chain: const A = B; const B = { ... }
      if (t.isIdentifier(unwrapped)) {
        return resolveToObjectNodes(
          unwrapped,
          binding.path,
          file,
          parsingOptions,
          warnings,
          errors
        );
      }
      // Handle conditional: cond ? { ... } : { ... } (including nested ternaries)
      if (t.isConditionalExpression(unwrapped)) {
        const collectConditionalLeaves = (
          expr: t.Expression
        ): ResolvedObject[] => {
          const inner = unwrapTypeAnnotation(expr);
          if (t.isConditionalExpression(inner)) {
            return [
              ...collectConditionalLeaves(inner.consequent),
              ...collectConditionalLeaves(inner.alternate),
            ];
          }
          if (t.isObjectExpression(inner) || t.isArrayExpression(inner)) {
            return [{ objExpr: inner, tPath: binding.path, file }];
          }
          return [];
        };
        return [
          ...collectConditionalLeaves(unwrapped.consequent),
          ...collectConditionalLeaves(unwrapped.alternate),
        ];
      }
      return [];
    }

    // Imported
    if (
      binding.path.isImportSpecifier() ||
      binding.path.isImportDefaultSpecifier()
    ) {
      const programPath = tPath.scope.getProgramParent().path;
      const importMap = buildImportMap(programPath);
      const importPath = importMap.get(node.name);
      if (!importPath) return [];

      let originalName = node.name;
      if (binding.path.isImportSpecifier()) {
        const imported = binding.path.node.imported;
        originalName = t.isIdentifier(imported)
          ? imported.name
          : imported.value;
      }

      const resolvedFilePath = resolveImportPath(
        file,
        importPath,
        parsingOptions,
        resolveImportPathCache
      );
      if (!resolvedFilePath) return [];

      return resolveObjectNodesInFile(
        resolvedFilePath,
        originalName,
        parsingOptions,
        warnings
      );
    }

    return [];
  }

  // Case 2: MemberExpression — recursive
  if (t.isMemberExpression(node)) {
    if (!t.isExpression(node.object)) return [];

    const parentObjects = resolveToObjectNodes(
      node.object,
      tPath,
      file,
      parsingOptions,
      warnings,
      errors
    );
    if (parentObjects.length === 0) return [];

    const results: ResolvedObject[] = [];

    for (const parent of parentObjects) {
      const entries = t.isArrayExpression(parent.objExpr)
        ? collectArrayElements(
            parent.objExpr,
            parent.tPath,
            parent.file,
            parsingOptions,
            warnings
          )
        : collectObjectProperties(
            parent.objExpr,
            parent.tPath,
            parent.file,
            parsingOptions,
            warnings,
            errors
          );

      // Determine if this is a static access (known key)
      let staticKey: string | null = null;
      if (!node.computed && t.isIdentifier(node.property)) {
        staticKey = node.property.name;
      } else if (node.computed && t.isStringLiteral(node.property)) {
        staticKey = node.property.value;
      } else if (node.computed && t.isNumericLiteral(node.property)) {
        staticKey = String(node.property.value);
      }

      if (staticKey !== null) {
        // Static: narrow to matching key(s) — don't break, spreads may duplicate keys
        for (const entry of entries) {
          if (entry.key === staticKey) {
            const unwrapped = unwrapTypeAnnotation(entry.value);
            if (
              t.isObjectExpression(unwrapped) ||
              t.isArrayExpression(unwrapped)
            ) {
              results.push({
                objExpr: unwrapped,
                tPath: parent.tPath,
                file: parent.file,
              });
            }
          }
        }
      } else {
        // Dynamic: collect ALL entries whose values are ObjectExpressions or ArrayExpressions
        for (const entry of entries) {
          const unwrapped = unwrapTypeAnnotation(entry.value);
          if (
            t.isObjectExpression(unwrapped) ||
            t.isArrayExpression(unwrapped)
          ) {
            results.push({
              objExpr: unwrapped,
              tPath: parent.tPath,
              file: parent.file,
            });
          }
        }
      }
    }

    return results;
  }

  return [];
}

/**
 * Resolves an object declaration from an external file.
 * Finds a const VariableDeclarator with ObjectExpression init.
 * Follows re-export chains.
 */
function resolveObjectNodesInFile(
  filePath: string,
  name: string,
  parsingOptions: ParsingConfigOptions,
  warnings: Set<string>
): ResolvedObject[] {
  const cacheKey = `${filePath}::${name}`;
  if (resolveObjectNodeCache.has(cacheKey)) {
    return resolveObjectNodeCache.get(cacheKey)!;
  }

  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const results: ResolvedObject[] = [];

    traverse(ast, {
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.id) &&
          path.node.id.name === name &&
          results.length === 0
        ) {
          const init = path.node.init;
          if (!init) return;
          const declaration = path.parentPath;
          if (
            declaration?.isVariableDeclaration() &&
            declaration.node.kind !== 'const'
          )
            return;
          const unwrapped = unwrapTypeAnnotation(init);
          if (
            t.isObjectExpression(unwrapped) ||
            t.isArrayExpression(unwrapped)
          ) {
            results.push({
              objExpr: unwrapped,
              tPath: path,
              file: filePath,
            });
          }
        }
      },
      ExportAllDeclaration(path) {
        if (results.length > 0) return;
        if (t.isStringLiteral(path.node.source)) {
          const reexportPath = path.node.source.value;
          const resolvedPath = resolveImportPath(
            filePath,
            reexportPath,
            parsingOptions,
            resolveImportPathCache
          );
          if (resolvedPath) {
            results.push(
              ...resolveObjectNodesInFile(
                resolvedPath,
                name,
                parsingOptions,
                warnings
              )
            );
          }
        }
      },
      ExportNamedDeclaration(path) {
        if (results.length > 0) return;
        if (path.node.source && t.isStringLiteral(path.node.source)) {
          const hasMatch = path.node.specifiers.some((spec) => {
            if (t.isExportSpecifier(spec)) {
              const exportedName = t.isIdentifier(spec.exported)
                ? spec.exported.name
                : spec.exported.value;
              return exportedName === name;
            }
            return false;
          });
          if (hasMatch) {
            const reexportPath = path.node.source.value;
            const resolvedPath = resolveImportPath(
              filePath,
              reexportPath,
              parsingOptions,
              resolveImportPathCache
            );
            if (resolvedPath) {
              const specifier = path.node.specifiers.find((spec) => {
                if (t.isExportSpecifier(spec)) {
                  const exportedName = t.isIdentifier(spec.exported)
                    ? spec.exported.name
                    : spec.exported.value;
                  return exportedName === name;
                }
                return false;
              });
              let originalName = name;
              if (
                specifier &&
                t.isExportSpecifier(specifier) &&
                t.isIdentifier(specifier.local)
              ) {
                originalName = specifier.local.name;
              }
              results.push(
                ...resolveObjectNodesInFile(
                  resolvedPath,
                  originalName,
                  parsingOptions,
                  warnings
                )
              );
            }
          }
        }
      },
    });

    resolveObjectNodeCache.set(cacheKey, results);
    return results;
  } catch {
    resolveObjectNodeCache.set(cacheKey, []);
    return [];
  }
}

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
  warnings: Set<string>,
  errors: string[]
): StringNode | null {
  // Unwrap TypeScript type annotations (as, satisfies, !, <Type>)
  if (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSTypeAssertion(node)
  ) {
    return parseStringExpression(
      (node as t.TSAsExpression).expression,
      tPath,
      file,
      parsingOptions,
      warnings,
      errors
    );
  }

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
          warnings,
          errors
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
      warnings,
      errors
    );
    const rightResult = parseStringExpression(
      node.right,
      tPath,
      file,
      parsingOptions,
      warnings,
      errors
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
      warnings,
      errors
    );
    const alternateResult = parseStringExpression(
      node.alternate,
      tPath,
      file,
      parsingOptions,
      warnings,
      errors
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
      // Check for destructuring patterns (not yet supported)
      if (
        t.isObjectPattern(binding.path.node.id) ||
        t.isArrayPattern(binding.path.node.id)
      ) {
        errors.push(
          warnDeriveDestructuringSync(
            file,
            node.name,
            `${node.loc?.start?.line}:${node.loc?.start?.column}`
          )
        );
        return null;
      }

      // Guard against circular references (e.g., const A = B; const B = A)
      const init = binding.path.node.init;
      if (resolvingIdentifiers.has(init)) {
        return null;
      }

      // Enforce const-only
      const declaration = binding.path.parentPath;
      if (
        declaration?.isVariableDeclaration() &&
        declaration.node.kind !== 'const'
      ) {
        warnings.add(
          warnDeriveNonConstVariableSync(
            file,
            node.name,
            declaration.node.kind,
            `${node.loc?.start?.line}:${node.loc?.start?.column}`
          )
        );
        return null;
      }

      // Unwrap TSAsExpression (for `as const`)
      const unwrapped = unwrapTypeAnnotation(init);
      if (t.isExpression(unwrapped)) {
        // Recursively resolve the initializer with recursion guard
        resolvingIdentifiers.add(init);
        try {
          return parseStringExpression(
            unwrapped,
            binding.path,
            file,
            parsingOptions,
            warnings,
            errors
          );
        } finally {
          resolvingIdentifiers.delete(init);
        }
      }
    }

    // Check for destructuring patterns (not yet supported)
    if (
      binding.path.isObjectProperty() ||
      binding.path.isArrayPattern() ||
      binding.path.isRestElement()
    ) {
      errors.push(
        warnDeriveDestructuringSync(
          file,
          node.name,
          `${node.loc?.start?.line}:${node.loc?.start?.column}`
        )
      );
      return null;
    }

    // Not a resolvable variable
    return null;
  }

  // Handle optional chaining — not supported, emit error
  if (t.isOptionalMemberExpression(node)) {
    errors.push(
      warnDeriveOptionalChainingSync(
        file,
        generate(node).code,
        `${node.loc?.start?.line}:${node.loc?.start?.column}`
      )
    );
    return null;
  }

  // Handle member expressions: obj[key], obj.prop, and nested obj.a.b / obj[a][b]
  if (t.isMemberExpression(node)) {
    if (!t.isExpression(node.object)) return null;

    // Resolve the object part to ObjectExpression node(s)
    const objectNodes = resolveToObjectNodes(
      node.object,
      tPath,
      file,
      parsingOptions,
      warnings,
      errors
    );
    if (objectNodes.length === 0) return null;

    // Apply the final access to each resolved object
    const branches: StringNode[] = [];
    for (const { objExpr, tPath: objPath, file: objFile } of objectNodes) {
      const entries = t.isArrayExpression(objExpr)
        ? collectArrayElements(
            objExpr,
            objPath,
            objFile,
            parsingOptions,
            warnings,
            errors
          )
        : collectObjectProperties(
            objExpr,
            objPath,
            objFile,
            parsingOptions,
            warnings,
            errors
          );

      // Check for static literal subscripts: obj['key'] or obj[0]
      let staticLiteralKey: string | null = null;
      if (node.computed && t.isStringLiteral(node.property)) {
        staticLiteralKey = node.property.value;
      } else if (node.computed && t.isNumericLiteral(node.property)) {
        staticLiteralKey = String(node.property.value);
      }

      // Determine the access key (if statically known)
      const propName =
        staticLiteralKey ??
        (!node.computed && t.isIdentifier(node.property)
          ? node.property.name
          : null);

      // Check if we can narrow: need a known access key AND all object keys must be resolvable
      const hasUnresolvableKeys = entries.some((e) => e.key === null);
      const canNarrow = propName !== null && !hasUnresolvableKeys;

      if (canNarrow) {
        // STATIC: extract ONE specific property
        for (const entry of entries) {
          if (entry.key === propName) {
            const resolved = parseStringExpression(
              entry.value,
              objPath,
              objFile,
              parsingOptions,
              warnings,
              errors
            );
            if (resolved) {
              branches.push(resolved);
            } else {
              errors.push(
                warnDeriveUnresolvableValueSync(
                  objFile,
                  propName,
                  `${entry.value.loc?.start?.line}:${entry.value.loc?.start?.column}`
                )
              );
            }
            // Don't break — spreads may introduce duplicate keys
          }
        }
      } else {
        // DYNAMIC: extract ALL values (can't determine which key matches)
        for (const entry of entries) {
          const resolved = parseStringExpression(
            entry.value,
            objPath,
            objFile,
            parsingOptions,
            warnings,
            errors
          );
          if (resolved) {
            branches.push(resolved);
          } else if (entry.key !== null) {
            errors.push(
              warnDeriveUnresolvableValueSync(
                objFile,
                entry.key,
                `${entry.value.loc?.start?.line}:${entry.value.loc?.start?.column}`
              )
            );
          }
        }
      }
    }

    if (branches.length === 0) return null;
    if (branches.length === 1) return branches[0];
    return { type: 'choice', nodes: branches };
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
          warnings,
          errors
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
      warnings,
      errors
    );
  }

  // Handle parenthesized expressions
  if (t.isParenthesizedExpression(node)) {
    return parseStringExpression(
      node.expression,
      tPath,
      file,
      parsingOptions,
      warnings,
      errors
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
  warnings: Set<string>,
  errors: string[]
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
          warnings,
          errors
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
        warnings,
        errors
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
            warnings,
            errors
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
  warnings: Set<string>,
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
              warnings,
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
                warnings,
                errors
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
                warnings,
                errors
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
          result === null
        ) {
          const init = path.node.init;
          if (!init) return;

          // Handle arrow/function expressions
          if (
            t.isArrowFunctionExpression(init) ||
            t.isFunctionExpression(init)
          ) {
            const initPath = path.get('init');
            if (
              !initPath.isArrowFunctionExpression() &&
              !initPath.isFunctionExpression()
            ) {
              return;
            }

            const bodyPath = initPath.get('body');
            const branches: StringNode[] = [];

            // Handle expression body: () => "day"
            if (!Array.isArray(bodyPath) && t.isExpression(bodyPath.node)) {
              const bodyResult = parseStringExpression(
                bodyPath.node,
                bodyPath,
                filePath,
                parsingOptions,
                warnings,
                errors
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
              const arrowFunction = initPath.node;
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
                    warnings,
                    errors
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
          // Handle string/numeric/boolean/null constants
          else if (t.isStringLiteral(init)) {
            result = { type: 'text', text: init.value };
          } else if (t.isNumericLiteral(init)) {
            result = { type: 'text', text: String(init.value) };
          } else if (t.isBooleanLiteral(init)) {
            result = { type: 'text', text: String(init.value) };
          }
          // Handle template literals
          else if (t.isTemplateLiteral(init)) {
            const parts: StringNode[] = [];
            let failed = false;
            for (let index = 0; index < init.quasis.length; index++) {
              const quasi = init.quasis[index];
              const text = quasi.value.cooked ?? quasi.value.raw ?? '';
              if (text) {
                parts.push({ type: 'text', text });
              }
              const exprNode = init.expressions[index];
              if (exprNode && t.isExpression(exprNode)) {
                const exprResult = parseStringExpression(
                  exprNode,
                  path,
                  filePath,
                  parsingOptions,
                  warnings,
                  errors
                );
                if (exprResult === null) {
                  failed = true;
                  break;
                }
                parts.push(exprResult);
              }
            }
            if (!failed) {
              if (parts.length === 0) {
                result = { type: 'text', text: '' };
              } else if (parts.length === 1) {
                result = parts[0];
              } else {
                result = { type: 'sequence', nodes: parts };
              }
            }
          }
          // Handle object expressions (and `as const` / `satisfies`)
          else if (
            t.isObjectExpression(init) ||
            t.isObjectExpression(unwrapTypeAnnotation(init))
          ) {
            const objExpr = unwrapTypeAnnotation(init) as t.ObjectExpression;
            const branches: StringNode[] = [];
            for (const prop of objExpr.properties) {
              if (!t.isObjectProperty(prop) || !t.isExpression(prop.value))
                continue;
              const resolved = parseStringExpression(
                prop.value,
                path,
                filePath,
                parsingOptions,
                warnings,
                errors
              );
              if (resolved) branches.push(resolved);
            }
            if (branches.length === 1) result = branches[0];
            else if (branches.length > 1)
              result = { type: 'choice', nodes: branches };
          }
        }
      },
    });
  } catch (error) {
    // File read or parse error - return null
    warnings.add(
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
