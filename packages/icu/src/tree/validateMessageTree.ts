import { DATE_TIME_FIELD_SYMBOLS } from '../convert/skeleton';
import {
  DATE_FIELD_OPTIONS,
  DATE_TIME_CONTEXT_OPTIONS,
  DATE_TIME_STYLE_NAMES,
  NUMBER_CONTEXT_OPTIONS,
  NUMBER_MESSAGE_OPTIONS,
  NUMBER_STYLE_NAMES,
  TIME_FIELD_OPTIONS,
} from '../settings/formatOptions';
import type { DateTimeNode, MessageTree, NumberNode } from './messageTree';

export interface MessageTreeValidationOptions {
  /** Deepest allowed nesting of branches and tag children. Defaults to 64. */
  maxDepth?: number;
  /**
   * Most nodes plus select/plural branches allowed in the whole tree.
   * Defaults to 10,000.
   */
  maxNodes?: number;
}

export interface MessageTreeValidationError {
  /** Keys and indexes from the root to the invalid value. */
  path: (string | number)[];
  message: string;
}

type Path = MessageTreeValidationError['path'];

interface WalkState {
  maxDepth: number;
  maxNodes: number;
  nodes: number;
}

/**
 * Returns the first structural problem in an untrusted message tree, such as
 * catalog JSON, or `undefined` when it is a valid tree. Entries past a
 * placeholder's known ones are allowed so newer trees still validate.
 */
export function validateMessageTree(
  value: unknown,
  { maxDepth = 64, maxNodes = 10_000 }: MessageTreeValidationOptions = {}
): MessageTreeValidationError | undefined {
  return treeError(value, [], 0, { maxDepth, maxNodes, nodes: 0 });
}

export function isMessageTree(
  value: unknown,
  options?: MessageTreeValidationOptions
): value is MessageTree {
  return validateMessageTree(value, options) === undefined;
}

function treeError(
  value: unknown,
  path: Path,
  depth: number,
  state: WalkState
): MessageTreeValidationError | undefined {
  if (!Array.isArray(value)) {
    return { path, message: 'expected an array of nodes' };
  }
  if (depth > state.maxDepth) {
    return { path, message: `nesting deeper than ${state.maxDepth} levels` };
  }
  for (let index = 0; index < value.length; index++) {
    if (++state.nodes > state.maxNodes) {
      return { path: [...path, index], message: budgetMessage(state) };
    }
    const error = nodeError(value[index], [...path, index], depth, state);
    if (error) return error;
  }
  return undefined;
}

function nodeError(
  node: unknown,
  path: Path,
  depth: number,
  state: WalkState
): MessageTreeValidationError | undefined {
  if (typeof node === 'string' || node === 0) return undefined;
  if (!Array.isArray(node)) {
    return { path, message: 'expected text, 0, or a placeholder array' };
  }
  if (typeof node[0] !== 'string') {
    return { path: [...path, 0], message: 'expected a variable name' };
  }
  if (node.length === 1) return undefined;
  switch (node[1]) {
    case 'number':
    case 'date':
    case 'time': {
      const problem = styleProblem(node[1], node[2]);
      if (!problem) return undefined;
      const stylePath = [...path, 2];
      if (problem.key !== undefined) stylePath.push(problem.key);
      return { path: stylePath, message: problem.message };
    }
    case 'select':
      return branchesError(node[2], [...path, 2], depth, state);
    case 'plural':
    case 'selectordinal': {
      const offset: unknown = node[3];
      if (
        offset !== undefined &&
        (typeof offset !== 'number' || !Number.isFinite(offset))
      ) {
        return { path: [...path, 3], message: 'expected a finite number' };
      }
      return branchesError(node[2], [...path, 2], depth, state);
    }
    case 'tag':
      return treeError(node[2], [...path, 2], depth + 1, state);
    default:
      return { path: [...path, 1], message: 'unknown placeholder kind' };
  }
}

type FormattedKind = (NumberNode | DateTimeNode)[1];

/**
 * Why `style` is not a style a tree holds for a `kind` placeholder, and the
 * option at fault, or undefined. A tree holds only what ICU spells, so
 * formatting context such as a currency or `timeZone` is rejected.
 */
export function styleProblem(
  kind: FormattedKind,
  style: unknown
): { key?: string; message: string } | undefined {
  if (style == null) return undefined;
  if (typeof style === 'string') {
    const names: readonly string[] =
      kind === 'number' ? NUMBER_STYLE_NAMES : DATE_TIME_STYLE_NAMES;
    return names.includes(style)
      ? undefined
      : { message: `expected a style name: ${names.join(', ')}` };
  }
  if (!isRecord(style)) {
    return { message: 'expected a style name or Intl options' };
  }
  // `{}` would print and read back as no style, which formats differently.
  if (!Object.keys(style).length) {
    return { message: 'expected options; leave out an empty style' };
  }
  const contextOptions: readonly string[] =
    kind === 'number' ? NUMBER_CONTEXT_OPTIONS : DATE_TIME_CONTEXT_OPTIONS;
  const fields: readonly string[] =
    kind === 'number'
      ? NUMBER_MESSAGE_OPTIONS
      : kind === 'date'
        ? DATE_FIELD_OPTIONS
        : TIME_FIELD_OPTIONS;
  for (const key of Object.keys(style)) {
    if (fields.includes(key)) continue;
    const message = contextOptions.includes(key)
      ? `"${key}" is formatting context, which a message tree does not hold`
      : key === `${kind}Style`
        ? `"${key}" is written as a style name, like "medium"`
        : `a ${kind} has no "${key}" option`;
    return { key, message };
  }
  if (kind === 'number') {
    if (own(style, 'style') !== 'unit') {
      return { key: 'style', message: 'expected "unit"' };
    }
    const unit = own(style, 'unit');
    return typeof unit === 'string' && UNIT_IDENTIFIER.test(unit)
      ? undefined
      : { key: 'unit', message: 'expected a unit such as "kilometer"' };
  }
  for (const key of Object.keys(style)) {
    const symbols: Record<string, string> =
      DATE_TIME_FIELD_SYMBOLS[key as keyof typeof DATE_TIME_FIELD_SYMBOLS];
    const value = own(style, key);
    const type = key === 'fractionalSecondDigits' ? 'number' : 'string';
    if (typeof value !== type || !own(symbols, String(value))) {
      return {
        key,
        message: `expected one of: ${Object.keys(symbols).join(', ')}`,
      };
    }
  }
  return undefined;
}

// Intl's unit identifiers, like `kilometer-per-hour`; printed in `::unit/…`.
const UNIT_IDENTIFIER = /^[a-z]+(?:-[a-z]+)*$/;

function branchesError(
  branches: unknown,
  path: Path,
  depth: number,
  state: WalkState
): MessageTreeValidationError | undefined {
  if (!isRecord(branches)) return { path, message: 'expected an object' };
  const keys = Object.keys(branches);
  // Branches count toward the budget, so empty branches cannot bypass it.
  const remaining = state.maxNodes - state.nodes;
  if (keys.length > remaining) {
    return { path: [...path, keys[remaining]], message: budgetMessage(state) };
  }
  state.nodes += keys.length;
  for (const key of keys) {
    const branch = branches[key];
    if (typeof branch === 'string') continue;
    const error = treeError(branch, [...path, key], depth + 1, state);
    if (error) return error;
  }
  return undefined;
}

function budgetMessage(state: WalkState): string {
  return `more than ${state.maxNodes} nodes and branches`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Own properties only, so a polluted Object.prototype cannot fill in fields.
function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}
