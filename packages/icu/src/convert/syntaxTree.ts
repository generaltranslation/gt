import { createUnsupportedTreeFormatError } from '../errors/convertErrors';
import { toNumberSkeleton } from '../parser/numberSkeleton';
import { HOUR_CYCLES, parseDateTimeSkeletonOptions } from '../parser/skeleton';
import { printAST } from '../parser/printer';
import {
  DATE_TIME_STYLE_NAMES,
  NAMED_NUMBER_STYLES,
  type DateTimeStyleName,
  type MessageFormattingContext,
  type MessageTreeFormats,
} from '../settings/formatOptions';
import { sortRecord, toMessage } from '../tree/canonical';
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
import {
  forEachPlaceholder,
  isFormattedNode,
  messageNodes,
} from '../tree/walk';
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
 * spell, by variable. `normalizeTree` gives the form keys are hashed from. Locations
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
  return toMessage(convert(ast, parsedNode));
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
  return parseDateTimeSkeletonOptions(skeleton.pattern, true);
}

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
      // The app's own names first, as FormatJS reads them, then ICU's.
      options = own(styles.number, style) ?? own(NAMED_NUMBER_STYLES, style);
      if (!options) throw unknownStyle(style);
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
    return [
      node,
      scale === undefined ? context : sortRecord({ ...context, scale }),
    ];
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
  if (custom) {
    const { [intlStyle]: style, ...rest } = custom;
    return style === undefined ? rest : { ...rest, style };
  }
  return DATE_TIME_STYLES.has(name)
    ? { style: name as DateTimeStyleName }
    : undefined;
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

type FormatWriter = (node: FormattedNode) => FormatElement;

/** A formatted placeholder as the tree alone says it, without context. */
const plainFormat: FormatWriter = (node) => writeFormat(node, {})[0];

/**
 * Converts a message tree back to the parser's syntax tree. A tree holds only
 * what ICU spells, so nothing is lost; a style a tree cannot hold throws.
 */
export function fromMessageTree(tree: MessageTree): MessageFormatElement[] {
  return fromNodes(tree, plainFormat);
}

function fromNodes(
  tree: MessageTree,
  write: FormatWriter
): MessageFormatElement[] {
  return messageNodes(tree).map((node) => fromNode(node, write));
}

/**
 * Converts a message to the parser's syntax tree, with the formatting
 * context ICU can spell written into its formatted placeholders, and returns
 * the context that is left, by variable. `formats` is by variable, so a
 * variable whose placeholders would spell different parts of its context,
 * like a number and a percent with a currency display, writes none of it.
 */
export function fromMessage({
  tree,
  formats,
}: Message): [ast: MessageFormatElement[], rest: MessageTreeFormats] {
  const elements = new Map<FormattedNode, FormatElement>();
  const rest: ContextByVariable = new Map();
  const mixed = new Set<string>();
  forEachPlaceholder(tree, (node) => {
    if (!isFormattedNode(node)) return;
    const name = node[0];
    const context = own(formats, name);
    if (!context) return;
    const [element, left] = writeFormat(node, context);
    elements.set(node, element);
    const other = rest.get(name);
    if (other && JSON.stringify(other) !== JSON.stringify(left)) {
      mixed.add(name);
    }
    rest.set(name, left);
  });
  for (const name of mixed) rest.set(name, formats[name]);
  return [
    fromNodes(
      tree,
      (node) => (!mixed.has(node[0]) && elements.get(node)) || plainFormat(node)
    ),
    toFormats(rest),
  ];
}

/**
 * A formatted placeholder as a syntax-tree element, and the context it does
 * not spell. A number spells its context as skeleton tokens, like
 * `::currency/EUR .00`. A date or time with an hour field spells its hour
 * cycle as the hour's symbol, like `H`. With no context it is the node alone.
 */
function writeFormat(
  node: FormattedNode,
  context: MessageFormattingContext
): [element: FormatElement, left: MessageFormattingContext] {
  const value = node[0];
  if (node[1] === 'number') {
    const style = node[2];
    const skeleton = toNumberSkeleton({
      ...(typeof style === 'string' ? NAMED_NUMBER_STYLES[style] : style),
      ...context,
    });
    const left = without(context, skeleton.parsedOptions);
    // A style name alone says a style without context best.
    const named =
      typeof style !== 'object' &&
      Object.keys(left).length === Object.keys(context).length;
    return [
      { type: TYPE.number, value, style: named ? (style ?? null) : skeleton },
      left,
    ];
  }
  const style = node[2];
  const fields = typeof style === 'object' ? style : undefined;
  const hourCycle = 'hourCycle' in context ? context.hourCycle : undefined;
  const hour =
    fields?.hour === undefined
      ? undefined
      : Object.keys(HOUR_CYCLES).find(
          (symbol) => HOUR_CYCLES[symbol] === hourCycle
        );
  const pattern = fields && printDateTimeSkeleton(fields, hour);
  return [
    {
      type: node[1] === 'date' ? TYPE.date : TYPE.time,
      value,
      style:
        fields && pattern
          ? {
              type: SKELETON_TYPE.dateTime,
              pattern,
              parsedOptions: hour ? { ...fields, hourCycle } : fields,
            }
          : typeof style === 'string'
            ? style
            : null,
    },
    hour ? without(context, { hourCycle }) : context,
  ];
}

// A context's options are all optional, so a copy with fewer is one too.
function without<Context extends MessageFormattingContext>(
  context: Context,
  spelled: object
): Context {
  const written = new Map<string, unknown>(Object.entries(spelled));
  return Object.fromEntries(
    Object.entries(context).filter(
      ([key, option]) => written.get(key) !== option
    )
  ) as Context;
}

function fromNode(
  node: MessageNode,
  write: FormatWriter
): MessageFormatElement {
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
      return write(node);
    }
    case 'select':
      return {
        type: TYPE.select,
        value,
        options: fromBranches(node[2], write),
      };
    case 'plural':
    case 'selectordinal': {
      const [, kind, branches, offset = 0] = node;
      return {
        type: TYPE.plural,
        value,
        options: fromBranches(branches, write),
        offset,
        pluralType: kind === 'plural' ? 'cardinal' : 'ordinal',
      };
    }
    case 'tag':
      return {
        type: TYPE.tag,
        value,
        children: fromNodes(node[2], write),
      };
  }
}

function fromBranches(
  branches: MessageBranches,
  write: FormatWriter
): Record<string, PluralOrSelectOption> {
  const options: Record<string, PluralOrSelectOption> = Object.create(null);
  // A leading `offset` branch would read back as a plural's `offset:`.
  const keys = Object.keys(branches).sort(
    (a, b) => Number(a === 'offset') - Number(b === 'offset')
  );
  for (const key of keys) {
    options[key] = { value: fromNodes(branches[key], write) };
  }
  return Object.setPrototypeOf(options, Object.prototype);
}
