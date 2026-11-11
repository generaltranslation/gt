import type { ElementContext, SourceRange } from '../analysis/types.js';
import { escapeRegExp } from '../utils/regexp.js';

/** An attribute's name as written (`:title`, `@click`, `{...}`) and the range of its value. */
export type SourceAttribute = { name: string; start: number; end: number };

/** An element of a component's markup, from the framework's own parser. */
export type SourceElement = {
  /** As written, e.g. "button", "ParaglideMessage", "paraglide-message". */
  name: string;
  /**
   * Right after the tag name: a component tag's own usage (`<ParaglideMessage />`)
   * is in its parent element. Attributes and children are inside.
   */
  start: number;
  end: number;
  nameStart: number;
  nameEnd: number;
  /** Right after the opening tag's `>`; in formats without one (pug), after its attributes. */
  openEnd: number;
  component: boolean;
  /** A value-less attribute (Svelte's `{...props}`) has the range of the whole attribute. */
  attributes: readonly SourceAttribute[];
};

export const SPREAD_ATTRIBUTE = '{...}';

// Room for `</`, `>` and whitespace around the name.
const CLOSING_TAG_PADDING = 16;

/** The element and attribute a source offset is in; undefined outside elements. */
export function elementContextAt(
  elements: readonly SourceElement[],
  offset: number
): ElementContext | undefined {
  const element = innermostAt(elements, offset);
  if (!element) return undefined;

  const attribute = element.attributes.find((candidate) =>
    containsOffset(candidate, offset)
  );
  if (!attribute) return { element: element.name };

  return { element: element.name, attribute: attribute.name };
}

/** The component whose tag name is `[start, end)`, e.g. `Card` in `<Card />`. */
export function componentTagAt(
  elements: readonly SourceElement[],
  start: number,
  end: number
): SourceElement | undefined {
  return elements.find(
    (element) =>
      element.component &&
      element.nameStart === start &&
      element.nameEnd === end
  );
}

export function containsOffset(range: SourceRange, offset: number): boolean {
  return range.start <= offset && offset < range.end;
}

/** The smallest range around `offset`; of equally small ones, the last. */
export function innermostAt<Range extends SourceRange>(
  ranges: readonly Range[],
  offset: number
): Range | undefined {
  let innermost: Range | undefined;

  for (const range of ranges) {
    if (!containsOffset(range, offset)) continue;

    const isSmallestSoFar =
      !innermost || range.end - range.start <= innermost.end - innermost.start;
    if (isSmallestSoFar) innermost = range;
  }

  return innermost;
}

export function openingTagEnd(
  source: string,
  nameEnd: number,
  attributeEnds: readonly number[] = []
): number {
  const lastAttributeEnd = Math.max(nameEnd, ...attributeEnds);
  const closingBracket = source.indexOf('>', lastAttributeEnd);

  return closingBracket === -1 ? lastAttributeEnd : closingBracket + 1;
}

/**
 * The name in each closing tag (`Card` in `</Card>`). Language tools write it
 * as code too, for go-to-definition and rename; only the opening tag is a usage.
 */
export function closingTagNames(
  elements: readonly SourceElement[],
  source: string
): SourceRange[] {
  const names: SourceRange[] = [];

  for (const element of elements) {
    const name = closingTagName(element, source);
    if (name) names.push(name);
  }

  return names;
}

function closingTagName(
  { name, end }: SourceElement,
  source: string
): SourceRange | undefined {
  const tailStart = Math.max(0, end - name.length - CLOSING_TAG_PADDING);
  const tail = source.slice(tailStart, end);

  const closingTag = new RegExp(`</\\s*${escapeRegExp(name)}\\s*>$`).exec(tail);
  if (!closingTag) return undefined;

  const tagStart = end - tail.length + closingTag.index;
  const start = tagStart + closingTag[0].indexOf(name, '</'.length);

  return { start, end: start + name.length };
}
