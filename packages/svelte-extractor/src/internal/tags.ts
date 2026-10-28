/** A `<script>` or `<style>` element found by {@link findSvelteTags}. */
export type SvelteTag = {
  name: string;
  /** Offset of the opening `<`. */
  start: number;
  /** Offset after the closing tag, or after `/>` when self-closing. */
  end: number;
  /** Offsets of the element's contents; absent when self-closing. */
  content?: { start: number; end: number };
};

/**
 * Finds the elements named `names` outside HTML comments, like the regular
 * expressions `svelte/compiler`'s preprocess uses to find `<script>` and
 * `<style>` elements, but in linear time. Unlike those expressions, an
 * unquoted attribute value cannot start with a quote.
 */
export function findSvelteTags(
  source: string,
  names: readonly string[]
): SvelteTag[] {
  const find = createSearch(source);
  const attributes = new Map<number, Attributes>();
  const tags: SvelteTag[] = [];
  let index = source.indexOf('<');
  while (index !== -1) {
    if (source.startsWith('<!--', index)) {
      const commentEnd = find('-->', index + '<!--'.length);
      if (commentEnd !== -1) {
        index = source.indexOf('<', commentEnd + '-->'.length);
        continue;
      }
    } else {
      const tag = matchTag(source, index, names, find, attributes);
      if (tag) {
        tags.push(tag);
        index = source.indexOf('<', tag.end);
        continue;
      }
    }
    index = source.indexOf('<', index + 1);
  }
  return tags;
}

type Search = (needle: string, from: number) => number;

/**
 * `source.indexOf()` that reuses earlier results, so searching from
 * increasing offsets for a needle that is missing or far away stays linear.
 */
function createSearch(source: string): Search {
  const found = new Map<string, { from: number; result: number }>();
  return (needle, from) => {
    const cached = found.get(needle);
    if (
      cached !== undefined &&
      cached.from <= from &&
      (cached.result === -1 || cached.result >= from)
    ) {
      return cached.result;
    }
    const result = source.indexOf(needle, from);
    found.set(needle, { from, result });
    return result;
  };
}

function isWhitespace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char);
}

/** Matches `[^=>'"/\s]`, a character of an attribute name. */
function isNameChar(char: string | undefined): boolean {
  return char !== undefined && !/[=>'"/\s]/.test(char);
}

type Attributes = {
  /** Offset after the attributes and the whitespace that follows them. */
  end: number;
  /** Offset of `/` when the last attribute is an unquoted value ending in it. */
  slash?: number;
} | null;

function matchTag(
  source: string,
  start: number,
  names: readonly string[],
  find: Search,
  attributes: Map<number, Attributes>
): SvelteTag | undefined {
  const name = names.find((candidate) =>
    source.startsWith(candidate, start + 1)
  );
  if (name === undefined) return undefined;
  const scanned = scanAttributes(source, start + 1 + name.length, attributes);
  if (scanned === null) return undefined;

  const { end, slash } = scanned;
  if (source.startsWith('/>', end)) {
    return { name, start, end: end + '/>'.length };
  }
  if (source[end] === '>') {
    const closingTag = `</${name}>`;
    const contentEnd = find(closingTag, end + 1);
    if (contentEnd !== -1) {
      return {
        name,
        start,
        end: contentEnd + closingTag.length,
        content: { start: end + 1, end: contentEnd },
      };
    }
    // Like the regular expression backtracking, `a=b/>` without a closing
    // tag ends a self-closing tag instead.
    if (slash === end - 1) return { name, start, end: end + 1 };
  }
  return undefined;
}

/**
 * Matches `(?:\s+[^=>'"/\s]+=VALUE|\s+[^=>'"/\s]+)*\s*` at `from`.
 *
 * A `<script` or `<style` inside the attributes of another tag continues
 * from the same offsets, so results are memoized by offset to keep
 * `<style <style <style ...` linear.
 */
function scanAttributes(
  source: string,
  from: number,
  memo: Map<number, Attributes>
): Attributes {
  const visited: number[] = [];
  let index = from;
  let slash: number | undefined;
  let result: Attributes | undefined;
  while (result === undefined) {
    result = memo.get(index);
    if (result !== undefined) break;
    visited.push(index);
    let next = index;
    while (isWhitespace(source[next])) next++;
    if (next === index || !isNameChar(source[next])) {
      result = { end: next, slash };
      break;
    }
    while (isNameChar(source[next])) next++;
    slash = undefined;
    if (source[next] === '=') {
      const value = matchAttributeValue(source, next + 1);
      if (value === undefined) {
        result = null;
        break;
      }
      if (value - next > 2 && source[value - 1] === '/') slash = value - 1;
      next = value;
    }
    index = next;
  }
  for (const offset of visited) memo.set(offset, result);
  return result;
}

/**
 * Matches `"[^"]*"`, `'[^']*'`, or an unquoted `[^>\s"'][^>\s]*` at `start`
 * and returns the offset after it.
 */
function matchAttributeValue(
  source: string,
  start: number
): number | undefined {
  const quote = source[start];
  if (quote === '"' || quote === "'") {
    const end = source.indexOf(quote, start + 1);
    return end === -1 ? undefined : end + 1;
  }
  let end = start;
  while (
    end < source.length &&
    source[end] !== '>' &&
    !isWhitespace(source[end])
  ) {
    end++;
  }
  return end === start ? undefined : end;
}
