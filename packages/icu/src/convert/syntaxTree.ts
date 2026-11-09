import { createUnsupportedTreeFormatError } from '../errors/convertErrors';
import { parseDateTimeSkeletonOptions } from '../parser/skeleton';
import { printAST } from '../parser/printer';
import { canonicalStyle, toMessage } from '../tree/canonical';
import type {
  DateTimeNode,
  MessageBranches,
  MessageNode,
  MessageTree,
  NumberNode,
  PluralNode,
  SelectNode,
  TagNode,
} from '../tree/messageTree';
import { styleProblem } from '../tree/validateMessageTree';
import { messageNodes } from '../tree/walk';
import { printDateTimeSkeleton } from './skeleton';
import {
  SKELETON_TYPE,
  TYPE,
  type DateElement,
  type MessageFormatElement,
  type NumberElement,
  type PluralOrSelectOption,
  type TimeElement,
} from '../types-dir/ast';

type FormatElement = NumberElement | DateElement | TimeElement;
type FormatKind = (NumberNode | DateTimeNode)[1];
type StyleReader = (element: FormatElement, kind: FormatKind) => unknown;

/**
 * Converts the parser's syntax tree to a message tree node for node, in the
 * parsed order; `normalizeTree` gives the form keys are hashed from.
 * Locations are dropped. Throws for a format a tree cannot hold, such as a
 * number skeleton with digits: its options are formatting context.
 */
export function toMessageTree(ast: MessageFormatElement[]): MessageTree {
  return convert(ast, treeStyle);
}

/**
 * Converts the parser's syntax tree for formatting an ICU string: a format
 * keeps every Intl option its skeleton spells, which a message tree cannot
 * hold, and the formatter reads them like a tree's styles.
 */
export function toFormattingTree(ast: MessageFormatElement[]): MessageTree {
  // Plain text as one string takes the formatter's fast path.
  return toMessage(convert(ast, intlStyle));
}

function convert(
  ast: MessageFormatElement[],
  readStyle: StyleReader
): MessageNode[] {
  return ast.map((element) => toNode(element, readStyle));
}

function toNode(
  element: MessageFormatElement,
  readStyle: StyleReader
): MessageNode {
  switch (element.type) {
    case TYPE.literal:
      return element.value;
    case TYPE.pound:
      return 0;
    case TYPE.argument:
      return [element.value];
    case TYPE.number:
    case TYPE.date:
    case TYPE.time: {
      const kind =
        element.type === TYPE.number
          ? 'number'
          : element.type === TYPE.date
            ? 'date'
            : 'time';
      const style = readStyle(element, kind);
      return (
        style == null ? [element.value, kind] : [element.value, kind, style]
      ) as MessageNode;
    }
    case TYPE.select:
      return [element.value, 'select', toBranches(element.options, readStyle)];
    case TYPE.plural: {
      const kind =
        element.pluralType === 'ordinal' ? 'selectordinal' : 'plural';
      const branches = toBranches(element.options, readStyle);
      return element.offset
        ? [element.value, kind, branches, element.offset]
        : [element.value, kind, branches];
    }
    case TYPE.tag:
      return [element.value, 'tag', convert(element.children, readStyle)];
  }
}

/** The Intl options a skeleton spells, or the style name. */
function intlStyle(element: FormatElement): unknown {
  const style = element.style;
  if (style == null || typeof style === 'string') return style;
  return style.type === SKELETON_TYPE.dateTime
    ? // Parsed without a locale, `::j` would otherwise lose its hour.
      parseDateTimeSkeletonOptions(style.pattern, { localeHour: true })
    : style.parsedOptions;
}

/**
 * The style a tree holds: a style name, a number's `::unit/…`, or date and
 * time fields. An hour symbol is the hour; its cycle, from `h`, `H`, `K`,
 * `k`, `J` or a day period `a`, is formatting context and is dropped.
 */
function treeStyle(element: FormatElement, kind: FormatKind): unknown {
  let style: unknown;
  const skeleton = element.style;
  if (typeof skeleton === 'object' && skeleton?.type === SKELETON_TYPE.number) {
    const [token, ...rest] = skeleton.tokens;
    if (rest.length || token.stem !== 'unit' || token.options.length !== 1) {
      throw new Error(
        createUnsupportedTreeFormatError(
          printAST([element]),
          'a number skeleton can only be ::unit/<unit>; other number options are formatting context'
        )
      );
    }
    // Read like ICU4C, which takes the whole identifier, as in `unit/kilometer-per-hour`.
    style = { style: 'unit', unit: token.options[0] };
  } else {
    // The parser shows at most three fractional digits, as Intl does.
    if (
      typeof skeleton === 'object' &&
      skeleton?.type === SKELETON_TYPE.dateTime &&
      /S{4}/.test(skeleton.pattern.replace(/'[^']*'/g, ''))
    ) {
      throw new Error(
        createUnsupportedTreeFormatError(
          printAST([element]),
          'fractional seconds have at most three digits, SSS'
        )
      );
    }
    const options = intlStyle(element);
    if (options != null && typeof options === 'object') {
      const {
        hourCycle: _,
        hour12: __,
        ...fields
      } = options as Intl.DateTimeFormatOptions;
      style = canonicalStyle(fields);
    } else {
      style = options;
    }
  }
  const problem = styleProblem(kind, style);
  if (problem) {
    throw new Error(
      createUnsupportedTreeFormatError(printAST([element]), problem.message)
    );
  }
  return style;
}

function toBranches(
  options: Record<string, PluralOrSelectOption>,
  readStyle: StyleReader
): MessageBranches {
  // Object.fromEntries defines own properties, so a `__proto__` branch stays one.
  return Object.fromEntries(
    Object.keys(options).map((key) => [
      key,
      convert(options[key].value, readStyle),
    ])
  );
}

/**
 * Converts a message tree back to the parser's syntax tree. A tree holds only
 * what ICU spells, so nothing is lost; a style a tree cannot hold throws.
 */
export function fromMessageTree(tree: MessageTree): MessageFormatElement[] {
  return messageNodes(tree).map(fromNode);
}

function fromNode(node: MessageNode): MessageFormatElement {
  if (typeof node === 'string') return { type: TYPE.literal, value: node };
  if (node === 0) return { type: TYPE.pound };
  const value = node[0];
  switch (node[1]) {
    case undefined:
      return { type: TYPE.argument, value };
    case 'number':
    case 'date':
    case 'time': {
      const [, kind, style] = node as NumberNode | DateTimeNode;
      const problem = styleProblem(kind, style);
      if (problem) {
        throw new Error(
          createUnsupportedTreeFormatError(
            JSON.stringify(node),
            problem.message
          )
        );
      }
      if (kind === 'number') {
        return {
          type: TYPE.number,
          value,
          style:
            style == null || typeof style === 'string'
              ? (style ?? null)
              : {
                  type: SKELETON_TYPE.number,
                  tokens: [{ stem: 'unit', options: [style.unit] }],
                  parsedOptions: style,
                },
        };
      }
      const pattern =
        style == null || typeof style === 'string'
          ? undefined
          : printDateTimeSkeleton(style);
      return {
        type: kind === 'date' ? TYPE.date : TYPE.time,
        value,
        style: pattern
          ? {
              type: SKELETON_TYPE.dateTime,
              pattern,
              parsedOptions: style as Intl.DateTimeFormatOptions,
            }
          : typeof style === 'string'
            ? style
            : null,
      };
    }
    case 'select':
      return {
        type: TYPE.select,
        value,
        options: fromBranches((node as SelectNode)[2]),
      };
    case 'plural':
    case 'selectordinal': {
      // `switch (node[1])` does not narrow a tuple union.
      const [, kind, branches, offset = 0] = node as PluralNode;
      return {
        type: TYPE.plural,
        value,
        options: fromBranches(branches),
        offset,
        pluralType: kind === 'plural' ? 'cardinal' : 'ordinal',
      };
    }
    case 'tag':
      return {
        type: TYPE.tag,
        value,
        children: fromMessageTree((node as TagNode)[2]),
      };
  }
}

function fromBranches(
  branches: MessageBranches
): Record<string, PluralOrSelectOption> {
  const options: Record<string, PluralOrSelectOption> = Object.create(null);
  // A leading `offset` branch would read back as a plural's `offset:`.
  const keys = Object.keys(branches).sort(
    (a, b) => Number(a === 'offset') - Number(b === 'offset')
  );
  for (const key of keys) {
    options[key] = { value: fromMessageTree(branches[key]) };
  }
  return Object.setPrototypeOf(options, Object.prototype);
}
