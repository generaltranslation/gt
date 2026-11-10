import type {
  DateFieldOptions,
  DateTimeStyleName,
  MessageTreeFormats,
  NumberStyleName,
  TimeFieldOptions,
} from '../settings/formatOptions';
import type { ExtendedNumberFormatOptions } from '../types-dir/ast';

/**
 * A message as compact JSON, the form catalogs ship and keys are hashed from.
 * A message without placeholders is one string, `''` when empty; any other
 * is an array of nodes, where text is a bare string, `#` is `0`, and each
 * placeholder is a tuple that starts with its variable name:
 *
 *   'Save'                                      -> 'Save'
 *   'Hi {name}!'                                -> ['Hi ', ['name'], '!']
 *   '{n, plural, one {# item} other {# items}}' -> [['n', 'plural', { one: [0, ' item'], other: [0, ' items'] }]]
 *   '{role, select, admin {Admins} other {All}}'-> [['role', 'select', { admin: 'Admins', other: 'All' }]]
 *   '<b>bold</b> text'                          -> [['b', 'tag', 'bold'], ' text']
 *   '{price, number, currency}'                 -> [['price', 'number', 'currency']]
 *   '{due, date, ::yMMMd}'                      -> [['due', 'date', { day: 'numeric', month: 'short', year: 'numeric' }]]
 *
 * The same rule holds for a plural or select branch and a tag's children.
 * A string is iterable, so check for one before walking a tree's nodes, or
 * the walk visits characters. A tree holds only what ICU can spell,
 * so it converts to an ICU string and back without loss, with
 * `messageTreeToIcu` and `icuToMessage` from
 * `@generaltranslation/icu/convert`. Other Intl options, like a currency or
 * a time zone, are formatting context, passed to `formatMessageTree` as
 * `formats`.
 *
 * `Format` is the type of the number, date and time nodes, at every level.
 * Leave it out: a message tree holds `NumberNode` and `DateTimeNode`.
 */
export type MessageTree<Format = FormattedNode> =
  | string
  | MessageNode<Format>[];

/**
 * A message in full: its tree, which is what is translated and hashed, and
 * the formatting context of its formatted variables, which is neither.
 * Together they hold everything an ICU string can say.
 */
export type Message = {
  tree: MessageTree;
  /** The formatting context of each formatted variable that has one. */
  formats: MessageTreeFormats;
};

export type MessageNode<Format = FormattedNode> =
  | string
  | PoundNode
  | ArgumentNode
  | Format
  | SelectNode<Format>
  | PluralNode<Format>
  | TagNode<Format>;

/** The count of the nearest plural or selectordinal, ICU `#`. */
export type PoundNode = 0;

/**
 * `{name}`. It has no kind: `kind` is in the type so that `node[1]` tells
 * every node apart.
 */
export type ArgumentNode = readonly [name: string, kind?: undefined];

/** A node that formats its value: a number, a date or a time. */
export type FormattedNode = NumberNode | DateTimeNode;

/**
 * `{n, number}`, `{n, number, percent}`, `{n, number, currency}`, whose
 * currency is formatting context, or `{n, number, ::unit/kilometer}`.
 */
export type NumberNode = readonly [
  name: string,
  kind: 'number',
  style?: NumberStyleName | { style: 'unit'; unit: string },
];

/**
 * A named style, Intl `dateStyle` or `timeStyle`, or the fields of a
 * skeleton such as `::yMMMd`. A time has only time fields.
 */
export type DateTimeNode =
  | readonly [
      name: string,
      kind: 'date',
      style?: DateTimeStyleName | DateFieldOptions,
    ]
  | readonly [
      name: string,
      kind: 'time',
      style?: DateTimeStyleName | TimeFieldOptions,
    ];

export type SelectNode<Format = FormattedNode> = readonly [
  name: string,
  kind: 'select',
  branches: MessageBranches<Format>,
];

/** `offset` is omitted when it is 0. */
export type PluralNode<Format = FormattedNode> = readonly [
  name: string,
  kind: 'plural' | 'selectordinal',
  branches: MessageBranches<Format>,
  offset?: number,
];

/** `<name>children</name>`, formatted by the function passed as `name`. */
export type TagNode<Format = FormattedNode> = readonly [
  name: string,
  kind: 'tag',
  children: MessageTree<Format>,
];

export type MessageBranches<Format = FormattedNode> = Record<
  string,
  MessageTree<Format>
>;

/**
 * A number, date or time as the formatter reads it. A message tree's nodes
 * are these too. An ICU string's can also hold any style name and every Intl
 * option of a skeleton, which a message tree does not hold.
 */
export type ParsedNode =
  | readonly [
      name: string,
      kind: 'number',
      style?: string | ExtendedNumberFormatOptions,
    ]
  | readonly [
      name: string,
      kind: 'date' | 'time',
      style?: string | Intl.DateTimeFormatOptions,
    ];

/** What the formatter reads: a message tree, or an ICU string's syntax tree. */
export type ParsedTree = MessageTree<ParsedNode>;
