import {
  createInvalidBranchKeyError,
  createInvalidVariableNameError,
  createPluralCountOutsidePluralError,
  createReservedVariablePrefixError,
} from '../errors/treeErrors';
import { isArgumentName } from '../settings/syntax';
import { appendText, canonicalStyle, compareKeys, toBranch } from './canonical';
import type { MessageBranches, MessageNode, MessageTree } from './messageTree';

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
  tree: MessageTree;
  /**
   * Values of anonymous holes, in tree order.
   */
  values: [name: string, value: unknown][];
};

/**
 * Builds a canonical message tree from template strings and holes: adjacent
 * text is merged, a branch without placeholders is one string, and
 * plural/select keys and Intl options are sorted, so equal messages produce
 * equal tree JSON. Anonymous holes become `_gt_N`
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
): MessageNode[] {
  const out: MessageNode[] = [];
  // Template text is always literal, ICU syntax such as `#` and `{` included.
  strings.forEach((text, i) => {
    appendText(out, text);
    if (i < holes.length) buildHole(out, holes[i], context, inPlural);
  });
  return out;
}

function buildHole(
  out: MessageNode[],
  hole: MessageTreeHole,
  context: BuildContext,
  inPlural: boolean
): void {
  if ('name' in hole && hole.name !== undefined) checkName(hole.name);
  switch (hole.kind) {
    case 'argument':
      out.push([hole.name]);
      return;
    case 'anonymous':
      out.push([addAnonymousValue(context, hole.value)]);
      return;
    case 'fragment':
      for (const node of build(hole.strings, hole.holes, context, inPlural)) {
        if (typeof node === 'string') appendText(out, node);
        else out.push(node);
      }
      return;
    case 'pound':
      // Like ICU, a nested select resets the count context.
      if (!inPlural) throw new Error(createPluralCountOutsidePluralError());
      out.push(0);
      return;
    case 'number':
    case 'date': {
      const name = hole.name ?? addAnonymousValue(context, hole.value);
      const style = canonicalStyle(hole.options, hole.kind);
      out.push(style ? [name, hole.kind, style] : [name, hole.kind]);
      return;
    }
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
      // Null prototype so a `__proto__` key stays an own branch, as in parse().
      const branches: MessageBranches = Object.create(null);
      for (const key of keys.sort(compareKeys)) {
        // Like names, keys must parse back; plurals also allow `=N` keys.
        if (!isArgumentName(key) && (isSelect || !isExactKey(key))) {
          throw new Error(createInvalidBranchKeyError(key));
        }
        const branch = hole.branches[key];
        branches[key] = toBranch(
          branch == null
            ? []
            : typeof branch === 'string'
              ? build([branch], [], context, branchInPlural)
              : build(branch.strings, branch.holes, context, branchInPlural)
        );
      }
      Object.setPrototypeOf(branches, Object.prototype);
      out.push([name, hole.kind, branches]);
    }
  }
}

// `=N` with N an integer the parser reads: it rejects unsafe integers.
function isExactKey(key: string): boolean {
  return /^=-?\d+$/.test(key) && Number.isSafeInteger(Number(key.slice(1)));
}
