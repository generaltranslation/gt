import type {
  DateFieldOptions,
  DateTimeStyleName,
  NumberStyleName,
  TimeFieldOptions,
} from '../settings/formatOptions';

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
 * `messageTreeToIcu` and `icuToMessageTree` from
 * `@generaltranslation/icu/convert`. Other Intl options, like a currency or
 * a time zone, are formatting context, passed to `formatMessageTree` as
 * `formats`.
 */
export type MessageTree = string | MessageNode[];

export type MessageNode =
  | string
  | PoundNode
  | ArgumentNode
  | NumberNode
  | DateTimeNode
  | SelectNode
  | PluralNode
  | TagNode;

/** The count of the nearest plural or selectordinal, ICU `#`. */
export type PoundNode = 0;

/** `{name}` */
export type ArgumentNode = readonly [name: string];

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

export type SelectNode = readonly [
  name: string,
  kind: 'select',
  branches: MessageBranches,
];

/** `offset` is omitted when it is 0. */
export type PluralNode = readonly [
  name: string,
  kind: 'plural' | 'selectordinal',
  branches: MessageBranches,
  offset?: number,
];

/** `<name>children</name>`, formatted by the function passed as `name`. */
export type TagNode = readonly [
  name: string,
  kind: 'tag',
  children: MessageTree,
];

export type MessageBranches = Record<string, MessageTree>;
