import { createUnsupportedTreeFormatError } from '../errors/convertErrors';
import { parseDateTimeSkeletonOptions } from '../parser/skeleton';
import { printAST } from '../parser/printer';
import {
  DATE_TIME_STYLE_NAMES,
  NAMED_NUMBER_STYLES,
  type DateTimeStyleName,
  type MessageFormattingContext,
} from '../settings/formatOptions';
import { sortRecord, toMessage } from '../tree/canonical';
import type {
  DateTimeNode,
  Message,
  MessageBranches,
  MessageNode,
  MessageTree,
  NumberNode,
  PluralNode,
  SelectNode,
  TagNode,
} from '../tree/messageTree';
import {
  addContext,
  toFormats,
  splitOptions,
  type DateTimeOptions,
  type ContextByVariable,
} from '../tree/splitOptions';
import { styleProblem } from '../tree/validateMessageTree';
import { messageNodes } from '../tree/walk';
import { printDateTimeSkeleton } from './skeleton';
import {
  SKELETON_TYPE,
  TYPE,
  type DateElement,
  type DateTimeSkeleton,
  type ExtendedNumberFormatOptions,
  type MessageFormatElement,
  type NumberElement,
  type PluralOrSelectOption,
  type TimeElement,
} from '../types-dir/ast';

const DATE_TIME_STYLES = new Set<string>(DATE_TIME_STYLE_NAMES);

type FormatElement = NumberElement | DateElement | TimeElement;
type FormatKind = (NumberNode | DateTimeNode)[1];
// A style as an ICU string spells it: a name, or the Intl options of a skeleton.
type IntlStyle =
  | string
  | ExtendedNumberFormatOptions
  | Intl.DateTimeFormatOptions
  | null
  | undefined;
type FormatReader = (element: FormatElement, kind: FormatKind) => MessageNode;

/**
 * An app's own style names by kind, in the shape of react-intl's `formats`
 * prop (not a message's `formats`, which is its formatting context):
 * `{ number: { EUR: { style: 'currency', currency: 'EUR' } } }`.
 */
export type NamedStyles = {
  number?: Readonly<Record<string, ExtendedNumberFormatOptions>>;
  date?: Readonly<Record<string, Intl.DateTimeFormatOptions>>;
  time?: Readonly<Record<string, Intl.DateTimeFormatOptions>>;
};

/**
 * Converts the parser's syntax tree to a message: its tree, node for node in
 * the parsed order, and the formatting context its formatted placeholders
 * spell, by variable. `normalizeMessageTree` gives the form keys are hashed from. Locations
 * are dropped. One variable formatted with two contexts throws, as does a
 * style name that is neither ICU's nor in `styles`.
 */
export function readMessage(
  ast: MessageFormatElement[],
  styles: NamedStyles
): Message {
  const contexts: ContextByVariable = new Map();
  const tree = convert(ast, (element, kind) => {
    const [node, context] = splitFormat(element, kind, styles);
    addContext(contexts, element.value, context);
    return node;
  });
  return { tree, formats: toFormats(contexts) };
}

/**
 * Converts the parser's syntax tree for formatting an ICU string: a formatted
 * placeholder keeps every Intl option its skeleton spells, which a message
 * tree cannot hold, and the formatter reads them like a tree's styles.
 */
export function toParsedTree(ast: MessageFormatElement[]): MessageTree {
  // Plain text as one string takes the formatter's fast path.
  return toMessage(convert(ast, parsedNode));
}

function convert(
  ast: MessageFormatElement[],
  readFormat: FormatReader
): MessageNode[] {
  return ast.map((element) => toNode(element, readFormat));
}

function toNode(
  element: MessageFormatElement,
  readFormat: FormatReader
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
      return readFormat(element, kind);
    }
    case TYPE.select:
      return [element.value, 'select', toBranches(element.options, readFormat)];
    case TYPE.plural: {
      const kind =
        element.pluralType === 'ordinal' ? 'selectordinal' : 'plural';
      const branches = toBranches(element.options, readFormat);
      return element.offset
        ? [element.value, kind, branches, element.offset]
        : [element.value, kind, branches];
    }
    case TYPE.tag:
      return [element.value, 'tag', convert(element.children, readFormat)];
  }
}

/**
 * A formatted placeholder for the formatter only: the style is the name, or
 * every Intl option the skeleton spells.
 */
function parsedNode(element: FormatElement, kind: FormatKind): MessageNode {
  const skeleton = element.style;
  const style: IntlStyle =
    skeleton == null || typeof skeleton === 'string'
      ? skeleton
      : skeleton.type === SKELETON_TYPE.dateTime
        ? dateTimeOptions(skeleton)
        : skeleton.parsedOptions;
  // Not a style a message tree holds; the formatter reads both kinds.
  return (
    style == null ? [element.value, kind] : [element.value, kind, style]
  ) as MessageNode;
}

// Parsed without a locale, `::j` would otherwise lose its hour.
function dateTimeOptions(
  skeleton: DateTimeSkeleton
): Intl.DateTimeFormatOptions {
  return parseDateTimeSkeletonOptions(skeleton.pattern, { localeHour: true });
}

// The parser shows at most three fractional digits, as Intl does.
const FOUR_FRACTIONAL_DIGITS = /S{4}/;

/**
 * A formatted placeholder split in two: its node, with the style a tree
 * holds, and the formatting context its string spells, like a currency,
 * digits or an hour cycle. `splitOptions` splits a tagged template's options the same way.
 */
function splitFormat(
  element: FormatElement,
  kind: FormatKind,
  styles: NamedStyles
): [node: NumberNode | DateTimeNode, context: MessageFormattingContext] {
  const fail = (reason: string) =>
    new Error(createUnsupportedTreeFormatError(printAST([element]), reason));
  const unknownStyle = (name: string) =>
    fail(
      `"${name}" is not a style name; pass the app's own style names as \`styles\``
    );
  if (element.type === TYPE.number) {
    const style = element.style;
    let options: ExtendedNumberFormatOptions | undefined;
    if (typeof style === 'string') {
      // As in FormatJS, the app's style of an ICU name is laid over ICU's.
      const builtIn = own(NAMED_NUMBER_STYLES, style);
      const custom = own(styles.number, style);
      if (!builtIn && !custom) throw unknownStyle(style);
      options = { ...builtIn, ...custom };
    } else {
      options = style?.parsedOptions;
    }
    // ICU's `scale/100` is no Intl option, so it is kept beside the context.
    const { scale, ...intlOptions } = options ?? {};
    const [node, context] = splitOptions(
      element.value,
      kind,
      intlOptions,
      fail
    );
    return [node, scale ? sortRecord({ ...context, scale }) : context];
  }
  const style = element.style;
  let options: DateTimeOptions | undefined;
  if (typeof style === 'string') {
    options = namedDateTimeStyle(
      own(element.type === TYPE.date ? styles.date : styles.time, style),
      element.type === TYPE.date ? 'dateStyle' : 'timeStyle',
      style
    );
    if (!options) throw unknownStyle(style);
  } else if (style) {
    if (FOUR_FRACTIONAL_DIGITS.test(style.pattern.replace(/'[^']*'/g, ''))) {
      throw fail('fractional seconds have at most three digits, SSS');
    }
    options = dateTimeOptions(style);
  }
  return splitOptions(element.value, kind, options ?? {}, fail);
}

/**
 * The options of a date or time style name. A message calls its style
 * `style`, so Intl's `dateStyle` or `timeStyle` in an app's own style is
 * read as that.
 */
function namedDateTimeStyle(
  custom: Intl.DateTimeFormatOptions | undefined,
  intlStyle: 'dateStyle' | 'timeStyle',
  name: string
): DateTimeOptions | undefined {
  const builtIn = DATE_TIME_STYLES.has(name)
    ? (name as DateTimeStyleName)
    : undefined;
  if (!custom) return builtIn && { style: builtIn };
  // As in FormatJS, the app's style of an ICU name is laid over ICU's.
  const { [intlStyle]: style = builtIn, ...rest } = custom;
  return style === undefined ? rest : { ...rest, style };
}

// A style name comes from the string, so an inherited key is not a style.
function own<T>(
  record: Readonly<Record<string, T>> | undefined,
  key: string
): T | undefined {
  return record && Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}

function toBranches(
  options: Record<string, PluralOrSelectOption>,
  readFormat: FormatReader
): MessageBranches {
  // Object.fromEntries defines own properties, so a `__proto__` branch stays one.
  return Object.fromEntries(
    Object.keys(options).map((key) => [
      key,
      convert(options[key].value, readFormat),
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
