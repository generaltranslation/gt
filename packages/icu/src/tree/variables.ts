import { compareKeys } from './canonical';
import type { DateTimeNode, MessageTree, NumberNode } from './messageTree';
import {
  forEachPlaceholder,
  isFormattedNode,
  type PlaceholderNode,
} from './walk';

/**
 * A variable is a name used as one kind of placeholder; a plural's offset
 * changes what `#` prints, so it is part of the identity too. Formats are
 * left out: a translation printed as ICU cannot express them, so they are
 * restored by variable.
 */
export function variableKey(node: PlaceholderNode): string {
  const kind = node[1] ?? 'argument';
  return JSON.stringify(
    kind === 'plural' || kind === 'selectordinal'
      ? [node[0], kind, node[3] ?? 0]
      : [node[0], kind]
  );
}

/** Intl options written in any key order are one format. */
export function formatKey(style: NumberNode[2] | DateTimeNode[2]): string {
  return JSON.stringify(
    style == null || typeof style === 'string'
      ? (style ?? null)
      : Object.entries(style).sort(([a], [b]) => compareKeys(a, b))
  );
}

/** The first use of each variable, keyed by `variableKey`. */
export function collectVariables(
  tree: MessageTree
): Map<string, PlaceholderNode> {
  const variables = new Map<string, PlaceholderNode>();
  forEachPlaceholder(tree, (node) => {
    const key = variableKey(node);
    if (!variables.has(key)) variables.set(key, node);
  });
  return variables;
}

/**
 * The name of a variable the tree formats two different ways, such as
 * `number(p, { style: 'percent' })` next to `number(p)`, or undefined.
 * Translations restore formats by variable, so such a tree cannot be
 * translated: the CLI skips it, and `icuToMessageTree` rejects it as a source.
 */
export function findConflictingFormat(tree: MessageTree): string | undefined {
  const formats = new Map<string, string>();
  let conflict: string | undefined;
  forEachPlaceholder(tree, (node) => {
    if (conflict !== undefined || !isFormattedNode(node)) return;
    const key = variableKey(node);
    const format = formatKey(node[2]);
    const first = formats.get(key);
    if (first === undefined) formats.set(key, format);
    else if (first !== format) conflict = node[0];
  });
  return conflict;
}
