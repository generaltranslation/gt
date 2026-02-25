import { NodePath, Scope, Binding } from '@babel/traverse';
import * as t from '@babel/types';
import { isStaticExpression } from '../evaluateJsx.js';
import {
  MSG_REGISTRATION_FUNCTION,
  INLINE_TRANSLATION_HOOK,
  INLINE_TRANSLATION_HOOK_ASYNC,
  INLINE_MESSAGE_HOOK,
  INLINE_MESSAGE_HOOK_ASYNC,
} from './constants.js';
import { warnAsyncUseGT, warnSyncGetGT } from '../../../console/index.js';

import traverseModule from '@babel/traverse';
// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

import fs from 'node:fs';
import { parse } from '@babel/parser';
import type {
  ParsingConfig,
  ParsingState,
  ParsingOutput,
} from './stringParsing/types.js';
import { resolveImportPath } from './resolveImportPath.js';
import { buildImportMap } from './buildImportMap.js';
import { handleStaticTranslationCall } from './stringParsing/handleStaticTranslationCall.js';
import { handleLiteralTranslationCall } from './stringParsing/handleLiteralTranslationCall.js';
import { handleInvalidTranslationCall } from './stringParsing/handleInvalidTranslationCall.js';

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
  config: ParsingConfig,
  output: ParsingOutput
): void {
  if (
    tPath.parent.type === 'CallExpression' &&
    tPath.parent.arguments.length > 0
  ) {
    const arg = tPath.parent.arguments[0];
    const options:
      | t.ArgumentPlaceholder
      | t.SpreadElement
      | t.Expression
      | undefined = tPath.parent.arguments[1];

    if (
      !config.ignoreDynamicContent &&
      t.isExpression(arg) &&
      !isStaticExpression(arg).isStatic
    ) {
      // handle static translation call
      handleStaticTranslationCall({
        arg,
        options,
        tPath,
        config,
        output,
      });
    } else if (
      arg.type === 'StringLiteral' ||
      (t.isTemplateLiteral(arg) && arg.expressions.length === 0)
    ) {
      // Handle string and template literals
      handleLiteralTranslationCall({
        arg,
        options,
        config,
        output,
      });
    } else {
      // error on invalid translation call
      handleInvalidTranslationCall({
        arg,
        config,
        output,
      });
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
 * Recursively resolves variable assignments to find all aliases of a translation callback parameter.
 * Handles cases like: const t = translate; const a = translate; const b = a; const c = b;
 *
 * @param scope The scope to search within
 * @param variableName The variable name to resolve
 * @param visited Set to track already visited variables to prevent infinite loops
 * @returns Array of all variable names that reference the original translation callback
 */
export function resolveVariableAliases(
  scope: Scope,
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

      const otherBindingTyped = otherBinding as Binding;
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
  config: ParsingConfig,
  state: ParsingState,
  output: ParsingOutput
): void {
  if (
    tPath.parent.type === 'CallExpression' &&
    tPath.parent.callee === tPath.node
  ) {
    // Direct translation call: t('hello')
    processTranslationCall(tPath, config, output);
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
          config,
          output
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
          config,
          output
        );
      }
      // If not found locally, check if it's an imported function
      else if (state.importMap.has(callee.name)) {
        const importPath = state.importMap.get(callee.name)!;
        const resolvedPath = resolveImportPath(
          config.file,
          importPath,
          config.parsingOptions,
          resolveImportPathCache
        );

        if (resolvedPath) {
          processFunctionInFile(
            resolvedPath,
            callee.name,
            argIndex,
            config,
            state,
            output
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
  config: ParsingConfig,
  output: ParsingOutput
): void {
  if (functionNode.params.length > argIndex) {
    const param = functionNode.params[argIndex];
    const paramName = extractParameterName(param);

    if (paramName) {
      findFunctionParameterUsage(functionPath, paramName, config, output);
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
  config: ParsingConfig,
  output: ParsingOutput
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
            config,
            { visited: new Set(), importMap },
            output
          );
        });
      }
    });
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
  config: ParsingConfig,
  state: ParsingState,
  output: ParsingOutput
): void {
  // Check cache first to avoid redundant parsing
  const cacheKey = `${filePath}::${functionName}::${argIndex}`;
  if (processFunctionCache.has(cacheKey)) {
    return;
  }

  // Prevent infinite loops from circular re-exports
  if (state.visited.has(filePath)) {
    return;
  }
  state.visited.add(filePath);

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
            config,
            output
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
            config,
            output
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
          config.parsingOptions,
          resolveImportPathCache
        );
        if (resolvedPath) {
          processFunctionInFile(
            resolvedPath,
            functionName,
            argIndex,
            config,
            state,
            output
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
  config: ParsingConfig,
  output: ParsingOutput
): void {
  // First, collect all imports in this file to track cross-file function calls
  const importMap = buildImportMap(path.scope.getProgramParent().path);

  const referencePaths = path.scope.bindings[importName]?.referencePaths || [];

  for (const refPath of referencePaths) {
    // Handle msg() calls directly without variable assignment
    if (originalName === MSG_REGISTRATION_FUNCTION) {
      const msgConfig: ParsingConfig = {
        parsingOptions: config.parsingOptions,
        file: config.file,
        ignoreAdditionalData: false,
        ignoreDynamicContent: false,
        ignoreInvalidIcu: false,
      };

      // Check if this is a direct call to msg('string')
      if (
        refPath.parent.type === 'CallExpression' &&
        refPath.parent.callee === refPath.node
      ) {
        processTranslationCall(refPath, msgConfig, output);
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
        output.errors.push(
          warnAsyncUseGT(
            config.file,
            `${refPath.node.loc?.start?.line}:${refPath.node.loc?.start?.column}`
          )
        );
        return;
      } else if (
        !asyncScope &&
        (originalName === INLINE_TRANSLATION_HOOK_ASYNC ||
          originalName === INLINE_MESSAGE_HOOK_ASYNC)
      ) {
        output.errors.push(
          warnSyncGetGT(
            config.file,
            `${refPath.node.loc?.start?.line}:${refPath.node.loc?.start?.column}`
          )
        );
        return;
      }

      const isMessageHook =
        originalName === INLINE_MESSAGE_HOOK ||
        originalName === INLINE_MESSAGE_HOOK_ASYNC;
      const hookConfig: ParsingConfig = {
        parsingOptions: config.parsingOptions,
        file: config.file,
        ignoreAdditionalData: isMessageHook,
        ignoreDynamicContent: isMessageHook,
        ignoreInvalidIcu: isMessageHook,
      };

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
              hookConfig,
              { visited: new Set(), importMap },
              output
            );
          }
        });
      }
    }
  }
}
