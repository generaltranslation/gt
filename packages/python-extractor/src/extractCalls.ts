import type { SyntaxNode } from './parser.js';
import type { ImportAlias } from './extractImports.js';
import {
  PYTHON_METADATA_KWARGS,
  PYTHON_DERIVE,
  PYTHON_DECLARE_STATIC,
  PYTHON_DECLARE_VAR,
} from './constants.js';
import {
  containsStaticCalls,
  parseStringExpression,
} from './parseStringExpression.js';
import { nodeToStrings } from './stringNode.js';
import { indexVars } from 'generaltranslation/internal';
import { randomUUID } from 'node:crypto';

export type RawTranslationCall = {
  source: string;
  id?: string;
  context?: string;
  maxChars?: number;
  staticId?: string;
  line: number;
  column: number;
};

/**
 * Extracts translation function calls from a Python AST.
 * Walks all `call` nodes and checks if they reference a tracked import.
 */
export async function extractCalls(
  rootNode: SyntaxNode,
  imports: ImportAlias[],
  filePath: string
): Promise<{
  calls: RawTranslationCall[];
  errors: string[];
  warnings: string[];
}> {
  const calls: RawTranslationCall[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Only track t/msg as translation functions (not derive/declare_static/declare_var)
  const trackedNames = new Set(
    imports
      .filter(
        (imp) =>
          imp.originalName !== PYTHON_DERIVE &&
          imp.originalName !== PYTHON_DECLARE_STATIC &&
          imp.originalName !== PYTHON_DECLARE_VAR
      )
      .map((imp) => imp.localName)
  );
  if (trackedNames.size === 0) return { calls, errors, warnings };

  await walkCalls(
    rootNode,
    trackedNames,
    imports,
    filePath,
    calls,
    errors,
    warnings
  );

  return { calls, errors, warnings };
}

async function walkCalls(
  node: SyntaxNode,
  trackedNames: Set<string>,
  imports: ImportAlias[],
  filePath: string,
  calls: RawTranslationCall[],
  errors: string[],
  warnings: string[]
): Promise<void> {
  if (node.type === 'call') {
    const funcNode = node.childForFieldName('function');
    if (
      funcNode &&
      funcNode.type === 'identifier' &&
      trackedNames.has(funcNode.text)
    ) {
      await processCall(node, imports, filePath, calls, errors, warnings);
    }
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child)
      await walkCalls(
        child,
        trackedNames,
        imports,
        filePath,
        calls,
        errors,
        warnings
      );
  }
}

async function processCall(
  callNode: SyntaxNode,
  imports: ImportAlias[],
  filePath: string,
  calls: RawTranslationCall[],
  errors: string[],
  _warnings: string[]
): Promise<void> {
  const argsNode = callNode.childForFieldName('arguments');
  if (!argsNode) {
    errors.push(`${locationStr(callNode)}: translation call has no arguments`);
    return;
  }

  // Find first positional argument (skip punctuation)
  let firstArg: SyntaxNode | null = null;
  for (let i = 0; i < argsNode.childCount; i++) {
    const child = argsNode.child(i);
    if (
      child &&
      child.type !== '(' &&
      child.type !== ')' &&
      child.type !== ',' &&
      child.type !== 'keyword_argument'
    ) {
      firstArg = child;
      break;
    }
  }

  if (!firstArg) {
    errors.push(
      `${locationStr(callNode)}: translation call has no positional argument`
    );
    return;
  }

  // Check if this expression contains declare_static/declare_var
  const hasStaticHelpers =
    (firstArg.type === 'string' &&
      isFString(firstArg) &&
      containsStaticCalls(firstArg, imports)) ||
    (firstArg.type === 'binary_operator' &&
      containsStaticCalls(firstArg, imports)) ||
    (firstArg.type === 'call' && containsStaticCalls(firstArg, imports)) ||
    (firstArg.type === 'parenthesized_expression' &&
      containsStaticCalls(firstArg, imports));

  if (hasStaticHelpers) {
    // Compound expression path: parse into StringNode tree
    const rootNode = callNode.tree?.rootNode;
    if (!rootNode) {
      errors.push(`${locationStr(callNode)}: could not access AST root`);
      return;
    }

    const stringNode = await parseStringExpression(firstArg, {
      rootNode,
      imports,
      filePath,
      errors,
    });

    if (!stringNode) return;

    const strings = nodeToStrings(stringNode).map(indexVars);
    if (strings.length === 0) {
      errors.push(`${locationStr(callNode)}: no string variants produced`);
      return;
    }

    const metadata = extractKwargs(argsNode, errors, callNode);
    const staticId = `static-temp-id-${randomUUID()}`;

    for (const source of strings) {
      calls.push({
        source,
        ...metadata,
        staticId,
        line: callNode.startPosition.row + 1,
        column: callNode.startPosition.column,
      });
    }
    return;
  }

  // Simple path: validate first argument is a plain string literal
  if (firstArg.type !== 'string') {
    if (firstArg.type === 'identifier') {
      errors.push(
        `${locationStr(callNode)}: translation call uses a variable "${firstArg.text}" instead of a string literal`
      );
    } else if (firstArg.type === 'concatenated_string') {
      errors.push(
        `${locationStr(callNode)}: translation call uses concatenated strings — use a single string literal`
      );
    } else {
      errors.push(
        `${locationStr(callNode)}: translation call first argument must be a string literal, got "${firstArg.type}"`
      );
    }
    return;
  }

  // Check for f-strings (without declare_static/declare_var)
  if (isFString(firstArg)) {
    errors.push(
      `${locationStr(callNode)}: translation call uses an f-string — use a plain string literal or derive()/declare_var()`
    );
    return;
  }

  const source = extractStringContent(firstArg);
  if (source === undefined) {
    errors.push(`${locationStr(callNode)}: could not extract string content`);
    return;
  }

  // Extract keyword arguments
  const metadata = extractKwargs(argsNode, errors, callNode);

  calls.push({
    source,
    ...metadata,
    line: callNode.startPosition.row + 1,
    column: callNode.startPosition.column,
  });
}

function extractKwargs(
  argsNode: SyntaxNode,
  errors: string[],
  callNode: SyntaxNode
): { id?: string; context?: string; maxChars?: number } {
  const result: { id?: string; context?: string; maxChars?: number } = {};

  for (let i = 0; i < argsNode.childCount; i++) {
    const child = argsNode.child(i);
    if (!child || child.type !== 'keyword_argument') continue;

    const nameNode = child.childForFieldName('name');
    const valueNode = child.childForFieldName('value');
    if (!nameNode || !valueNode) continue;

    const kwargName = nameNode.text;
    const metadataKey = (
      PYTHON_METADATA_KWARGS as Record<string, string | undefined>
    )[kwargName];
    if (!metadataKey) continue;

    if (metadataKey === 'maxChars') {
      if (valueNode.type === 'integer') {
        result.maxChars = parseInt(valueNode.text, 10);
      } else {
        errors.push(
          `${locationStr(callNode)}: _max_chars must be an integer literal`
        );
      }
    } else {
      if (valueNode.type === 'string' && !isFString(valueNode)) {
        const value = extractStringContent(valueNode);
        if (value !== undefined) {
          if (metadataKey === 'id') result.id = value;
          else if (metadataKey === 'context') result.context = value;
        }
      } else {
        errors.push(
          `${locationStr(callNode)}: _${metadataKey} must be a string literal`
        );
      }
    }
  }

  return result;
}

function isFString(stringNode: SyntaxNode): boolean {
  // Check if string_start begins with 'f' or 'F'
  for (let i = 0; i < stringNode.childCount; i++) {
    const child = stringNode.child(i);
    if (child && child.type === 'string_start') {
      return /^[fF]/.test(child.text);
    }
    // Also check for interpolation children (hallmark of f-strings)
    if (child && child.type === 'interpolation') {
      return true;
    }
  }
  return false;
}

function extractStringContent(stringNode: SyntaxNode): string | undefined {
  // Look for string_content child
  for (let i = 0; i < stringNode.childCount; i++) {
    const child = stringNode.child(i);
    if (child && child.type === 'string_content') {
      return child.text;
    }
  }

  // Empty string — no string_content child, but has string_start and string_end
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
