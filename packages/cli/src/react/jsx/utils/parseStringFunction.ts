import { NodePath } from '@babel/traverse';
import { Updates } from '../../../types';
import { splitStringToContent } from 'generaltranslation';
import * as t from '@babel/types';
import { isStaticExpression } from '../evaluateJsx';
import {
  warnNonStaticExpressionSync,
  warnNonStringSync,
  warnTemplateLiteralSync,
} from '../../../console';
import generate from '@babel/generator';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { createMatchPath, loadConfig } from 'tsconfig-paths';
import * as resolve from 'resolve';

export const attributes = ['id', 'context'];

/**
 * Processes a single translation function call (e.g., t('hello world', { id: 'greeting' })).
 * Extracts the translatable string content and metadata, then adds it to the updates array.
 *
 * Handles:
 * - String literals: t('hello')
 * - Template literals without expressions: t(`hello`)
 * - Metadata extraction from options object
 * - Error reporting for non-static expressions and template literals with expressions
 */
function processTranslationCall(
  tPath: NodePath,
  updates: Updates,
  errors: string[],
  file: string
): void {
  if (
    tPath.parent.type === 'CallExpression' &&
    tPath.parent.arguments.length > 0
  ) {
    const arg = tPath.parent.arguments[0];
    if (
      arg.type === 'StringLiteral' ||
      (t.isTemplateLiteral(arg) && arg.expressions.length === 0)
    ) {
      const source =
        arg.type === 'StringLiteral' ? arg.value : arg.quasis[0].value.raw;
      // split the string into content (same as runtime behavior)
      const content = splitStringToContent(source);

      // get metadata and id from options
      const options = tPath.parent.arguments[1];
      const metadata: Record<string, string> = {};
      if (options && options.type === 'ObjectExpression') {
        options.properties.forEach((prop) => {
          if (
            prop.type === 'ObjectProperty' &&
            prop.key.type === 'Identifier'
          ) {
            const attribute = prop.key.name;
            if (attributes.includes(attribute) && t.isExpression(prop.value)) {
              const result = isStaticExpression(prop.value);
              if (!result.isStatic) {
                errors.push(
                  warnNonStaticExpressionSync(
                    file,
                    attribute,
                    generate(prop.value).code,
                    `${prop.loc?.start?.line}:${prop.loc?.start?.column}`
                  )
                );
              }
              if (result.isStatic && result.value) {
                metadata[attribute] = result.value;
              }
            }
          }
        });
      }

      updates.push({
        dataFormat: 'JSX',
        source: content,
        metadata,
      });
    } else if (t.isTemplateLiteral(arg)) {
      // warn if template literal
      errors.push(
        warnTemplateLiteralSync(
          file,
          generate(arg).code,
          `${arg.loc?.start?.line}:${arg.loc?.start?.column}`
        )
      );
    } else {
      errors.push(
        warnNonStringSync(
          file,
          generate(arg).code,
          `${arg.loc?.start?.line}:${arg.loc?.start?.column}`
        )
      );
    }
  }
}

/**
 * Finds all usages of a function parameter within a function's scope and processes
 * any translation calls made with that parameter.
 *
 * Example: In function getInfo(t) { return t('hello'); }, this finds the t('hello') call.
 */
function findFunctionParameterUsage(
  functionPath: NodePath,
  parameterName: string,
  updates: Updates,
  errors: string[],
  file: string
): void {
  // Look for the function body and find all usages of the parameter
  if (functionPath.isFunction()) {
    const functionScope = functionPath.scope;
    const binding = functionScope.bindings[parameterName];

    if (binding) {
      binding.referencePaths.forEach((refPath) => {
        processTranslationCall(refPath, updates, errors, file);
      });
    }
  }
}

/**
 * Resolves import paths to absolute file paths using battle-tested libraries.
 * Handles relative paths, TypeScript paths, and node module resolution.
 *
 * Examples:
 * - './constants' -> '/full/path/to/constants.ts'
 * - '@/components/ui/button' -> '/full/path/to/src/components/ui/button.tsx'
 * - '@shared/utils' -> '/full/path/to/packages/utils/index.ts'
 */
function resolveImportPath(
  currentFile: string,
  importPath: string
): string | null {
  const basedir = path.dirname(currentFile);
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];

  // 1. Try tsconfig-paths resolution first (handles TypeScript path mapping)
  const tsConfigResult = loadConfig(basedir);
  if (tsConfigResult.resultType === 'success') {
    const matchPath = createMatchPath(
      tsConfigResult.absoluteBaseUrl,
      tsConfigResult.paths,
      ['main', 'module', 'browser']
    );

    // First try without any extension
    let tsResolved = matchPath(importPath);
    if (tsResolved && fs.existsSync(tsResolved)) {
      return tsResolved;
    }

    // Then try with each extension
    for (const ext of extensions) {
      tsResolved = matchPath(importPath + ext);
      if (tsResolved && fs.existsSync(tsResolved)) {
        return tsResolved;
      }

      // Also try the resolved path with extension
      tsResolved = matchPath(importPath);
      if (tsResolved) {
        const resolvedWithExt = tsResolved + ext;
        if (fs.existsSync(resolvedWithExt)) {
          return resolvedWithExt;
        }
      }
    }
  }

  // 2. Fallback to Node.js resolution (handles relative paths and node_modules)
  try {
    return resolve.sync(importPath, { basedir, extensions });
  } catch {
    return null;
  }
}

/**
 * Searches for a specific function in a file and analyzes how a particular parameter
 * (at argIndex position) is used within that function for translation calls.
 *
 * Handles multiple function declaration patterns:
 * - function getInfo(t) { ... }
 * - export function getInfo(t) { ... }
 * - const getInfo = (t) => { ... }
 */
function findFunctionInFile(
  filePath: string,
  functionName: string,
  argIndex: number,
  updates: Updates,
  errors: string[]
): void {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      // Handle function declarations: function getInfo(t) { ... }
      FunctionDeclaration(path) {
        if (
          path.node.id?.name === functionName &&
          path.node.params.length > argIndex
        ) {
          const param = path.node.params[argIndex];
          if (t.isIdentifier(param)) {
            findFunctionParameterUsage(
              path,
              param.name,
              updates,
              errors,
              filePath
            );
          }
        }
      },
      // Handle exported function declarations: export function getInfo(t) { ... }
      ExportNamedDeclaration(path) {
        if (
          path.node.declaration &&
          t.isFunctionDeclaration(path.node.declaration)
        ) {
          const func = path.node.declaration;
          if (func.id?.name === functionName && func.params.length > argIndex) {
            const param = func.params[argIndex];
            if (t.isIdentifier(param)) {
              findFunctionParameterUsage(
                path.get('declaration') as NodePath,
                param.name,
                updates,
                errors,
                filePath
              );
            }
          }
        }
      },
      // Handle variable declarations: const getInfo = (t) => { ... }
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.id) &&
          path.node.id.name === functionName &&
          path.node.init &&
          (t.isArrowFunctionExpression(path.node.init) ||
            t.isFunctionExpression(path.node.init)) &&
          path.node.init.params.length > argIndex
        ) {
          const param = path.node.init.params[argIndex];
          if (t.isIdentifier(param)) {
            const initPath = path.get('init') as NodePath;
            findFunctionParameterUsage(
              initPath,
              param.name,
              updates,
              errors,
              filePath
            );
          }
        }
      },
    });
  } catch {
    // Silently skip files that can't be parsed or accessed
  }
}

/**
 * Main entry point for parsing translation strings from useGT() and getGT() calls.
 *
 * Supports complex patterns including:
 * 1. Direct calls: const t = useGT(); t('hello');
 * 2. Function parameters: const t = useGT(); getInfo(t); where getInfo uses t() internally
 * 3. Cross-file function calls: imported functions that receive t as a parameter
 *
 * Example flow:
 * - const t = useGT();
 * - const { home } = getInfo(t); // getInfo is imported from './constants'
 * - This will parse constants.ts to find t() calls within getInfo function
 */
export function parseStrings(
  importName: string,
  path: NodePath,
  updates: Updates,
  errors: string[],
  file: string
): void {
  // First, collect all imports in this file to track cross-file function calls
  const importMap = new Map<string, string>(); // functionName -> importPath

  path.scope.getProgramParent().path.traverse({
    ImportDeclaration(importPath) {
      if (t.isStringLiteral(importPath.node.source)) {
        const importSource = importPath.node.source.value;
        importPath.node.specifiers.forEach((spec) => {
          if (
            t.isImportSpecifier(spec) &&
            t.isIdentifier(spec.imported) &&
            t.isIdentifier(spec.local)
          ) {
            importMap.set(spec.local.name, importSource);
          } else if (
            t.isImportDefaultSpecifier(spec) &&
            t.isIdentifier(spec.local)
          ) {
            importMap.set(spec.local.name, importSource);
          }
        });
      }
    },
  });

  const referencePaths = path.scope.bindings[importName]?.referencePaths || [];

  for (const refPath of referencePaths) {
    // Find call expressions of useGT() / await getGT()
    const callExpr = refPath.findParent((p) => p.isCallExpression());
    if (callExpr) {
      // Get the parent, handling both await and non-await cases
      const parentPath = callExpr.parentPath;
      const effectiveParent =
        parentPath?.node.type === 'AwaitExpression'
          ? parentPath.parentPath
          : parentPath;

      if (
        effectiveParent &&
        effectiveParent.node.type === 'VariableDeclarator' &&
        effectiveParent.node.id.type === 'Identifier'
      ) {
        const tFuncName = effectiveParent.node.id.name;
        // Get the scope from the variable declaration
        const variableScope = effectiveParent.scope;

        const tReferencePaths =
          variableScope.bindings[tFuncName]?.referencePaths || [];

        for (const tPath of tReferencePaths) {
          // Check if this is a direct call to the translation function
          if (
            tPath.parent.type === 'CallExpression' &&
            tPath.parent.callee === tPath.node
          ) {
            processTranslationCall(tPath, updates, errors, file);
          }
          // Check if this is being passed as an argument to another function
          else if (
            tPath.parent.type === 'CallExpression' &&
            t.isExpression(tPath.node) &&
            tPath.parent.arguments.includes(tPath.node)
          ) {
            // Find which parameter position this is
            const argIndex = tPath.parent.arguments.indexOf(tPath.node);

            // Try to find the function definition being called
            const callee = tPath.parent.callee;

            if (t.isIdentifier(callee)) {
              // Look for function declarations or function expressions with this name
              const calleeBinding = tPath.scope.getBinding(callee.name);

              if (calleeBinding && calleeBinding.path.isFunction()) {
                const functionPath = calleeBinding.path;
                const params = functionPath.node.params;

                if (params[argIndex] && t.isIdentifier(params[argIndex])) {
                  const paramName = params[argIndex].name;
                  findFunctionParameterUsage(
                    functionPath,
                    paramName,
                    updates,
                    errors,
                    file
                  );
                }
              }
              // If not found locally, check if it's an imported function
              else if (importMap.has(callee.name)) {
                const importPath = importMap.get(callee.name)!;
                const resolvedPath = resolveImportPath(file, importPath);

                if (resolvedPath) {
                  findFunctionInFile(
                    resolvedPath,
                    callee.name,
                    argIndex,
                    updates,
                    errors
                  );
                }
              }
            }
          }
        }
      }
    }
  }
}
