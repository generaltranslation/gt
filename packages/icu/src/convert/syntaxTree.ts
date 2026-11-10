import { createUnsupportedTreeFormatError } from '../errors/convertErrors';
import { parseDateTimeSkeletonOptions } from '../parser/skeleton';
import { printAST } from '../parser/printer';
import {
  DATE_TIME_STYLE_NAMES,
  NAMED_NUMBER_STYLES,
  type DateTimeStyleName,
  type MessageFormattingContext,
} from '../settings/formatOptions';
import { sortRecord, toMessageTree } from '../tree/canonical';
import type {
  FormattedNode,
  Message,
  ParsedNode,
  ParsedTree,
  MessageBranches,
  MessageNode,
  MessageTree,
} from '../tree/messageTree';
import {
  addContext,
  toFormats,
  splitOptions,
  type DateTimeOptions,
  type ContextByVariable,
} from '../tree/splitOptions';
import { styleProblem } from '../tree/validateMessageTree';
import { messageTreeNodes } from '../tree/walk';
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
type FormatReader<Format> = (element: FormatElement) => Format;

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
  const tree = convert(ast, (element) => {
    const [node, context] = splitFormat(element, styles);
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
export function toParsedTree(ast: MessageFormatElement[]): ParsedTree {
  // Plain text as one string takes the formatter's fast path.
  return toMessageTree(convert(ast, parsedNode));
}

function convert<Format>(
  ast: MessageFormatElement[],
  readFormat: FormatReader<Format>
): MessageNode<Format>[] {
  return ast.map((element) => toNode(element, readFormat));
}

function toNode<Format>(
  element: MessageFormatElement,
  readFormat: FormatReader<Format>
): MessageNode<Format> {
  switch (element.type) {
    case TYPE.literal:
      return element.value;
    case TYPE.pound:
      return 0;
    case TYPE.argument:
      return [element.value];
    case TYPE.number:
    case TYPE.date:
    case TYPE.time:
      return readFormat(element);
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
function parsedNode(element: FormatElement): ParsedNode {
  if (element.type === TYPE.number) {
    const style = element.style ?? undefined;
    return [
      element.value,
      'number',
      typeof style === 'object' ? style.parsedOptions : style,
    ];
  }
  const style = element.style ?? undefined;
  return [
    element.value,
    element.type === TYPE.date ? 'date' : 'time',
    typeof style === 'object' ? dateTimeOptions(style) : style,
  ];
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
  styles: NamedStyles
): [node: FormattedNode, context: MessageFormattingContext] {
  const kind =
    element.type === TYPE.number
      ? 'number'
      : element.type === TYPE.date
        ? 'date'
        : 'time';
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

function toBranches<Format>(
  options: Record<string, PluralOrSelectOption>,
  readFormat: FormatReader<Format>
): MessageBranches<Format> {
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
  return messageTreeNodes(tree).map(fromNode);
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
      const problem = styleProblem(node[1], node[2]);
      if (problem) {
        throw new Error(
          createUnsupportedTreeFormatError(
            JSON.stringify(node),
            problem.message
          )
        );
      }
      if (node[1] === 'number') {
        const style = node[2];
        const unit = typeof style === 'object' ? style : undefined;
        return {
          type: TYPE.number,
          value,
          style: unit
            ? {
                type: SKELETON_TYPE.number,
                tokens: [{ stem: 'unit', options: [unit.unit] }],
                parsedOptions: unit,
              }
            : typeof style === 'string'
              ? style
              : null,
        };
      }
      const style = node[2];
      const fields = typeof style === 'object' ? style : undefined;
      const pattern = fields && printDateTimeSkeleton(fields);
      return {
        type: node[1] === 'date' ? TYPE.date : TYPE.time,
        value,
        style:
          fields && pattern
            ? { type: SKELETON_TYPE.dateTime, pattern, parsedOptions: fields }
            : typeof style === 'string'
              ? style
              : null,
      };
    }
    case 'select':
      return {
        type: TYPE.select,
        value,
        options: fromBranches(node[2]),
      };
    case 'plural':
    case 'selectordinal': {
      const [, kind, branches, offset = 0] = node;
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
        children: fromMessageTree(node[2]),
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
