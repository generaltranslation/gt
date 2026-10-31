import type { ExtendedNumberFormatOptions } from '../types-dir/ast';

/**
 * A message as compact JSON, the form catalogs ship and keys are hashed from.
 * Text is a bare string, `#` is `0`, and each placeholder is a tuple that
 * starts with its variable name:
 *
 *   'Hi {name}!'                                -> ['Hi ', ['name'], '!']
 *   '{n, plural, one {# item} other {# items}}' -> [['n', 'plural', { one: [0, ' item'], other: [0, ' items'] }]]
 *   '{role, select, admin {Admins} other {All}}'-> [['role', 'select', { admin: 'Admins', other: 'All' }]]
 *   '{price, number, ::currency/USD}'           -> [['price', 'number', { currency: 'USD', style: 'currency' }]]
 *
 * A branch without placeholders is one string, so it reads like the branch
 * a developer wrote. ICU strings convert with `icuToMessageTree` and
 * `messageTreeToIcu` from `@generaltranslation/icu/convert`.
 */
export type MessageTree = MessageNode[];

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

/** A named ICU style such as `percent`, or the Intl options to format with. */
export type NumberNode = readonly [
  name: string,
  kind: 'number',
  style?: string | ExtendedNumberFormatOptions,
];

export type DateTimeNode = readonly [
  name: string,
  kind: 'date' | 'time',
  style?: string | Intl.DateTimeFormatOptions,
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
