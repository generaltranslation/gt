import fs from 'node:fs';
import type { SyntaxNode } from './parser.js';
import { getParser } from './parser.js';
import type { StringNode } from './stringNode.js';
import { resolveImportPath } from './resolveImport.js';

/**
 * Callback to parse a return expression into a StringNode.
 * Provided by the caller so function resolution doesn't need to know about
 * declare_var, derive, imports, etc.
 *
 * @param node - The return expression AST node
 * @param rootNode - The root AST node of the file containing the function
 * @param filePath - The absolute path of the file containing the function
 */
export type ExpressionParser = (
  node: SyntaxNode,
  rootNode: SyntaxNode,
  filePath: string
) => Promise<StringNode | null>;

const crossFileCache = new Map<string, StringNode | null>();

/**
 * Resolves all return values of a function defined in the current file's AST.
 * Uses the provided expression parser to handle complex return expressions
 * (concat, declare_var, etc.).
 */
export async function resolveFunctionInCurrentFile(
  functionName: string,
  rootNode: SyntaxNode,
  filePath: string,
  parseExpr: ExpressionParser
): Promise<StringNode | null> {
  const funcDef = findFunctionDefinition(rootNode, functionName);
  if (!funcDef) return null;
  return extractReturnVariants(funcDef, rootNode, filePath, parseExpr);
}

/**
 * Resolves all return values of a function defined in an external file.
 * Follows re-export chains: if the function isn't defined in the target file
 * but is imported from another module, follows the import to the source.
 * Results are cached by filePath::functionName.
 */
export async function resolveFunctionInFile(
  functionName: string,
  filePath: string,
  parseExpr: ExpressionParser,
  visited?: Set<string>
): Promise<StringNode | null> {
  const cacheKey = `${filePath}::${functionName}`;
  if (crossFileCache.has(cacheKey)) {
    return crossFileCache.get(cacheKey)!;
  }

  // Prevent infinite re-export loops
  const visitedSet = visited ?? new Set<string>();
  if (visitedSet.has(cacheKey)) {
    crossFileCache.set(cacheKey, null);
    return null;
  }
  visitedSet.add(cacheKey);

  let source: string;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    crossFileCache.set(cacheKey, null);
    return null;
  }

  const parser = await getParser();
  const tree = parser.parse(source);
  if (!tree) {
    crossFileCache.set(cacheKey, null);
    return null;
  }

  // Try to find function definition in this file
  const result = await resolveFunctionInCurrentFile(
    functionName,
    tree.rootNode,
    filePath,
    parseExpr
  );
  if (result) {
    crossFileCache.set(cacheKey, result);
    return result;
  }

  // Function not defined here — check for re-exports
  const reExportInfo = findReExport(functionName, tree.rootNode, filePath);
  if (reExportInfo) {
    const reResult = await resolveFunctionInFile(
      reExportInfo.originalName,
      reExportInfo.filePath,
      parseExpr,
      visitedSet
    );
    crossFileCache.set(cacheKey, reResult);
    return reResult;
  }

  crossFileCache.set(cacheKey, null);
  return null;
}

/**
 * Finds a top-level function_definition by name in the AST.
 */
function findFunctionDefinition(
  rootNode: SyntaxNode,
  name: string
): SyntaxNode | null {
  for (let i = 0; i < rootNode.childCount; i++) {
    const child = rootNode.child(i);
    if (!child) continue;

    if (child.type === 'function_definition') {
      const nameNode = child.childForFieldName('name');
      if (nameNode && nameNode.text === name) {
        return child;
      }
    }

    // Also check decorated definitions
    if (child.type === 'decorated_definition') {
      const defNode = child.childForFieldName('definition');
      if (defNode && defNode.type === 'function_definition') {
        const nameNode = defNode.childForFieldName('name');
        if (nameNode && nameNode.text === name) {
          return defNode;
        }
      }
    }
  }
  return null;
}

/**
 * Extracts all return values from a function body and parses them into StringNodes.
 * Skips nested function definitions.
 */
async function extractReturnVariants(
  funcDef: SyntaxNode,
  rootNode: SyntaxNode,
  filePath: string,
  parseExpr: ExpressionParser
): Promise<StringNode | null> {
  const body = funcDef.childForFieldName('body');
  if (!body) return null;

  const returnExprs: SyntaxNode[] = [];
  collectReturnExpressions(body, returnExprs);

  if (returnExprs.length === 0) return null;

  // Parse each return expression into a StringNode
  const nodes: StringNode[] = [];
  for (const expr of returnExprs) {
    const node = await parseExpr(expr, rootNode, filePath);
    if (node) nodes.push(node);
  }

  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];

  return { type: 'choice', nodes };
}

/**
 * Recursively collects return expression nodes from a function body,
 * skipping nested function definitions.
 */
function collectReturnExpressions(
  node: SyntaxNode,
  results: SyntaxNode[]
): void {
  if (node.type === 'function_definition') {
    // Skip nested function bodies
    return;
  }

  if (node.type === 'return_statement') {
    // Get the expression being returned (skip the 'return' keyword)
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child || child.type === 'return') continue;
      results.push(child);
      break; // Only one expression per return
    }
    return;
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) collectReturnExpressions(child, results);
  }
}

/**
 * Checks if a function name is re-exported from another module in the given file.
 * e.g., `from derive_test import get_gender` makes `get_gender` a re-export.
 */
function findReExport(
  functionName: string,
  rootNode: SyntaxNode,
  currentFilePath: string
): { originalName: string; filePath: string } | null {
  for (let i = 0; i < rootNode.childCount; i++) {
    const node = rootNode.child(i);
    if (!node || node.type !== 'import_from_statement') continue;

    const moduleName = getModuleName(node);
    if (!moduleName) continue;

    for (let j = 0; j < node.childCount; j++) {
      const child = node.child(j);
      if (!child) continue;

      if (child.type === 'dotted_name' && child.text !== moduleName) {
        if (child.text === functionName) {
          const resolved = resolveImportPath(moduleName, currentFilePath);
          if (resolved) {
            return { originalName: functionName, filePath: resolved };
          }
        }
      } else if (child.type === 'aliased_import') {
        const nameNode = child.childForFieldName('name');
        const aliasNode = child.childForFieldName('alias');
        const alias = aliasNode?.text ?? nameNode?.text;
        if (alias === functionName && nameNode) {
          const resolved = resolveImportPath(moduleName, currentFilePath);
          if (resolved) {
            return { originalName: nameNode.text, filePath: resolved };
          }
        }
      }
    }
  }
  return null;
}

function getModuleName(importNode: SyntaxNode): string | undefined {
  const moduleNode = importNode.childForFieldName('module_name');
  if (moduleNode) return moduleNode.text;

  for (let i = 0; i < importNode.childCount; i++) {
    const child = importNode.child(i);
    if (!child) continue;
    if (child.type === 'import') break;
    if (child.type === 'dotted_name') return child.text;
    if (child.type === 'relative_import') return child.text;
  }
  return undefined;
}

export function clearFunctionCache(): void {
  crossFileCache.clear();
}
