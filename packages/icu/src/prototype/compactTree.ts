// PROTOTYPE (not exported from any entry): a compact wire shape for message
// trees, compared against the formatjs AST in prototypes/icu-tree-wire-and-hash.
import {
  SKELETON_TYPE,
  TYPE,
  type ExtendedNumberFormatOptions,
  type MessageFormatElement,
} from '../types-dir/ast';

/**
 * One node of a compact message tree.
 *
 * Text is a bare string and `#` is `0`, so the common case costs no wrapper:
 *
 *   'Hi {name}!'                     -> ['Hi ', ['name'], '!']
 *   '{n, plural, one {# item} other {# items}}'
 *                                    -> [['n', 'plural', { one: [0, ' item'], other: [0, ' items'] }]]
 *   '{price, number, ::currency/USD}'-> [['price', 'number', { style: 'currency', currency: 'USD' }]]
 *
 * A branch holding one piece of text is the bare string, matching how users
 * write branches (`{ other: 'everyone' }`).
 */
export type CompactNode =
  | string
  | 0
  | readonly [name: string]
  | readonly [
      name: string,
      kind: 'number',
      style?: CompactStyle<ExtendedNumberFormatOptions>,
    ]
  | readonly [
      name: string,
      kind: 'date' | 'time',
      style?: CompactStyle<Intl.DateTimeFormatOptions>,
    ]
  | readonly [name: string, kind: 'select', branches: CompactBranches]
  | readonly [
      name: string,
      kind: 'plural' | 'selectordinal',
      branches: CompactBranches,
      offset?: number,
    ]
  | readonly [name: string, kind: 'tag', children: CompactTree];

/** A named style such as `percent`, or the Intl options of a skeleton. */
export type CompactStyle<O> = string | O;
export type CompactBranches = Record<string, string | CompactTree>;
export type CompactTree = CompactNode[];

// `switch (node[1])` does not narrow a tuple union, so readers cast to these.
export type CompactBranchNode = readonly [
  string,
  string,
  CompactBranches,
  number?,
];
export type CompactTagNode = readonly [string, 'tag', CompactTree];

/** Converts a formatjs AST (with or without locations) to the compact shape. */
export function toCompact(elements: MessageFormatElement[]): CompactTree {
  return elements.map((element): CompactNode => {
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
        const style =
          element.style == null
            ? undefined
            : typeof element.style === 'string'
              ? element.style
              : element.style.parsedOptions;
        return (
          style === undefined
            ? [element.value, kind]
            : [element.value, kind, style]
        ) as CompactNode;
      }
      case TYPE.select:
        return [element.value, 'select', toBranches(element.options)];
      case TYPE.plural: {
        const kind =
          element.pluralType === 'ordinal' ? 'selectordinal' : 'plural';
        const branches = toBranches(element.options);
        return element.offset
          ? [element.value, kind, branches, element.offset]
          : [element.value, kind, branches];
      }
      case TYPE.tag:
        return [element.value, 'tag', toCompact(element.children)];
    }
  });
}

function toBranches(
  options: Record<string, { value: MessageFormatElement[] }>
): CompactBranches {
  // Null prototype so a `__proto__` key stays an own branch, as in buildMessageTree.
  const branches: CompactBranches = Object.create(null);
  for (const key of Object.keys(options)) {
    const value = toCompact(options[key].value);
    branches[key] =
      value.length === 1 && typeof value[0] === 'string' ? value[0] : value;
  }
  return Object.setPrototypeOf(branches, Object.prototype);
}

/**
 * Converts back to the formatjs AST, so the existing formatter can render a
 * compact tree ("decode on load"). Skeleton tokens and patterns are not kept:
 * the formatter only reads `parsedOptions`.
 */
export function fromCompact(tree: CompactTree): MessageFormatElement[] {
  return tree.map((node): MessageFormatElement => {
    if (typeof node === 'string') return { type: TYPE.literal, value: node };
    if (node === 0) return { type: TYPE.pound };
    const [value, kind] = node;
    switch (node[1]) {
      case undefined:
        return { type: TYPE.argument, value };
      case 'number': {
        const style = node[2];
        return {
          type: TYPE.number,
          value,
          style:
            style === undefined
              ? null
              : typeof style === 'string'
                ? style
                : {
                    type: SKELETON_TYPE.number,
                    tokens: [],
                    parsedOptions: style,
                  },
        };
      }
      case 'date':
      case 'time': {
        const style = node[2];
        return {
          type: kind === 'date' ? TYPE.date : TYPE.time,
          value,
          style:
            style === undefined
              ? null
              : typeof style === 'string'
                ? style
                : {
                    type: SKELETON_TYPE.dateTime,
                    pattern: '',
                    parsedOptions: style,
                  },
        } as MessageFormatElement;
      }
      case 'select':
        return {
          type: TYPE.select,
          value,
          options: fromBranches((node as CompactBranchNode)[2]),
        };
      case 'plural':
      case 'selectordinal':
        return {
          type: TYPE.plural,
          value,
          options: fromBranches((node as CompactBranchNode)[2]),
          offset: (node as CompactBranchNode)[3] ?? 0,
          pluralType: node[1] === 'plural' ? 'cardinal' : 'ordinal',
        };
      case 'tag':
        return {
          type: TYPE.tag,
          value,
          children: fromCompact((node as CompactTagNode)[2]),
        };
    }
  });
}

function fromBranches(
  branches: CompactBranches
): Record<string, { value: MessageFormatElement[] }> {
  const options: Record<string, { value: MessageFormatElement[] }> =
    Object.create(null);
  for (const key of Object.keys(branches)) {
    const branch = branches[key];
    options[key] = {
      value: fromCompact(typeof branch === 'string' ? [branch] : branch),
    };
  }
  return Object.setPrototypeOf(options, Object.prototype);
}
