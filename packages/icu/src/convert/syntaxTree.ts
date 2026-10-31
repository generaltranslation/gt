import type {
  MessageBranches,
  MessageNode,
  MessageTree,
  PluralNode,
  SelectNode,
  TagNode,
} from '../tree/messageTree';
import { branchNodes } from '../tree/walk';
import { printDateTimeSkeleton, printNumberStyle } from './skeleton';
import { parseDateTimeSkeletonOptions } from '../parser/skeleton';
import {
  SKELETON_TYPE,
  TYPE,
  type ExtendedNumberFormatOptions,
  type MessageFormatElement,
  type PluralOrSelectOption,
} from '../types-dir/ast';

/**
 * Converts the parser's syntax tree to a message tree node for node, in the
 * parsed order; `canonicalTree` gives the form keys are hashed from.
 * Skeletons keep only the Intl options formatting reads, not their tokens or
 * pattern. Locations are dropped.
 */
export function toMessageTree(ast: MessageFormatElement[]): MessageTree {
  return ast.map(toNode);
}

function toNode(element: MessageFormatElement): MessageNode {
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
        element.style == null || typeof element.style === 'string'
          ? element.style
          : element.style.type === SKELETON_TYPE.dateTime
            ? // Parsed without a locale, `::j` would otherwise lose its hour.
              parseDateTimeSkeletonOptions(element.style.pattern, {
                localeHour: true,
              })
            : element.style.parsedOptions;
      return style == null
        ? [element.value, kind]
        : ([element.value, kind, style] as MessageNode);
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
      return [element.value, 'tag', toMessageTree(element.children)];
  }
}

function toBranches(
  options: Record<string, PluralOrSelectOption>
): MessageBranches {
  // Object.fromEntries defines own properties, so a `__proto__` branch stays one.
  return Object.fromEntries(
    Object.keys(options).map((key) => [key, toMessageTree(options[key].value)])
  );
}

/**
 * Converts a message tree back to the parser's syntax tree. Intl-option
 * styles become the named `percent` style or a standard ICU skeleton when one
 * reads back as the same options; others, such as `{ timeZone: 'UTC' }`, are
 * dropped.
 */
export function fromMessageTree(tree: MessageTree): MessageFormatElement[] {
  return tree.map(fromNode);
}

function fromNode(node: MessageNode): MessageFormatElement {
  if (typeof node === 'string') return { type: TYPE.literal, value: node };
  if (node === 0) return { type: TYPE.pound };
  const value = node[0];
  switch (node[1]) {
    case undefined:
      return { type: TYPE.argument, value };
    case 'number': {
      const style = node[2];
      const printed =
        style == null || typeof style === 'string'
          ? style
          : printNumberStyle(style);
      return {
        type: TYPE.number,
        value,
        style: Array.isArray(printed)
          ? {
              type: SKELETON_TYPE.number,
              tokens: printed,
              parsedOptions: style as ExtendedNumberFormatOptions,
            }
          : (printed ?? null),
      };
    }
    case 'date':
    case 'time': {
      const style = node[2];
      const pattern =
        style == null || typeof style === 'string'
          ? undefined
          : printDateTimeSkeleton(style);
      return {
        type: node[1] === 'date' ? TYPE.date : TYPE.time,
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
  for (const key of Object.keys(branches)) {
    const branch = branches[key];
    options[key] = { value: fromMessageTree(branchNodes(branch)) };
  }
  return Object.setPrototypeOf(options, Object.prototype);
}
