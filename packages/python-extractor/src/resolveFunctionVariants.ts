import fs from 'node:fs';
import type { SyntaxNode } from './parser.js';
import { getParser } from './parser.js';
import type { StringNode } from './stringNode.js';

/**
 * Callback to parse a return expression into a StringNode.
 * Provided by the caller so function resolution doesn't need to know about
 * declare_var, declare_static, imports, etc.
 */
export type ExpressionParser = (
  node: SyntaxNode,
  rootNode: SyntaxNode
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
  parseExpr: ExpressionParser
): Promise<StringNode | null> {
  const funcDef = findFunctionDefinition(rootNode, functionName);
  if (!funcDef) return null;
  return extractReturnVariants(funcDef, rootNode, parseExpr);
}

/**
 * Resolves all return values of a function defined in an external file.
 * Results are cached by filePath::functionName.
 */
export async function resolveFunctionInFile(
  functionName: string,
  filePath: string,
  parseExpr: ExpressionParser
): Promise<StringNode | null> {
  const cacheKey = `${filePath}::${functionName}`;
  if (crossFileCache.has(cacheKey)) {
    return crossFileCache.get(cacheKey)!;
  }

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

  const result = await resolveFunctionInCurrentFile(
    functionName,
    tree.rootNode,
    parseExpr
  );
  crossFileCache.set(cacheKey, result);
  return result;
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
    const node = await parseExpr(expr, rootNode);
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

export function clearFunctionCache(): void {
  crossFileCache.clear();
}
