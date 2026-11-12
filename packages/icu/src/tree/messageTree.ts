import type {
  DateFieldOptions,
  DateTimeStyleName,
  MessageFormats,
  NumberStyleName,
  TimeFieldOptions,
} from '../settings/formatOptions';

/**
 * A message as compact JSON, the form catalogs ship and keys are hashed from.
 * Text is a bare string, `#` is `0`, and each placeholder is a tuple that
 * starts with its variable name:
 *
 *   'Hi {name}!'                                -> ['Hi ', ['name'], '!']
 *   '{n, plural, one {# item} other {# items}}' -> [['n', 'plural', { one: [0, ' item'], other: [0, ' items'] }]]
 *   '{role, select, admin {Admins} other {All}}'-> [['role', 'select', { admin: 'Admins', other: 'All' }]]
 *   '{price, number, currency}'                 -> [['price', 'number', 'currency']]
 *   '{due, date, ::yMMMd}'                      -> [['due', 'date', { day: 'numeric', month: 'short', year: 'numeric' }]]
 *
 * A branch without placeholders is one string, so it reads like the branch
 * a developer wrote. A tree holds only what ICU can spell, so it converts to
 * an ICU string and back without loss, with `messageTreeToIcu` and
 * `icuToMessage` from `@generaltranslation/icu/convert`. Other Intl
 * options, like a currency or a time zone, are formatting context, passed to
 * `formatMessageTree` as `formats`.
 */
export type MessageTree = MessageNode[];

/**
 * A message in full: its tree, which is what is translated and hashed, and
 * the formatting context of its formatted variables, which is neither.
 * Together they hold everything an ICU string can say.
 */
export type Message = {
  tree: MessageTree;
  /** The formatting context of each formatted variable that has one. */
  formats: MessageFormats;
};

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

export type MessageBranches = Record<string, string | MessageTree>;
