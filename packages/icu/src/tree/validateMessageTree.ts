import {
  SKELETON_TYPE,
  TYPE,
  type MessageFormatElement,
} from '../types-dir/ast';

export type MessageTree = MessageFormatElement[];

export interface MessageTreeValidationOptions {
  /** Deepest allowed nesting of option values and tag children. Defaults to 64. */
  maxDepth?: number;
  /**
   * Most elements plus select/plural options allowed in the whole tree.
   * Defaults to 10,000.
   */
  maxElements?: number;
}

export interface MessageTreeValidationError {
  /** Keys and indexes from the root to the invalid value. */
  path: (string | number)[];
  message: string;
}

type Path = MessageTreeValidationError['path'];

interface WalkState {
  maxDepth: number;
  maxElements: number;
  elements: number;
}

const ELEMENT_TYPES: readonly unknown[] = Object.values(TYPE);

/**
 * Returns the first structural problem in an untrusted syntax tree, such as
 * catalog JSON, or `undefined` when it is a valid tree. Unknown keys are
 * allowed so newer trees still validate.
 */
export function validateMessageTree(
  value: unknown,
  { maxDepth = 64, maxElements = 10_000 }: MessageTreeValidationOptions = {}
): MessageTreeValidationError | undefined {
  return treeError(value, [], 0, { maxDepth, maxElements, elements: 0 });
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
    return { path, message: 'expected an array of elements' };
  }
  if (depth > state.maxDepth) {
    return { path, message: `nesting deeper than ${state.maxDepth} levels` };
  }
  for (let index = 0; index < value.length; index++) {
    if (++state.elements > state.maxElements) {
      return {
        path: [...path, index],
        message: budgetMessage(state),
      };
    }
    const error = elementError(value[index], [...path, index], depth, state);
    if (error) return error;
  }
  return undefined;
}

function elementError(
  element: unknown,
  path: Path,
  depth: number,
  state: WalkState
): MessageTreeValidationError | undefined {
  if (!isRecord(element)) return { path, message: 'expected an object' };
  const type = own(element, 'type');
  if (type === TYPE.pound) return undefined;
  if (!ELEMENT_TYPES.includes(type)) {
    return { path: [...path, 'type'], message: 'unknown element type' };
  }
  if (typeof own(element, 'value') !== 'string') {
    return { path: [...path, 'value'], message: 'expected a string' };
  }
  switch (type) {
    case TYPE.number:
      return styleError(element, path, SKELETON_TYPE.number);
    case TYPE.date:
    case TYPE.time:
      return styleError(element, path, SKELETON_TYPE.dateTime);
    case TYPE.select:
      return optionsError(element, path, depth, state);
    case TYPE.plural: {
      const offset = own(element, 'offset');
      if (typeof offset !== 'number' || !Number.isFinite(offset)) {
        return { path: [...path, 'offset'], message: 'expected a number' };
      }
      const pluralType = own(element, 'pluralType');
      if (pluralType !== 'cardinal' && pluralType !== 'ordinal') {
        return {
          path: [...path, 'pluralType'],
          message: 'expected "cardinal" or "ordinal"',
        };
      }
      return optionsError(element, path, depth, state);
    }
    case TYPE.tag:
      return treeError(
        own(element, 'children'),
        [...path, 'children'],
        depth + 1,
        state
      );
    default:
      return undefined;
  }
}

function styleError(
  element: Record<string, unknown>,
  elementPath: Path,
  skeletonType: SKELETON_TYPE
): MessageTreeValidationError | undefined {
  const style = own(element, 'style');
  const path = [...elementPath, 'style'];
  if (style == null || typeof style === 'string') return undefined;
  const isNumber = skeletonType === SKELETON_TYPE.number;
  if (!isRecord(style) || own(style, 'type') !== skeletonType) {
    return {
      path,
      message: `expected a string or a ${isNumber ? 'number' : 'date/time'} skeleton`,
    };
  }
  if (isNumber) {
    const error = tokensError(own(style, 'tokens'), [...path, 'tokens']);
    if (error) return error;
  } else if (typeof own(style, 'pattern') !== 'string') {
    return { path: [...path, 'pattern'], message: 'expected a string' };
  }
  // The formatter reads Intl options from every skeleton.
  const parsedOptions = own(style, 'parsedOptions');
  if (!isRecord(parsedOptions)) {
    return { path: [...path, 'parsedOptions'], message: 'expected an object' };
  }
  // Intl rejects its own options when formatting; `scale` is applied before
  // Intl sees the value, so a non-number would render "NaN".
  const scale = own(parsedOptions, 'scale');
  if (
    isNumber &&
    scale !== undefined &&
    (typeof scale !== 'number' || !Number.isFinite(scale))
  ) {
    return {
      path: [...path, 'parsedOptions', 'scale'],
      message: 'expected a finite number',
    };
  }
  return undefined;
}

function tokensError(
  tokens: unknown,
  path: Path
): MessageTreeValidationError | undefined {
  if (!Array.isArray(tokens)) return { path, message: 'expected an array' };
  for (let index = 0; index < tokens.length; index++) {
    const token: unknown = tokens[index];
    if (!isRecord(token)) {
      return { path: [...path, index], message: 'expected an object' };
    }
    if (typeof own(token, 'stem') !== 'string') {
      return { path: [...path, index, 'stem'], message: 'expected a string' };
    }
    const options = own(token, 'options');
    if (!Array.isArray(options)) {
      return {
        path: [...path, index, 'options'],
        message: 'expected an array',
      };
    }
    const optionIndex = options.findIndex(
      (option) => typeof option !== 'string'
    );
    if (optionIndex !== -1) {
      return {
        path: [...path, index, 'options', optionIndex],
        message: 'expected a string',
      };
    }
  }
  return undefined;
}

function optionsError(
  element: Record<string, unknown>,
  elementPath: Path,
  depth: number,
  state: WalkState
): MessageTreeValidationError | undefined {
  const options = own(element, 'options');
  const path = [...elementPath, 'options'];
  if (!isRecord(options)) return { path, message: 'expected an object' };
  const keys = Object.keys(options);
  // Options count toward the budget, so empty branches cannot bypass it.
  const remaining = state.maxElements - state.elements;
  if (keys.length > remaining) {
    return { path: [...path, keys[remaining]], message: budgetMessage(state) };
  }
  state.elements += keys.length;
  for (const key of keys) {
    const option = options[key];
    if (!isRecord(option)) {
      return { path: [...path, key], message: 'expected an object' };
    }
    const error = treeError(
      own(option, 'value'),
      [...path, key, 'value'],
      depth + 1,
      state
    );
    if (error) return error;
  }
  return undefined;
}

function budgetMessage(state: WalkState): string {
  return `more than ${state.maxElements} elements and options`;
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
