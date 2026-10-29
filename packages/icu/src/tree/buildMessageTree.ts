import {
  SKELETON_TYPE,
  TYPE,
  type MessageFormatElement,
  type PluralOrSelectOption,
} from '../types-dir/ast';
import {
  createInvalidBranchKeyError,
  createInvalidVariableNameError,
  createPluralCountOutsidePluralError,
  createReservedVariablePrefixError,
} from '../errors/treeErrors';
import { isArgumentName } from '../settings/syntax';

// ===== Hole IR ===== //

/** Static text with interleaved holes, like a tagged template's arguments. */
export type MessageTreeFragment = {
  strings: readonly string[];
  holes: readonly MessageTreeHole[];
};

export type MessageTreeBranch = string | MessageTreeFragment;

/**
 * The variable a helper formats: its `name`, or for a value passed without
 * one, like `plural(count, ...)`, the `value`, which becomes the next `_gt_N`
 * argument like an anonymous hole.
 */
type HoleVariable = { name?: string; value?: unknown };

/**
 * Plain-data description of one template hole. Values never become part of
 * the tree, so the built tree depends only on the message's structure.
 */
export type MessageTreeHole =
  | { kind: 'argument'; name: string }
  /** A value without a name; it becomes the next `_gt_N` argument. */
  | { kind: 'anonymous'; value?: unknown }
  | ({ kind: 'number'; options?: Intl.NumberFormatOptions } & HoleVariable)
  | ({ kind: 'date'; options?: Intl.DateTimeFormatOptions } & HoleVariable)
  | ({
      kind: 'plural' | 'selectordinal' | 'select';
      branches: Readonly<Record<string, MessageTreeBranch | undefined>>;
    } & HoleVariable)
  | ({ kind: 'fragment' } & MessageTreeFragment)
  /** The count of the nearest plural or selectordinal, like ICU `#`. */
  | { kind: 'pound' };

// ===== Builder ===== //

type BuildContext = {
  values: [name: string, value: unknown][];
};

// Anonymous values are named `_gt_N`; user names must not collide.
const RESERVED_NAME_PREFIX = '_gt_';

export type BuiltMessageTree = {
  tree: MessageFormatElement[];
  /**
   * Values of anonymous holes, in tree order.
   */
  values: [name: string, value: unknown][];
};

/**
 * Builds a canonical ICU syntax tree from template strings and holes:
 * adjacent literals are merged and plural/select keys are sorted, so equal
 * messages produce equal tree JSON. Anonymous holes become `_gt_N`
 * arguments, numbered in tree order from 1. Their values are returned
 * separately because values are never part of the tree.
 */
export function buildMessageTree(
  strings: readonly string[],
  holes: readonly MessageTreeHole[]
): BuiltMessageTree {
  const context: BuildContext = { values: [] };
  const tree = build(strings, holes, context, false);
  return { tree, values: context.values };
}

// Intl options are written in any order, so sort them for equal tree JSON.
function sortKeys<T extends object>(options: T): T {
  return Object.fromEntries(
    Object.entries(options).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  ) as T;
}

function checkName(name: string): void {
  if (name.startsWith(RESERVED_NAME_PREFIX)) {
    throw new Error(
      createReservedVariablePrefixError(name, RESERVED_NAME_PREFIX)
    );
  }
  // The tree is printed as ICU for translation, so a name must parse back.
  if (!isArgumentName(name)) {
    throw new Error(createInvalidVariableNameError(name));
  }
}

// Every anonymous value adds one entry, so the count numbers the next one.
function addAnonymousValue(context: BuildContext, value: unknown): string {
  const name = `${RESERVED_NAME_PREFIX}${context.values.length + 1}`;
  context.values.push([name, value]);
  return name;
}

function build(
  strings: readonly string[],
  holes: readonly MessageTreeHole[],
  context: BuildContext,
  inPlural: boolean
): MessageFormatElement[] {
  const out: MessageFormatElement[] = [];
  // Template text is always literal, ICU syntax such as `#` and `{` included.
  strings.forEach((text, i) => {
    appendLiteral(out, text);
    if (i < holes.length) buildHole(out, holes[i], context, inPlural);
  });
  return out;
}

function appendLiteral(out: MessageFormatElement[], text: string): void {
  if (!text) return;
  const previous = out[out.length - 1];
  if (previous?.type === TYPE.literal) previous.value += text;
  else out.push({ type: TYPE.literal, value: text });
}

function buildHole(
  out: MessageFormatElement[],
  hole: MessageTreeHole,
  context: BuildContext,
  inPlural: boolean
): void {
  if ('name' in hole && hole.name !== undefined) checkName(hole.name);
  switch (hole.kind) {
    case 'argument':
      out.push({ type: TYPE.argument, value: hole.name });
      return;
    case 'anonymous':
      out.push({
        type: TYPE.argument,
        value: addAnonymousValue(context, hole.value),
      });
      return;
    case 'fragment':
      for (const element of build(
        hole.strings,
        hole.holes,
        context,
        inPlural
      )) {
        if (element.type === TYPE.literal) appendLiteral(out, element.value);
        else out.push(element);
      }
      return;
    case 'pound':
      // Like ICU, a nested select resets the count context.
      if (!inPlural) throw new Error(createPluralCountOutsidePluralError());
      out.push({ type: TYPE.pound });
      return;
    case 'number':
      out.push({
        type: TYPE.number,
        value: hole.name ?? addAnonymousValue(context, hole.value),
        ...(hole.options && {
          style: {
            type: SKELETON_TYPE.number,
            tokens: [],
            parsedOptions: sortKeys(hole.options),
          },
        }),
      });
      return;
    case 'date':
      out.push({
        type: TYPE.date,
        value: hole.name ?? addAnonymousValue(context, hole.value),
        ...(hole.options && {
          style: {
            type: SKELETON_TYPE.dateTime,
            pattern: '',
            parsedOptions: sortKeys(hole.options),
          },
        }),
      });
      return;
    case 'plural':
    case 'selectordinal':
    case 'select': {
      // Named before its branches, so numbering follows tree order.
      const name = hole.name ?? addAnonymousValue(context, hole.value);
      const isSelect = hole.kind === 'select';
      const branchInPlural = !isSelect;
      const keys = Object.keys(hole.branches).filter(
        (key) => hole.branches[key] != null
      );
      // Formatting needs `other`; exhaustive selects may omit it.
      if (!keys.includes('other')) keys.push('other');
      // Null prototype so a `__proto__` key stays an own option, as in parse().
      const options: Record<string, PluralOrSelectOption> = Object.create(null);
      for (const key of keys.sort()) {
        // Like names, keys must parse back; plurals also allow `=N` keys.
        if (!isArgumentName(key) && (isSelect || !/^=-?\d+$/.test(key))) {
          throw new Error(createInvalidBranchKeyError(key));
        }
        const branch = hole.branches[key];
        options[key] = {
          value:
            branch == null
              ? []
              : typeof branch === 'string'
                ? build([branch], [], context, branchInPlural)
                : build(branch.strings, branch.holes, context, branchInPlural),
        };
      }
      Object.setPrototypeOf(options, Object.prototype);
      out.push(
        isSelect
          ? { type: TYPE.select, value: name, options }
          : {
              type: TYPE.plural,
              value: name,
              options,
              offset: 0,
              pluralType: hole.kind === 'plural' ? 'cardinal' : 'ordinal',
            }
      );
    }
  }
}
