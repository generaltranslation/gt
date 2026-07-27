/**
 * gt-next's dictionary read semantics, mirroring packages/i18n
 * dictionary-helpers: a non-leaf value throws the same "cannot be found" as an
 * absent key. Both the key audit and the source transform read it from here.
 */

/** How a key resolved against a catalog, from gt-next's point of view. */
export type DictionaryKeyResolution =
  /** reaches a value `t()` renders. */
  | { kind: 'renderable' }
  /** present, but `t()` throws on it; `leaf` describes what is there. */
  | { kind: 'unrenderable'; leaf: string }
  /** nothing at that path. */
  | { kind: 'missing' };

/**
 * True when gt-next's `t()` renders this value: a string, or the
 * `[message]` / `[message, options]` leaf tuple (DictionaryLeaf). A tuple of
 * two strings is not a leaf, so an i18next `["a", "b"]` throws.
 */
export function isRenderableLeaf(value: unknown): boolean {
  if (typeof value === 'string') return true;
  if (!Array.isArray(value) || typeof value[0] !== 'string') return false;
  if (value.length === 1) return true;
  return value.length === 2 && isLeafOptions(value[1]);
}

/** A value's shape as a TODO/skip reason names it ("an array (2 entries)"). */
export function describeDictionaryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `an array (${value.length} ${plural(value.length, 'entry', 'entries')})`;
  }
  if (value === null) return 'null';
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).length;
    return `a nested object (${keys} ${plural(keys, 'key', 'keys')})`;
  }
  return `a ${typeof value}`;
}

/** How `t(key)` would fare against this catalog. */
export function resolveDictionaryKey(
  catalog: unknown,
  key: string
): DictionaryKeyResolution {
  const candidates = dictionaryKeyCandidates(catalog, key);
  if (candidates.length === 0) return { kind: 'missing' };
  if (candidates.some(isRenderableLeaf)) return { kind: 'renderable' };
  return { kind: 'unrenderable', leaf: describeDictionaryValue(candidates[0]) };
}

/**
 * True when any value sits at this path, renderable or not. A container (a
 * namespace, a computed key's static prefix) is supposed to hold an object,
 * so testing renderability there would report every namespace as broken.
 */
export function dictionaryKeyExists(catalog: unknown, key: string): boolean {
  return dictionaryKeyCandidates(catalog, key).length > 0;
}

/**
 * Every value `key` could resolve to in this catalog: the nested path, plus a
 * flat dotted leaf at the root or inside a resolved prefix
 * (`{ UI: { 'a.b': … } }`). Shape only; the leaf test decides renderability.
 */
function dictionaryKeyCandidates(catalog: unknown, key: string): unknown[] {
  const found: unknown[] = [];
  if (!isDictionaryObject(catalog)) return found;
  const record = catalog as Record<string, unknown>;
  if (record[key] !== undefined) found.push(record[key]);

  const segments = key.split('.');
  let cursor: unknown = record;
  for (let index = 0; index < segments.length; index += 1) {
    // Arrays are not traversable: gt-next's walker rejects them at every
    // level, so `t('tips.0')` on `{ tips: ['a'] }` throws rather than
    // resolving the element.
    if (!isDictionaryObject(cursor)) return found;
    const level = cursor as Record<string, unknown>;
    if (index > 0) {
      const remainder = segments.slice(index).join('.');
      if (level[remainder] !== undefined) found.push(level[remainder]);
    }
    const next = level[segments[index]];
    if (next === undefined) return found;
    cursor = next;
  }
  found.push(cursor);
  return found;
}

/** gt-next's `isDictionaryValue`: a plain object, never an array. */
function isDictionaryObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** gt-next's DictionaryEntryOptions guard, for the `[message, options]` leaf. */
function isLeafOptions(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const options = value as Record<string, unknown>;
  return (
    (options.$context === undefined || typeof options.$context === 'string') &&
    (options.$format === undefined || isStringFormat(options.$format)) &&
    (options.$maxChars === undefined || typeof options.$maxChars === 'number')
  );
}

function isStringFormat(value: unknown): boolean {
  return value === 'ICU' || value === 'I18NEXT' || value === 'STRING';
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
