import type { MessageTree } from './messageTree';

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
    case 'time':
      return styleError(node[2], [...path, 2], node[1] === 'number');
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

function styleError(
  style: unknown,
  path: Path,
  isNumber: boolean
): MessageTreeValidationError | undefined {
  if (style == null || typeof style === 'string') return undefined;
  if (!isRecord(style)) {
    return { path, message: 'expected a style name or Intl options' };
  }
  // Intl rejects its own options when formatting; `scale` is applied before
  // Intl sees the value, so a non-number would render "NaN".
  const scale = own(style, 'scale');
  if (
    isNumber &&
    scale !== undefined &&
    (typeof scale !== 'number' || !Number.isFinite(scale))
  ) {
    return { path: [...path, 'scale'], message: 'expected a finite number' };
  }
  return undefined;
}

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
