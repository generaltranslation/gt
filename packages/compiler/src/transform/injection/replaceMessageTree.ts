import { isMessageTree, type MessageTree } from '@generaltranslation/icu';
import { forEachPlaceholder } from '@generaltranslation/icu/internal';

/**
 * Whether a translation can be a replaced message's tree: a valid tree that
 * formats every set of values its source formats, since a replaced message
 * ships no source to fall back to. Each of its variables must be one the
 * source has, read as a kind the source reads it as:
 *
 * - `{name}` takes any value;
 * - a select needs the string a source select needs;
 * - a plural or selectordinal needs the number a source plural, selectordinal
 *   or number needs;
 * - a number, date or time must be written as the source writes it, style
 *   included, since the call site's formatting context is for that one.
 */
export function canReplaceMessageTree(
  source: MessageTree,
  translation: unknown
): translation is MessageTree {
  if (!isMessageTree(translation)) return false;
  const sourceKinds = new Map<string, Set<string>>();
  forEachPlaceholder(source, ([name, ...kind]) => {
    sourceKinds.set(
      name,
      (sourceKinds.get(name) ?? new Set()).add(toKind(kind))
    );
  });
  let can = true;
  forEachPlaceholder(translation, ([name, ...kind]) => {
    const kinds = sourceKinds.get(name);
    const translated = toKind(kind);
    can &&=
      kinds !== undefined &&
      (translated === PLAIN ||
        kinds.has(translated) ||
        (translated === COUNT && [...kinds].some(isNumber)));
  });
  return can;
}

const PLAIN = 'plain';
const SELECT = 'select';
const COUNT = 'count';

// What a variable must be for a node to format it; branches do not matter.
function toKind([kind, ...style]: unknown[]): string {
  if (kind === undefined) return PLAIN;
  if (kind === 'select') return SELECT;
  if (kind === 'plural' || kind === 'selectordinal') return COUNT;
  return JSON.stringify([kind, ...style]);
}

const isNumber = (kind: string) => kind.startsWith('["number"');
