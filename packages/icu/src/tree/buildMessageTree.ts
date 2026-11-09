import {
  createConflictingFormatsError,
  createInvalidBranchKeyError,
  createInvalidFormatOptionError,
  createInvalidVariableNameError,
  createPluralCountOutsidePluralError,
  createReservedVariablePrefixError,
} from '../errors/treeErrors';
import {
  DATE_MESSAGE_OPTIONS,
  DATE_TIME_CONTEXT_OPTIONS,
  NUMBER_CONTEXT_OPTIONS,
  NUMBER_MESSAGE_OPTIONS,
  TIME_MESSAGE_OPTIONS,
  type MessageFormattingContext,
  type MessageTreeFormats,
} from '../settings/formatOptions';
import { FALLBACK_BRANCH_KEY, isArgumentName } from '../settings/syntax';
import {
  appendText,
  canonicalStyle,
  compareKeys,
  sortRecord,
  toMessage,
} from './canonical';
import type {
  DateTimeNode,
  MessageBranches,
  MessageNode,
  MessageTree,
  NumberNode,
  PluralNode,
  SelectNode,
} from './messageTree';
import { styleProblem } from './validateMessageTree';

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

/** Kinds whose value picks one of several branches. */
export type MessageTreeChoiceKind = (PluralNode | SelectNode)[1];

/**
 * Plain-data description of one template hole. Values never become part of
 * the tree, so the built tree depends only on the message's structure. A
 * format's `options` are all its Intl options; the builder keeps the message
 * options in the tree and returns the formatting context in `formats`.
 */
export type MessageTreeHole =
  | { kind: 'argument'; name: string }
  /** A value without a name; it becomes the next `_gt_N` argument. */
  | { kind: 'anonymous'; value?: unknown }
  | ({ kind: NumberNode[1]; options?: Intl.NumberFormatOptions } & HoleVariable)
  | ({
      kind: DateTimeNode[1];
      options?: Intl.DateTimeFormatOptions;
    } & HoleVariable)
  | ({
      kind: MessageTreeChoiceKind;
      branches: Readonly<Record<string, MessageTreeBranch | undefined>>;
    } & HoleVariable)
  | ({ kind: 'fragment' } & MessageTreeFragment)
  /** The count of the nearest plural or selectordinal, like ICU `#`. */
  | { kind: 'pound' };

// ===== Builder ===== //

type BuildContext = {
  values: [name: string, value: unknown][];
  /** Each formatted variable's context, empty included, to find conflicts. */
  formats: Map<string, MessageFormattingContext>;
};

// Anonymous values are named `_gt_N`; user names must not collide.
export const RESERVED_NAME_PREFIX = '_gt_';

export type BuiltMessageTree = {
  tree: MessageTree;
  /**
   * Values of anonymous holes, in tree order.
   */
  values: [name: string, value: unknown][];
  /** The formatting context of each formatted variable that has one. */
  formats: MessageTreeFormats;
};

/**
 * Builds a canonical message tree from template strings and holes: adjacent
 * text is merged, a message or branch without placeholders is one string, and
 * plural/select keys and Intl options are sorted, so equal messages produce
 * equal tree JSON. Anonymous holes become `_gt_N`
 * arguments, numbered in tree order from 1. Their values are returned
 * separately because values are never part of the tree, and so is each
 * variable's formatting context: one variable formatted with two contexts
 * throws.
 */
export function buildMessageTree(
  strings: readonly string[],
  holes: readonly MessageTreeHole[]
): BuiltMessageTree {
  const context: BuildContext = { values: [], formats: new Map() };
  const tree = toMessage(build(strings, holes, context, false));
  const formats = Object.fromEntries(
    [...context.formats].filter(([, options]) => Object.keys(options).length)
  );
  return { tree, values: context.values, formats };
}

function validateName(name: string): void {
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
  if ('name' in hole && hole.name !== undefined) validateName(hole.name);
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
    case 'date':
    case 'time': {
      const name = hole.name ?? addAnonymousValue(context, hole.value);
      const [style, formatting] = splitOptions(name, hole.kind, hole.options);
      const bound = context.formats.get(name);
      if (bound && JSON.stringify(bound) !== JSON.stringify(formatting)) {
        throw new Error(createConflictingFormatsError(name));
      }
      context.formats.set(name, formatting);
      out.push(
        (style === undefined
          ? [name, hole.kind]
          : [name, hole.kind, style]) as MessageNode
      );
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
      if (!keys.includes(FALLBACK_BRANCH_KEY)) keys.push(FALLBACK_BRANCH_KEY);
      // Null prototype so a `__proto__` key stays an own branch, as in parse().
      const branches: MessageBranches = Object.create(null);
      for (const key of keys.sort(compareKeys)) {
        // Like names, keys must parse back; plurals also allow `=N` keys.
        if (!isArgumentName(key) && (isSelect || !isExactKey(key))) {
          throw new Error(createInvalidBranchKeyError(key));
        }
        const branch = hole.branches[key];
        branches[key] = toMessage(
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

/**
 * Splits a format's Intl options into its tree style and its sorted
 * formatting context, by the option classification.
 */
function splitOptions(
  name: string,
  kind: (NumberNode | DateTimeNode)[1],
  options: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions = {}
): [style: unknown, formatting: MessageFormattingContext] {
  const messageKeys: readonly string[] =
    kind === 'number'
      ? NUMBER_MESSAGE_OPTIONS
      : kind === 'date'
        ? DATE_MESSAGE_OPTIONS
        : TIME_MESSAGE_OPTIONS;
  const contextKeys: readonly string[] =
    kind === 'number' ? NUMBER_CONTEXT_OPTIONS : DATE_TIME_CONTEXT_OPTIONS;
  const invalid = (reason: string) =>
    new Error(createInvalidFormatOptionError(name, kind, reason));
  const message: Record<string, unknown> = {};
  const formatting: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    // Intl reads an undefined option as an absent one.
    if (value === undefined) continue;
    if (messageKeys.includes(key)) message[key] = value;
    else if (contextKeys.includes(key)) formatting[key] = value;
    else throw invalid(`a ${kind} has no "${key}" option`);
  }

  let style: unknown;
  if (kind === 'number') {
    // Intl ignores `unit` without a unit style, so it would not be in the message.
    if (message.unit !== undefined && message.style !== 'unit') {
      throw invalid(`"unit" needs style: 'unit'`);
    }
    style =
      message.style === 'unit'
        ? { style: 'unit', unit: message.unit }
        : message.style === 'decimal'
          ? undefined
          : message.style;
  } else {
    const { dateStyle, timeStyle, ...fields } = message;
    const named = dateStyle ?? timeStyle;
    if (named !== undefined && Object.keys(fields).length) {
      // Intl throws a TypeError for this too.
      throw invalid(`a style name cannot be combined with fields`);
    }
    style = named ?? canonicalStyle(fields);
  }
  const problem = styleProblem(kind, style);
  if (problem) throw invalid(problem.message);
  return [style, sortRecord(formatting)];
}

// `=N` with N an integer the parser reads: it rejects unsafe integers.
function isExactKey(key: string): boolean {
  return /^=-?\d+$/.test(key) && Number.isSafeInteger(Number(key.slice(1)));
}
