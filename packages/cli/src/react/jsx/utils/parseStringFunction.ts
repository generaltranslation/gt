import { NodePath } from '@babel/traverse';
import { Updates } from '../../../types/index.js';
import * as t from '@babel/types';
import { isStaticExpression } from '../evaluateJsx.js';
import {
  GT_ATTRIBUTES_WITH_SUGAR,
  MSG_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  mapAttributeName,
  INLINE_MESSAGE_HOOK,
  INLINE_MESSAGE_HOOK_ASYNC,
} from './constants.js';
import {
  warnNonStaticExpressionSync,
  warnNonStringSync,
  warnTemplateLiteralSync,
  warnAsyncUseGT,
  warnSyncGetGT,
} from '../../../console/index.js';
import generateModule from '@babel/generator';
import traverseModule from '@babel/traverse';
// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;
const traverse = traverseModule.default || traverseModule;

import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import { createMatchPath, loadConfig } from 'tsconfig-paths';
import resolve from 'resolve';
import enhancedResolve from 'enhanced-resolve';
import type { ParsingConfigOptions } from '../../../types/parsing.js';
const { ResolverFactory } = enhancedResolve;

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
 * Clears all caches. Useful for testing or when file system changes.
 */
export function clearParsingCaches(): void {
  resolveImportPathCache.clear();
  processFunctionCache.clear();
}

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
  file: string,
  ignoreAdditionalData: boolean,
  ignoreDynamicContent: boolean
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
            if (
              GT_ATTRIBUTES_WITH_SUGAR.includes(attribute) &&
              t.isExpression(prop.value)
            ) {
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
              if (result.isStatic && result.value && !ignoreAdditionalData) {
                // Map $id and $context to id and context
                metadata[mapAttributeName(attribute)] = result.value;
              }
            }
          }
        });
      }

      updates.push({
        dataFormat: 'ICU',
        source,
        metadata,
      });
    } else if (t.isTemplateLiteral(arg)) {
      // warn if template literal
      if (!ignoreDynamicContent) {
        errors.push(
          warnTemplateLiteralSync(
            file,
            generate(arg).code,
            `${arg.loc?.start?.line}:${arg.loc?.start?.column}`
          )
        );
      }
    } else {
      if (!ignoreDynamicContent) {
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
}

/**
 * Extracts the parameter name from a function parameter node, handling TypeScript annotations and default values.
 */
function extractParameterName(param: t.Node): string | null {
  if (t.isIdentifier(param)) {
    return param.name;
  }
  // Handle parameters with default values: (gt = () => {})
  if (t.isAssignmentPattern(param) && t.isIdentifier(param.left)) {
    return param.left.name;
  }
  return null;
}

/**
 * Builds a map of imported function names to their import paths from a given program path.
 * Handles both named imports and default imports.
 *
 * Example: import { getInfo } from './constants' -> Map { 'getInfo' => './constants' }
 * Example: import utils from './utils' -> Map { 'utils' => './utils' }
 */
function buildImportMap(programPath: NodePath): Map<string, string> {
  const importMap = new Map<string, string>();

  programPath.traverse({
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

  return importMap;
}

/**
 * Recursively resolves variable assignments to find all aliases of a translation callback parameter.
 * Handles cases like: const t = translate; const a = translate; const b = a; const c = b;
 *
 * @param scope The scope to search within
 * @param variableName The variable name to resolve
 * @param visited Set to track already visited variables to prevent infinite loops
 * @returns Array of all variable names that reference the original translation callback
 */
function resolveVariableAliases(
  scope: any,
  variableName: string,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(variableName)) {
    return []; // Prevent infinite loops
  }
  visited.add(variableName);

  const aliases = [variableName];
  const binding = scope.bindings[variableName];

  if (binding) {
    // Look for variable declarations that assign this variable to another name
    // Example: const t = translate; or const a = t;
    for (const [otherVarName, otherBinding] of Object.entries(scope.bindings)) {
      if (otherVarName === variableName || visited.has(otherVarName)) continue;

      const otherBindingTyped = otherBinding as any;
      if (
        otherBindingTyped.path &&
        otherBindingTyped.path.isVariableDeclarator() &&
        otherBindingTyped.path.node.init &&
        t.isIdentifier(otherBindingTyped.path.node.init) &&
        otherBindingTyped.path.node.init.name === variableName
      ) {
        // Found an alias: const otherVarName = variableName;
        const nestedAliases = resolveVariableAliases(
          scope,
          otherVarName,
          visited
        );
        aliases.push(...nestedAliases);
      }
    }
  }

  return aliases;
}

/**
 * Handles how translation callbacks are used within code.
 * This covers both direct translation calls (t('hello')) and prop drilling
 * where the translation callback is passed to other functions (getData(t)).
 */
function handleFunctionCall(
  tPath: NodePath,
  updates: Updates,
  errors: string[],
  file: string,
  importMap: Map<string, string>,
  ignoreAdditionalData: boolean,
  ignoreDynamicContent: boolean,
  parsingOptions: ParsingConfigOptions
): void {
  if (
    tPath.parent.type === 'CallExpression' &&
    tPath.parent.callee === tPath.node
  ) {
    // Direct translation call: t('hello')
    processTranslationCall(
      tPath,
      updates,
      errors,
      file,
      ignoreAdditionalData,
      ignoreDynamicContent
    );
  } else if (
    tPath.parent.type === 'CallExpression' &&
    t.isExpression(tPath.node) &&
    tPath.parent.arguments.includes(tPath.node)
  ) {
    // Parameter passed to another function: getData(t)
    const argIndex = tPath.parent.arguments.indexOf(tPath.node);
    const callee = tPath.parent.callee;

    if (t.isIdentifier(callee)) {
      const calleeBinding = tPath.scope.getBinding(callee.name);

      if (calleeBinding && calleeBinding.path.isFunction()) {
        const functionPath = calleeBinding.path;
        processFunctionIfMatches(
          callee.name,
          argIndex,
          functionPath.node,
          functionPath,
          updates,
          errors,
          file,
          ignoreAdditionalData,
          ignoreDynamicContent,
          parsingOptions
        );
      }
      // Handle arrow functions assigned to variables: const getData = (t) => {...}
      else if (
        calleeBinding &&
        calleeBinding.path.isVariableDeclarator() &&
        calleeBinding.path.node.init &&
        (t.isArrowFunctionExpression(calleeBinding.path.node.init) ||
          t.isFunctionExpression(calleeBinding.path.node.init))
      ) {
        const initPath = calleeBinding.path.get('init') as NodePath;
        processFunctionIfMatches(
          callee.name,
          argIndex,
          calleeBinding.path.node.init,
          initPath,
          updates,
          errors,
          file,
          ignoreAdditionalData,
          ignoreDynamicContent,
          parsingOptions
        );
      }
      // If not found locally, check if it's an imported function
      else if (importMap.has(callee.name)) {
        const importPath = importMap.get(callee.name)!;
        const resolvedPath = resolveImportPath(
          file,
          importPath,
          parsingOptions
        );

        if (resolvedPath) {
          processFunctionInFile(
            resolvedPath,
            callee.name,
            argIndex,
            updates,
            errors,
            ignoreAdditionalData,
            ignoreDynamicContent,
            parsingOptions
          );
        }
      }
    }
  }
}

/**
 * Processes a user-defined function that receives a translation callback as a parameter.
 * Validates the function has enough parameters and traces how the translation callback
 * is used within that function's body.
 */
function processFunctionIfMatches(
  _functionName: string,
  argIndex: number,
  functionNode: t.Function,
  functionPath: NodePath,
  updates: Updates,
  errors: string[],
  filePath: string,
  ignoreAdditionalData: boolean,
  ignoreDynamicContent: boolean,
  parsingOptions: ParsingConfigOptions
): void {
  if (functionNode.params.length > argIndex) {
    const param = functionNode.params[argIndex];
    const paramName = extractParameterName(param);

    if (paramName) {
      findFunctionParameterUsage(
        functionPath,
        paramName,
        updates,
        errors,
        filePath,
        ignoreAdditionalData,
        ignoreDynamicContent,
        parsingOptions
      );
    }
  }
}

/**
 * Finds all usages of a translation callback parameter within a user-defined function's scope.
 * Processes both direct translation calls and cases where the translation callback is passed
 * to other functions (prop drilling).
 *
 * Example: In function getInfo(t) { return t('hello'); }, this finds the t('hello') call.
 * Example: In function getData(t) { return getFooter(t); }, this finds and traces into getFooter.
 */
function findFunctionParameterUsage(
  functionPath: NodePath,
  parameterName: string,
  updates: Updates,
  errors: string[],
  file: string,
  ignoreAdditionalData: boolean,
  ignoreDynamicContent: boolean,
  parsingOptions: ParsingConfigOptions
): void {
  // Look for the function body and find all usages of the parameter
  if (functionPath.isFunction()) {
    const functionScope = functionPath.scope;

    // Resolve all aliases of the translation callback parameter
    // Example: translate -> [translate, t, a, b] for const t = translate; const a = t; const b = a;
    const allParameterNames = resolveVariableAliases(
      functionScope,
      parameterName
    );

    // Build import map for this function's scope to handle cross-file calls
    const programPath = functionPath.scope.getProgramParent().path;
    const importMap = buildImportMap(programPath);

    // Process references for all parameter names and their aliases
    allParameterNames.forEach((name) => {
      const binding = functionScope.bindings[name];
      if (binding) {
        binding.referencePaths.forEach((refPath) => {
          handleFunctionCall(
            refPath,
            updates,
            errors,
            file,
            importMap,
            ignoreAdditionalData,
            ignoreDynamicContent,
            parsingOptions
          );
        });
      }
    });
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
  importPath: string,
  parsingOptions: ParsingConfigOptions
): string | null {
  // Check cache first
  const cacheKey = `${currentFile}::${importPath}`;
  if (resolveImportPathCache.has(cacheKey)) {
    return resolveImportPathCache.get(cacheKey)!;
  }

  const basedir = path.dirname(currentFile);
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  const mainFields = ['module', 'main'];

  let result: string | null = null;

  // 1. Try tsconfig-paths resolution first (handles TypeScript path mapping)
  const tsConfigResult = loadConfig(basedir);
  if (tsConfigResult.resultType === 'success') {
    const matchPath = createMatchPath(
      tsConfigResult.absoluteBaseUrl,
      tsConfigResult.paths,
      mainFields
    );

    // First try without any extension
    let tsResolved = matchPath(importPath);
    if (tsResolved && fs.existsSync(tsResolved)) {
      result = tsResolved;
      resolveImportPathCache.set(cacheKey, result);
      return result;
    }

    // Then try with each extension
    for (const ext of extensions) {
      tsResolved = matchPath(importPath + ext);
      if (tsResolved && fs.existsSync(tsResolved)) {
        result = tsResolved;
        resolveImportPathCache.set(cacheKey, result);
        return result;
      }

      // Also try the resolved path with extension
      tsResolved = matchPath(importPath);
      if (tsResolved) {
        const resolvedWithExt = tsResolved + ext;
        if (fs.existsSync(resolvedWithExt)) {
          result = resolvedWithExt;
          resolveImportPathCache.set(cacheKey, result);
          return result;
        }
      }
    }
  }

  // 2. Try enhanced-resolve (handles package.json exports field and modern resolution)
  try {
    const resolver = ResolverFactory.createResolver({
      useSyncFileSystemCalls: true,
      fileSystem: fs as any,
      extensions,
      // Include 'development' condition to resolve to source files in monorepos
      conditionNames: parsingOptions.conditionNames, // defaults to ['browser', 'module', 'import', 'require', 'default']. See generateSettings.ts for more details
      exportsFields: ['exports'],
      mainFields,
    });

    const resolved = resolver.resolveSync({}, basedir, importPath);
    if (resolved) {
      result = resolved;
      resolveImportPathCache.set(cacheKey, result);
      return result;
    }
  } catch {
    // Fall through to next resolution strategy
  }

  // 3. Fallback to Node.js resolution (handles relative paths and node_modules)
  try {
    result = resolve.sync(importPath, { basedir, extensions });
    resolveImportPathCache.set(cacheKey, result);
    return result;
  } catch {
    // If resolution fails, try to manually replace .js/.jsx with .ts/.tsx for source files
    if (importPath.endsWith('.js')) {
      const tsPath = importPath.replace(/\.js$/, '.ts');
      try {
        result = resolve.sync(tsPath, { basedir, extensions });
        resolveImportPathCache.set(cacheKey, result);
        return result;
      } catch {
        // Continue to return null
      }
    } else if (importPath.endsWith('.jsx')) {
      const tsxPath = importPath.replace(/\.jsx$/, '.tsx');
      try {
        result = resolve.sync(tsxPath, { basedir, extensions });
        resolveImportPathCache.set(cacheKey, result);
        return result;
      } catch {
        // Continue to return null
      }
    }
    resolveImportPathCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Searches for a specific user-defined function in a file and analyzes how a translation callback
 * parameter (at argIndex position) is used within that function.
 *
 * Handles multiple function declaration patterns:
 * - function getInfo(t) { ... }
 * - export function getInfo(t) { ... }
 * - const getInfo = (t) => { ... }
 *
 * If the function is not found in the file, follows re-exports (export * from './other')
 */
function processFunctionInFile(
  filePath: string,
  functionName: string,
  argIndex: number,
  updates: Updates,
  errors: string[],
  ignoreAdditionalData: boolean,
  ignoreDynamicContent: boolean,
  parsingOptions: ParsingConfigOptions,
  visited: Set<string> = new Set()
): void {
  // Check cache first to avoid redundant parsing
  const cacheKey = `${filePath}::${functionName}::${argIndex}`;
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

    let found = false;
    const reExports: string[] = [];

    traverse(ast, {
      // Handle function declarations: function getInfo(t) { ... }
      FunctionDeclaration(path) {
        if (path.node.id?.name === functionName) {
          found = true;
          processFunctionIfMatches(
            functionName,
            argIndex,
            path.node,
            path,
            updates,
            errors,
            filePath,
            ignoreAdditionalData,
            ignoreDynamicContent,
            parsingOptions
          );
        }
      },
      // Handle variable declarations: const getInfo = (t) => { ... }
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.id) &&
          path.node.id.name === functionName &&
          path.node.init &&
          (t.isArrowFunctionExpression(path.node.init) ||
            t.isFunctionExpression(path.node.init))
        ) {
          found = true;
          const initPath = path.get('init') as NodePath;
          processFunctionIfMatches(
            functionName,
            argIndex,
            path.node.init,
            initPath,
            updates,
            errors,
            filePath,
            ignoreAdditionalData,
            ignoreDynamicContent,
            parsingOptions
          );
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
    if (!found && reExports.length > 0) {
      for (const reExportPath of reExports) {
        const resolvedPath = resolveImportPath(
          filePath,
          reExportPath,
          parsingOptions
        );
        if (resolvedPath) {
          processFunctionInFile(
            resolvedPath,
            functionName,
            argIndex,
            updates,
            errors,
            ignoreAdditionalData,
            ignoreDynamicContent,
            parsingOptions,
            visited
          );
        }
      }
    }

    // Mark this function search as processed in the cache
    processFunctionCache.set(cacheKey, found);
  } catch {
    // Silently skip files that can't be parsed or accessed
    // Still mark as processed to avoid retrying failed parses
    processFunctionCache.set(cacheKey, false);
  }
}

/**
 * Main entry point for parsing translation strings from useGT() and getGT() calls.
 *
 * Supports complex patterns including:
 * 1. Direct calls: const t = useGT(); t('hello');
 * 2. Translation callback prop drilling: const t = useGT(); getInfo(t); where getInfo uses t() internally
 * 3. Cross-file function calls: imported functions that receive the translation callback as a parameter
 *
 * Example flow:
 * - const t = useGT();
 * - const { home } = getInfo(t); // getInfo is imported from './constants'
 * - This will parse constants.ts to find translation calls within getInfo function
 */
export function parseStrings(
  importName: string,
  originalName: string,
  path: NodePath,
  updates: Updates,
  errors: string[],
  file: string,
  parsingOptions: ParsingConfigOptions
): void {
  // First, collect all imports in this file to track cross-file function calls
  const importMap = buildImportMap(path.scope.getProgramParent().path);

  const referencePaths = path.scope.bindings[importName]?.referencePaths || [];

  for (const refPath of referencePaths) {
    // Handle msg() calls directly without variable assignment
    if (originalName === MSG_TRANSLATION_HOOK) {
      const ignoreAdditionalData = false;
      const ignoreDynamicContent = false;

      // Check if this is a direct call to msg('string')
      if (
        refPath.parent.type === 'CallExpression' &&
        refPath.parent.callee === refPath.node
      ) {
        processTranslationCall(
          refPath,
          updates,
          errors,
          file,
          ignoreAdditionalData,
          ignoreDynamicContent
        );
      }
      continue;
    }

    // Handle useGT(), getGT(), useMessages(), and getMessages() calls that need variable assignment
    const callExpr = refPath.findParent((p) => p.isCallExpression());
    if (callExpr) {
      // Get the parent, handling both await and non-await cases
      const parentPath = callExpr.parentPath;

      const parentFunction = refPath.getFunctionParent();
      const asyncScope = parentFunction?.node.async;
      if (
        asyncScope &&
        (originalName === INLINE_TRANSLATION_HOOK ||
          originalName === INLINE_MESSAGE_HOOK)
      ) {
        errors.push(
          warnAsyncUseGT(
            file,
            `${refPath.node.loc?.start?.line}:${refPath.node.loc?.start?.column}`
          )
        );
        return;
      } else if (
        !asyncScope &&
        (originalName === INLINE_TRANSLATION_HOOK_ASYNC ||
          originalName === INLINE_MESSAGE_HOOK_ASYNC)
      ) {
        errors.push(
          warnSyncGetGT(
            file,
            `${refPath.node.loc?.start?.line}:${refPath.node.loc?.start?.column}`
          )
        );
        return;
      }

      const isMessageHook =
        originalName === INLINE_MESSAGE_HOOK ||
        originalName === INLINE_MESSAGE_HOOK_ASYNC;
      const ignoreAdditionalData = isMessageHook;
      const ignoreDynamicContent = isMessageHook;

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

        // Resolve all aliases of the translation function
        // Example: translate -> [translate, t, a, b] for const t = translate; const a = t; const b = a;
        const allTranslationNames = resolveVariableAliases(
          variableScope,
          tFuncName
        );

        // Process references for all translation function names and their aliases
        allTranslationNames.forEach((name) => {
          const tReferencePaths =
            variableScope.bindings[name]?.referencePaths || [];

          for (const tPath of tReferencePaths) {
            handleFunctionCall(
              tPath,
              updates,
              errors,
              file,
              importMap,
              ignoreAdditionalData,
              ignoreDynamicContent,
              parsingOptions
            );
          }
        });
      }
    }
  }
}
