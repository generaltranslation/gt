import type { SyntaxNode } from './parser.js';
import type { ImportAlias } from './extractImports.js';
import { PYTHON_METADATA_KWARGS } from './constants.js';

export type RawTranslationCall = {
  source: string;
  id?: string;
  context?: string;
  maxChars?: number;
  line: number;
  column: number;
};

/**
 * Extracts translation function calls from a Python AST.
 * Walks all `call` nodes and checks if they reference a tracked import.
 */
export function extractCalls(
  rootNode: SyntaxNode,
  imports: ImportAlias[]
): { calls: RawTranslationCall[]; errors: string[]; warnings: string[] } {
  const calls: RawTranslationCall[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const trackedNames = new Set(imports.map((imp) => imp.localName));
  if (trackedNames.size === 0) return { calls, errors, warnings };

  walkCalls(rootNode, trackedNames, calls, errors, warnings);

  return { calls, errors, warnings };
}

function walkCalls(
  node: SyntaxNode,
  trackedNames: Set<string>,
  calls: RawTranslationCall[],
  errors: string[],
  warnings: string[]
): void {
  if (node.type === 'call') {
    const funcNode = node.childForFieldName('function');
    if (funcNode && funcNode.type === 'identifier' && trackedNames.has(funcNode.text)) {
      processCall(node, calls, errors, warnings);
    }
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) walkCalls(child, trackedNames, calls, errors, warnings);
  }
}

function processCall(
  callNode: SyntaxNode,
  calls: RawTranslationCall[],
  errors: string[],
  warnings: string[]
): void {
  const argsNode = callNode.childForFieldName('arguments');
  if (!argsNode) {
    errors.push(
      `${locationStr(callNode)}: translation call has no arguments`
    );
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

  // Validate first argument is a string literal
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

  // Check for f-strings
  if (isFString(firstArg)) {
    errors.push(
      `${locationStr(callNode)}: translation call uses an f-string — use a plain string literal`
    );
    return;
  }

  const source = extractStringContent(firstArg);
  if (source === undefined) {
    errors.push(
      `${locationStr(callNode)}: could not extract string content`
    );
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
          `${locationStr(callNode)}: _maxChars must be an integer literal`
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
