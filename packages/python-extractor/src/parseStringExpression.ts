import fs from 'node:fs';
import type { SyntaxNode } from './parser.js';
import { getParser } from './parser.js';
import type { StringNode } from './stringNode.js';
import type { ImportAlias } from './extractImports.js';
import { PYTHON_DECLARE_STATIC, PYTHON_DECLARE_VAR } from './constants.js';
import {
  resolveFunctionInCurrentFile,
  resolveFunctionInFile,
} from './resolveFunctionVariants.js';
import { extractImports } from './extractImports.js';
import { resolveImportPath } from './resolveImport.js';
import { declareVar } from 'generaltranslation/internal';

type ParseContext = {
  rootNode: SyntaxNode;
  imports: ImportAlias[];
  filePath: string;
  errors: string[];
};

/**
 * Checks if an expression contains declare_static or declare_var calls.
 */
export function containsStaticCalls(
  node: SyntaxNode,
  imports: ImportAlias[]
): boolean {
  const staticNames = getStaticImportNames(imports);
  if (staticNames.size === 0) return false;
  return hasStaticCallRecursive(node, staticNames);
}

function hasStaticCallRecursive(node: SyntaxNode, names: Set<string>): boolean {
  if (node.type === 'call') {
    const funcNode = node.childForFieldName('function');
    if (
      funcNode &&
      funcNode.type === 'identifier' &&
      names.has(funcNode.text)
    ) {
      return true;
    }
  }
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && hasStaticCallRecursive(child, names)) return true;
  }
  return false;
}

/**
 * Parses the first argument of t() into a StringNode tree.
 * Handles: plain strings, f-strings with declare_static/declare_var,
 * binary + concatenation, and standalone declare_static calls.
 */
export async function parseStringExpression(
  node: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  // Parenthesized expression: unwrap and recurse
  if (node.type === 'parenthesized_expression') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type !== '(' && child.type !== ')') {
        return parseStringExpression(child, ctx);
      }
    }
    return null;
  }

  // Plain string (no f-string)
  if (node.type === 'string' && !isFString(node)) {
    const content = extractStringContent(node);
    if (content === undefined) return null;
    return { type: 'text', text: content };
  }

  // F-string with interpolations
  if (node.type === 'string' && isFString(node)) {
    return parseFString(node, ctx);
  }

  // Binary operator: string concatenation with +
  if (node.type === 'binary_operator') {
    return parseBinaryOperator(node, ctx);
  }

  // Standalone call: declare_static(...)
  if (node.type === 'call') {
    const funcNode = node.childForFieldName('function');
    if (funcNode && funcNode.type === 'identifier') {
      const originalName = getOriginalImportName(funcNode.text, ctx.imports);
      if (originalName === PYTHON_DECLARE_STATIC) {
        return resolveDeclareStaticArg(node, ctx);
      }
      if (originalName === PYTHON_DECLARE_VAR) {
        return resolveDeclareVarArg(node, ctx);
      }
    }
  }

  ctx.errors.push(
    `${locationStr(node)}: unsupported expression type "${node.type}" in translation call`
  );
  return null;
}

/**
 * Parses an f-string into a StringNode tree.
 * string_content → text nodes, interpolation → check for declare_static/declare_var
 */
async function parseFString(
  node: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  const parts: StringNode[] = [];

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;

    if (child.type === 'string_content') {
      if (child.text.length > 0) {
        parts.push({ type: 'text', text: child.text });
      }
      continue;
    }

    if (child.type === 'interpolation') {
      const result = await parseInterpolation(child, ctx);
      if (result) {
        parts.push(result);
      }
      continue;
    }

    // Skip string_start, string_end, etc.
  }

  if (parts.length === 0) return { type: 'text', text: '' };
  if (parts.length === 1) return parts[0];
  return { type: 'sequence', nodes: parts };
}

/**
 * Parses an interpolation within an f-string.
 * Must be a declare_static() or declare_var() call.
 */
async function parseInterpolation(
  interpNode: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  // Find the expression inside the interpolation (skip { and })
  let expr: SyntaxNode | null = null;
  for (let i = 0; i < interpNode.childCount; i++) {
    const child = interpNode.child(i);
    if (
      child &&
      child.type !== '{' &&
      child.type !== '}' &&
      child.type !== 'type_conversion' &&
      child.type !== 'format_specifier'
    ) {
      expr = child;
      break;
    }
  }

  if (!expr) {
    ctx.errors.push(
      `${locationStr(interpNode)}: empty interpolation in f-string`
    );
    return null;
  }

  if (expr.type === 'call') {
    const funcNode = expr.childForFieldName('function');
    if (funcNode && funcNode.type === 'identifier') {
      const originalName = getOriginalImportName(funcNode.text, ctx.imports);
      if (originalName === PYTHON_DECLARE_STATIC) {
        return resolveDeclareStaticArg(expr, ctx);
      }
      if (originalName === PYTHON_DECLARE_VAR) {
        return resolveDeclareVarArg(expr, ctx);
      }
    }
  }

  // Not a declare_static/declare_var call — error
  ctx.errors.push(
    `${locationStr(interpNode)}: f-string interpolation must use declare_static() or declare_var(), got "${expr.text}"`
  );
  return null;
}

/**
 * Parses binary + concatenation into a sequence node.
 */
async function parseBinaryOperator(
  node: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  const left = node.childForFieldName('left');
  const operator = node.childForFieldName('operator');
  const right = node.childForFieldName('right');

  if (!left || !right) {
    ctx.errors.push(`${locationStr(node)}: binary operator missing operands`);
    return null;
  }

  // Verify it's a + operator
  if (operator && operator.text !== '+') {
    ctx.errors.push(
      `${locationStr(node)}: unsupported binary operator "${operator.text}" in translation call`
    );
    return null;
  }

  const leftNode = await parseStringExpression(left, ctx);
  const rightNode = await parseStringExpression(right, ctx);

  if (!leftNode || !rightNode) return null;

  // Flatten nested sequences
  const parts: StringNode[] = [];
  if (leftNode.type === 'sequence') {
    parts.push(...leftNode.nodes);
  } else {
    parts.push(leftNode);
  }
  if (rightNode.type === 'sequence') {
    parts.push(...rightNode.nodes);
  } else {
    parts.push(rightNode);
  }

  return { type: 'sequence', nodes: parts };
}

/**
 * Resolves the argument of a declare_static() call into a StringNode.
 * Handles: string literals, ternary expressions, function calls.
 */
async function resolveDeclareStaticArg(
  callNode: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  const arg = getFirstPositionalArg(callNode);
  if (!arg) {
    ctx.errors.push(
      `${locationStr(callNode)}: declare_static() requires an argument`
    );
    return null;
  }

  return resolveStaticValue(arg, ctx);
}

/**
 * Resolves a value expression that should produce string variants.
 * Handles: string literals, ternary, function calls, binary concat,
 * and declare_var() calls (nested inside declare_static).
 */
async function resolveStaticValue(
  node: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  // Parenthesized expression: unwrap and recurse
  if (node.type === 'parenthesized_expression') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type !== '(' && child.type !== ')') {
        return resolveStaticValue(child, ctx);
      }
    }
    return null;
  }

  // String literal
  if (node.type === 'string' && !isFString(node)) {
    const content = extractStringContent(node);
    if (content === undefined) return null;
    return { type: 'text', text: content };
  }

  // Ternary / conditional expression: "day" if cond else "night"
  if (node.type === 'conditional_expression') {
    return resolveConditional(node, ctx);
  }

  // Binary operator: string concatenation with +
  if (node.type === 'binary_operator') {
    return resolveStaticBinaryOperator(node, ctx);
  }

  // Function call — could be a user function or declare_var()
  if (node.type === 'call') {
    const funcNode = node.childForFieldName('function');
    if (funcNode && funcNode.type === 'identifier') {
      const originalName = getOriginalImportName(funcNode.text, ctx.imports);
      if (originalName === PYTHON_DECLARE_VAR) {
        return resolveDeclareVarArg(node, ctx);
      }
    }
    return resolveFunctionCall(node, ctx);
  }

  // Identifier: resolve to its assigned value
  if (node.type === 'identifier') {
    const result = await resolveIdentifier(node, ctx);
    if (result) return result;

    ctx.errors.push(
      `${locationStr(node)}: could not resolve identifier "${node.text}" to a static value`
    );
    return null;
  }

  // Subscript: dictionary access like LABELS[score] — returns all values as choices
  if (node.type === 'subscript') {
    return resolveSubscript(node, ctx);
  }

  // Attribute: dictionary access like obj.attr — returns the specific value
  if (node.type === 'attribute') {
    return resolveAttribute(node, ctx);
  }

  ctx.errors.push(
    `${locationStr(node)}: unsupported declare_static argument type "${node.type}"`
  );
  return null;
}

/**
 * Handles binary + concatenation within a static value context.
 */
async function resolveStaticBinaryOperator(
  node: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  const left = node.childForFieldName('left');
  const right = node.childForFieldName('right');

  if (!left || !right) {
    ctx.errors.push(`${locationStr(node)}: binary operator missing operands`);
    return null;
  }

  // Verify it's a + operator
  const operator = node.childForFieldName('operator');
  if (operator && operator.text !== '+') {
    ctx.errors.push(
      `${locationStr(node)}: unsupported binary operator "${operator.text}" in static expression`
    );
    return null;
  }

  const leftNode = await resolveStaticValue(left, ctx);
  const rightNode = await resolveStaticValue(right, ctx);

  if (!leftNode || !rightNode) return null;

  // Flatten nested sequences
  const parts: StringNode[] = [];
  if (leftNode.type === 'sequence') {
    parts.push(...leftNode.nodes);
  } else {
    parts.push(leftNode);
  }
  if (rightNode.type === 'sequence') {
    parts.push(...rightNode.nodes);
  } else {
    parts.push(rightNode);
  }

  return { type: 'sequence', nodes: parts };
}

/**
 * Resolves a Python conditional expression (ternary):
 * "day" if cond else "night"
 * tree-sitter: conditional_expression → [consequent, if, condition, else, alternate]
 */
async function resolveConditional(
  node: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  // In Python's tree-sitter, the conditional_expression fields are:
  // body = consequent (the value if true)
  // condition = the test
  // alternative = the else value (named 'alternative' field)
  // But field names vary by tree-sitter version. Let's use positional children.
  // Structure: consequent "if" condition "else" alternative

  // The tree-sitter Python grammar uses named children:
  // body (first expression), if keyword, condition, else keyword, alternative
  // But let's find them by field name first, then fall back to positional.

  // Try using children directly: first non-keyword child is consequent,
  // child after "else" keyword is alternate
  let consequent: SyntaxNode | null = null;
  let alternate: SyntaxNode | null = null;
  let seenElse = false;

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;

    if (child.type === 'if') continue;
    if (child.type === 'else') {
      seenElse = true;
      continue;
    }

    if (!seenElse && !consequent) {
      consequent = child;
    } else if (seenElse && !alternate) {
      alternate = child;
    }
  }

  if (!consequent || !alternate) {
    ctx.errors.push(
      `${locationStr(node)}: could not parse conditional expression`
    );
    return null;
  }

  // Recursively resolve both branches (handles nested ternaries)
  const consequentNode = await resolveStaticValue(consequent, ctx);
  const alternateNode = await resolveStaticValue(alternate, ctx);

  if (!consequentNode || !alternateNode) return null;

  // Flatten choices
  const branches: StringNode[] = [];
  if (consequentNode.type === 'choice') {
    branches.push(...consequentNode.nodes);
  } else {
    branches.push(consequentNode);
  }
  if (alternateNode.type === 'choice') {
    branches.push(...alternateNode.nodes);
  } else {
    branches.push(alternateNode);
  }

  return { type: 'choice', nodes: branches };
}

/**
 * Resolves a function call to its string return variants.
 * Looks up the function locally, then in imported files.
 */
async function resolveFunctionCall(
  callNode: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  const funcNode = callNode.childForFieldName('function');
  if (!funcNode || funcNode.type !== 'identifier') {
    ctx.errors.push(
      `${locationStr(callNode)}: cannot resolve non-identifier function call`
    );
    return null;
  }

  const funcName = funcNode.text;

  // Expression parser callback for resolving return expressions.
  // Receives the actual rootNode and filePath from whichever file
  // the function is defined in (handles re-exports correctly).
  const exprParser = (
    node: SyntaxNode,
    targetRootNode: SyntaxNode,
    targetFilePath: string
  ) => {
    const targetImports = extractImportsFromRoot(targetRootNode, ctx.imports);
    return resolveStaticValue(node, {
      rootNode: targetRootNode,
      imports: targetImports,
      filePath: targetFilePath,
      errors: ctx.errors,
    });
  };

  // Try resolving in current file
  const localResult = await resolveFunctionInCurrentFile(
    funcName,
    ctx.rootNode,
    ctx.filePath,
    exprParser
  );
  if (localResult) return localResult;

  // Try resolving from imports (follows re-export chains automatically)
  const importInfo = findImportForName(funcName, ctx);
  if (importInfo) {
    const result = await resolveFunctionInFile(
      importInfo.originalName,
      importInfo.filePath,
      exprParser
    );
    if (result) return result;
  }

  ctx.errors.push(
    `${locationStr(callNode)}: could not resolve function "${funcName}" to string return values`
  );
  return null;
}

/**
 * Extracts GT import aliases from a target file's root node.
 * Merges with parent imports for GT package functions (declare_var, etc.)
 * that may not be imported in the target file.
 */
function extractImportsFromRoot(
  rootNode: SyntaxNode,
  parentImports: ImportAlias[]
): ImportAlias[] {
  // Extract GT-only imports from the target file using the same
  // filtering logic as the main extractImports (filters by GT packages)
  const fileImports = extractImports(rootNode);

  // Carry over GT declare_* imports from the calling context
  // (in case the helper file doesn't import them directly)
  const parentDeclareImports = parentImports.filter(
    (imp) =>
      imp.originalName === PYTHON_DECLARE_STATIC ||
      imp.originalName === PYTHON_DECLARE_VAR
  );

  // Deduplicate: prefer the target file's own imports over parent's
  const seen = new Set(fileImports.map((imp) => imp.localName));
  const merged = [...fileImports];
  for (const imp of parentDeclareImports) {
    if (!seen.has(imp.localName)) {
      merged.push(imp);
    }
  }

  return merged;
}

/**
 * Resolves the argument of a declare_var() call.
 * Produces ICU placeholder text using declareVar from generaltranslation.
 */
async function resolveDeclareVarArg(
  callNode: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  const argsNode = callNode.childForFieldName('arguments');
  if (!argsNode) {
    ctx.errors.push(
      `${locationStr(callNode)}: declare_var() requires arguments`
    );
    return null;
  }

  // Get the first positional arg (the variable - we use empty string since it's runtime)
  const firstArg = getFirstPositionalArg(callNode);
  if (!firstArg) {
    ctx.errors.push(
      `${locationStr(callNode)}: declare_var() requires a variable argument`
    );
    return null;
  }

  // Extract optional _name kwarg
  let nameOption: string | undefined;
  for (let i = 0; i < argsNode.childCount; i++) {
    const child = argsNode.child(i);
    if (!child || child.type !== 'keyword_argument') continue;

    const nameNode = child.childForFieldName('name');
    const valueNode = child.childForFieldName('value');
    if (!nameNode || !valueNode) continue;

    if (nameNode.text === '_name') {
      if (valueNode.type === 'string' && !isFString(valueNode)) {
        nameOption = extractStringContent(valueNode);
      }
    }
  }

  // Use declareVar with empty string for the runtime variable value
  const options = nameOption ? { $name: nameOption } : undefined;
  const icuText = declareVar('', options);

  return { type: 'text', text: icuText };
}

// ===== Constant / Dictionary Resolution ===== //

/**
 * Finds a top-level assignment `name = <value>` in the given root node.
 * Returns the right-hand side (value) node, or null if not found.
 */
function findConstantAssignment(
  name: string,
  rootNode: SyntaxNode
): SyntaxNode | null {
  for (let i = 0; i < rootNode.childCount; i++) {
    const child = rootNode.child(i);
    if (!child || child.type !== 'expression_statement') continue;
    const expr = child.child(0);
    if (!expr || expr.type !== 'assignment') continue;
    const left = expr.childForFieldName('left');
    const right = expr.childForFieldName('right');
    if (left?.type === 'identifier' && left.text === name && right) {
      return right;
    }
  }
  return null;
}

/**
 * Resolves a constant assignment from an external file.
 * Reads the file, parses it with tree-sitter, finds the assignment,
 * and resolves the value using resolveStaticValue in that file's context.
 */
async function resolveConstantInFile(
  name: string,
  filePath: string,
  ctx: ParseContext
): Promise<SyntaxNode | null> {
  let source: string;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const parser = await getParser();
  const tree = parser.parse(source);
  if (!tree) return null;

  return findConstantAssignment(name, tree.rootNode);
}

/**
 * Guard against infinite recursion when resolving identifier chains.
 * Tracks variable names currently being resolved to detect circular references.
 */
const resolvingIdentifiers = new Set<string>();

/**
 * Resolves an identifier to its static value by finding the assignment
 * in the current file or cross-file via imports.
 */
async function resolveIdentifier(
  node: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  const name = node.text;

  // Guard against circular references (e.g., x = y; y = x)
  const guardKey = `${ctx.filePath}::${name}`;
  if (resolvingIdentifiers.has(guardKey)) {
    return null;
  }

  resolvingIdentifiers.add(guardKey);
  try {
    // Try local assignment first
    const localValue = findConstantAssignment(name, ctx.rootNode);
    if (localValue) {
      return await resolveStaticValue(localValue, ctx);
    }

    // Try cross-file via imports
    const importInfo = findImportForName(name, ctx);
    if (importInfo) {
      let source: string;
      try {
        source = fs.readFileSync(importInfo.filePath, 'utf8');
      } catch {
        return null;
      }

      const parser = await getParser();
      const tree = parser.parse(source);
      if (!tree) return null;

      const externalValue = findConstantAssignment(
        importInfo.originalName,
        tree.rootNode
      );
      if (externalValue) {
        const externalImports = extractImportsFromRoot(
          tree.rootNode,
          ctx.imports
        );
        return await resolveStaticValue(externalValue, {
          rootNode: tree.rootNode,
          imports: externalImports,
          filePath: importInfo.filePath,
          errors: ctx.errors,
        });
      }
    }

    return null;
  } finally {
    resolvingIdentifiers.delete(guardKey);
  }
}

/**
 * Finds a dictionary assignment and returns the dictionary node.
 * Searches locally first, then cross-file via imports.
 * Returns the dictionary node and the context (rootNode, filePath, imports)
 * for resolving values within it.
 */
async function findDictionaryAssignment(
  name: string,
  ctx: ParseContext
): Promise<{ dictNode: SyntaxNode; valueCtx: ParseContext } | null> {
  // Try local assignment
  const localValue = findConstantAssignment(name, ctx.rootNode);
  if (localValue && localValue.type === 'dictionary') {
    return { dictNode: localValue, valueCtx: ctx };
  }

  // Try cross-file
  const importInfo = findImportForName(name, ctx);
  if (importInfo) {
    let source: string;
    try {
      source = fs.readFileSync(importInfo.filePath, 'utf8');
    } catch {
      return null;
    }

    const parser = await getParser();
    const tree = parser.parse(source);
    if (!tree) return null;

    const externalValue = findConstantAssignment(
      importInfo.originalName,
      tree.rootNode
    );
    if (externalValue && externalValue.type === 'dictionary') {
      const externalImports = extractImportsFromRoot(
        tree.rootNode,
        ctx.imports
      );
      return {
        dictNode: externalValue,
        valueCtx: {
          rootNode: tree.rootNode,
          imports: externalImports,
          filePath: importInfo.filePath,
          errors: ctx.errors,
        },
      };
    }
  }

  return null;
}

// ===== Dictionary Entry Collection & Nesting Helpers ===== //

interface DictEntry {
  key: string | null;
  valueNode: SyntaxNode;
}

interface ResolvedDict {
  dictNode: SyntaxNode;
  valueCtx: ParseContext;
}

/**
 * Collects all key-value entries from a dictionary node,
 * including entries from spread sources (**base).
 */
async function collectDictEntries(
  dictNode: SyntaxNode,
  ctx: ParseContext
): Promise<DictEntry[]> {
  const entries: DictEntry[] = [];

  for (let i = 0; i < dictNode.childCount; i++) {
    const child = dictNode.child(i);
    if (!child) continue;

    if (child.type === 'pair') {
      const keyNode = child.childForFieldName('key');
      const valueNode = child.childForFieldName('value');
      if (!valueNode) continue;

      let key: string | null = null;
      if (keyNode) {
        if (keyNode.type === 'string' && !isFString(keyNode)) {
          key = extractStringContent(keyNode) ?? null;
        } else if (keyNode.type === 'identifier') {
          key = keyNode.text;
        } else if (keyNode.type === 'integer') {
          key = keyNode.text;
        }
      }
      entries.push({ key, valueNode });
    } else if (child.type === 'dictionary_splat') {
      // Get the spread source expression (child after **)
      let splatExpr: SyntaxNode | null = null;
      for (let j = 0; j < child.childCount; j++) {
        const splatChild = child.child(j);
        if (splatChild && splatChild.type !== '**') {
          splatExpr = splatChild;
          break;
        }
      }
      if (!splatExpr || splatExpr.type !== 'identifier') continue;

      const name = splatExpr.text;

      // Try local first
      const localDict = findConstantAssignment(name, ctx.rootNode);
      if (localDict && localDict.type === 'dictionary') {
        entries.push(...(await collectDictEntries(localDict, ctx)));
      } else {
        // Try cross-file
        const importInfo = findImportForName(name, ctx);
        if (importInfo) {
          let source: string;
          try {
            source = fs.readFileSync(importInfo.filePath, 'utf8');
          } catch {
            continue;
          }
          const parser = await getParser();
          const tree = parser.parse(source);
          if (!tree) continue;
          const externalValue = findConstantAssignment(
            importInfo.originalName,
            tree.rootNode
          );
          if (externalValue && externalValue.type === 'dictionary') {
            const externalImports = extractImportsFromRoot(
              tree.rootNode,
              ctx.imports
            );
            const externalCtx: ParseContext = {
              rootNode: tree.rootNode,
              imports: externalImports,
              filePath: importInfo.filePath,
              errors: ctx.errors,
            };
            entries.push(
              ...(await collectDictEntries(externalValue, externalCtx))
            );
          }
        }
      }
    }
  }

  return entries;
}

/**
 * Resolves an expression to dictionary AST node(s).
 * Handles identifier, subscript chains, and attribute chains.
 */
async function resolveToDictNodes(
  node: SyntaxNode,
  ctx: ParseContext
): Promise<ResolvedDict[]> {
  // Case 1: identifier — base case
  if (node.type === 'identifier') {
    const result = await findDictionaryAssignment(node.text, ctx);
    if (result) return [result];
    return [];
  }

  // Case 2: subscript (e.g., D["a"] in D["a"]["x"])
  if (node.type === 'subscript') {
    const valueNode = node.childForFieldName('value');
    if (!valueNode) return [];

    const parentDicts = await resolveToDictNodes(valueNode, ctx);
    if (parentDicts.length === 0) return [];

    const subscriptKey = node.childForFieldName('subscript');
    if (!subscriptKey) return [];

    // Check if key is a static string literal
    const isStaticKey =
      subscriptKey.type === 'string' && !isFString(subscriptKey);
    const staticKeyValue = isStaticKey
      ? extractStringContent(subscriptKey)
      : null;

    const results: ResolvedDict[] = [];
    for (const parent of parentDicts) {
      const entries = await collectDictEntries(parent.dictNode, parent.valueCtx);

      if (staticKeyValue != null) {
        // Static: narrow to one specific key
        for (const entry of entries) {
          if (
            entry.key === staticKeyValue &&
            entry.valueNode.type === 'dictionary'
          ) {
            results.push({
              dictNode: entry.valueNode,
              valueCtx: parent.valueCtx,
            });
            break;
          }
        }
      } else {
        // Dynamic: collect ALL entries whose values are dictionaries
        for (const entry of entries) {
          if (entry.valueNode.type === 'dictionary') {
            results.push({
              dictNode: entry.valueNode,
              valueCtx: parent.valueCtx,
            });
          }
        }
      }
    }
    return results;
  }

  // Case 3: attribute (e.g., D.a in D.a.x)
  if (node.type === 'attribute') {
    const objectNode = node.childForFieldName('object');
    const attrNode = node.childForFieldName('attribute');
    if (!objectNode || !attrNode) return [];

    const parentDicts = await resolveToDictNodes(objectNode, ctx);
    if (parentDicts.length === 0) return [];

    const attrName = attrNode.text;
    const results: ResolvedDict[] = [];
    for (const parent of parentDicts) {
      const entries = await collectDictEntries(parent.dictNode, parent.valueCtx);
      for (const entry of entries) {
        if (entry.key === attrName && entry.valueNode.type === 'dictionary') {
          results.push({
            dictNode: entry.valueNode,
            valueCtx: parent.valueCtx,
          });
          break;
        }
      }
    }
    return results;
  }

  return [];
}

/**
 * Resolves a subscript expression (e.g., `LABELS[score]` or `D["a"]["x"]`)
 * by extracting values from the resolved dictionary.
 * Supports nested access chains and spread resolution.
 */
async function resolveSubscript(
  node: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  const valueNode = node.childForFieldName('value');
  if (!valueNode) {
    ctx.errors.push(`${locationStr(node)}: subscript missing value`);
    return null;
  }

  // Resolve the object to dict node(s) — supports nesting
  const dicts = await resolveToDictNodes(valueNode, ctx);
  if (dicts.length === 0) {
    ctx.errors.push(
      `${locationStr(node)}: could not find dictionary for "${valueNode.text}"`
    );
    return null;
  }

  const subscriptKey = node.childForFieldName('subscript');
  const isStaticKey =
    subscriptKey?.type === 'string' && !isFString(subscriptKey);
  const staticKeyValue = isStaticKey
    ? extractStringContent(subscriptKey!)
    : null;

  const branches: StringNode[] = [];
  for (const { dictNode, valueCtx } of dicts) {
    const entries = await collectDictEntries(dictNode, valueCtx);

    if (staticKeyValue != null) {
      // Static key: resolve that specific value
      for (const entry of entries) {
        if (entry.key === staticKeyValue) {
          const resolved = await resolveStaticValue(entry.valueNode, valueCtx);
          if (resolved) {
            if (resolved.type === 'choice') {
              branches.push(...resolved.nodes);
            } else {
              branches.push(resolved);
            }
          }
          break;
        }
      }
    } else {
      // Dynamic key: extract ALL values
      for (const entry of entries) {
        const resolved = await resolveStaticValue(entry.valueNode, valueCtx);
        if (resolved) {
          if (resolved.type === 'choice') {
            branches.push(...resolved.nodes);
          } else {
            branches.push(resolved);
          }
        }
      }
    }
  }

  if (branches.length === 0) {
    ctx.errors.push(
      `${locationStr(node)}: dictionary has no resolvable values`
    );
    return null;
  }

  if (branches.length === 1) return branches[0];
  return { type: 'choice', nodes: branches };
}

/**
 * Resolves an attribute access expression (e.g., `obj.attr` or `obj.a.b`)
 * by finding the specific dictionary pair with a matching key.
 * Supports nested access chains and spread resolution.
 */
async function resolveAttribute(
  node: SyntaxNode,
  ctx: ParseContext
): Promise<StringNode | null> {
  const objectNode = node.childForFieldName('object');
  const attrNode = node.childForFieldName('attribute');

  if (!objectNode || !attrNode) {
    ctx.errors.push(
      `${locationStr(node)}: attribute access missing object or attribute`
    );
    return null;
  }

  const attrName = attrNode.text;

  // Resolve the object to dict node(s) — supports nesting
  const dicts = await resolveToDictNodes(objectNode, ctx);
  if (dicts.length === 0) {
    ctx.errors.push(
      `${locationStr(node)}: could not find dictionary for "${objectNode.text}"`
    );
    return null;
  }

  const branches: StringNode[] = [];
  for (const { dictNode, valueCtx } of dicts) {
    const entries = await collectDictEntries(dictNode, valueCtx);
    for (const entry of entries) {
      if (entry.key === attrName) {
        const resolved = await resolveStaticValue(entry.valueNode, valueCtx);
        if (resolved) {
          if (resolved.type === 'choice') {
            branches.push(...resolved.nodes);
          } else {
            branches.push(resolved);
          }
        }
        break;
      }
    }
  }

  if (branches.length === 0) {
    ctx.errors.push(
      `${locationStr(node)}: could not find key "${attrName}" in dictionary`
    );
    return null;
  }

  if (branches.length === 1) return branches[0];
  return { type: 'choice', nodes: branches };
}

// ===== Helpers ===== //

function getFirstPositionalArg(callNode: SyntaxNode): SyntaxNode | null {
  const argsNode = callNode.childForFieldName('arguments');
  if (!argsNode) return null;

  for (let i = 0; i < argsNode.childCount; i++) {
    const child = argsNode.child(i);
    if (
      child &&
      child.type !== '(' &&
      child.type !== ')' &&
      child.type !== ',' &&
      child.type !== 'keyword_argument'
    ) {
      return child;
    }
  }
  return null;
}

function getOriginalImportName(
  localName: string,
  imports: ImportAlias[]
): string | null {
  for (const imp of imports) {
    if (imp.localName === localName) {
      return imp.originalName;
    }
  }
  return null;
}

function getStaticImportNames(imports: ImportAlias[]): Set<string> {
  const names = new Set<string>();
  for (const imp of imports) {
    if (
      imp.originalName === PYTHON_DECLARE_STATIC ||
      imp.originalName === PYTHON_DECLARE_VAR
    ) {
      names.add(imp.localName);
    }
  }
  return names;
}

/**
 * Finds import info for a given local name (for cross-file function resolution).
 * Only looks at non-GT imports (user function imports).
 */
function findImportForName(
  localName: string,
  ctx: ParseContext
): { originalName: string; filePath: string } | null {
  // Walk the AST to find import_from_statement nodes
  for (let i = 0; i < ctx.rootNode.childCount; i++) {
    const node = ctx.rootNode.child(i);
    if (!node || node.type !== 'import_from_statement') continue;

    const moduleName = getModuleName(node);
    if (!moduleName) continue;

    // Check all imported names in this statement
    for (let j = 0; j < node.childCount; j++) {
      const child = node.child(j);
      if (!child) continue;

      if (child.type === 'aliased_import') {
        const nameNode = child.childForFieldName('name');
        const aliasNode = child.childForFieldName('alias');
        const importedName = nameNode?.text;
        const alias = aliasNode?.text ?? importedName;
        if (alias === localName && importedName) {
          const filePath = resolveImportPath(moduleName, ctx.filePath);
          if (filePath) {
            return { originalName: importedName, filePath };
          }
        }
      } else if (child.type === 'dotted_name') {
        if (child.text === moduleName) continue; // Skip module name itself
        if (child.text === localName) {
          const filePath = resolveImportPath(moduleName, ctx.filePath);
          if (filePath) {
            return { originalName: localName, filePath };
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

function isFString(stringNode: SyntaxNode): boolean {
  for (let i = 0; i < stringNode.childCount; i++) {
    const child = stringNode.child(i);
    if (child && child.type === 'string_start') {
      return /^[fF]/.test(child.text);
    }
    if (child && child.type === 'interpolation') {
      return true;
    }
  }
  return false;
}

function extractStringContent(stringNode: SyntaxNode): string | undefined {
  for (let i = 0; i < stringNode.childCount; i++) {
    const child = stringNode.child(i);
    if (child && child.type === 'string_content') {
      return child.text;
    }
  }

  let hasStart = false;
  let hasEnd = false;
  for (let i = 0; i < stringNode.childCount; i++) {
    const child = stringNode.child(i);
    if (child?.type === 'string_start') hasStart = true;
    if (child?.type === 'string_end') hasEnd = true;
  }
  if (hasStart && hasEnd) return '';

  return undefined;
}

function locationStr(node: SyntaxNode): string {
  return `line ${node.startPosition.row + 1}, col ${node.startPosition.column}`;
}
