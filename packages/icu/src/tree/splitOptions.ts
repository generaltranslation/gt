import { createConflictingFormatsError } from '../errors/treeErrors';
import {
  DATE_MESSAGE_OPTIONS,
  DATE_TIME_CONTEXT_OPTIONS,
  NUMBER_CONTEXT_OPTIONS,
  NUMBER_MESSAGE_OPTIONS,
  TIME_MESSAGE_OPTIONS,
  type DateMessageOptions,
  type DateTimeFormattingContext,
  type MessageFormattingContext,
  type MessageTreeFormats,
} from '../settings/formatOptions';
import { canonicalStyle, sortRecord } from './canonical';
import type { DateTimeNode, NumberNode } from './messageTree';
import { formattedNode } from './validateMessageTree';

// A time's options are among a date's, and each kind's are checked when split.
export type DateTimeOptions = DateMessageOptions & DateTimeFormattingContext;

/**
 * Splits a formatted placeholder's Intl options into its tree node, which
 * holds the style, and its sorted formatting context, by the option
 * classification. A tagged
 * template's options and an ICU string's are split here alike.
 */
export function splitOptions(
  name: string,
  kind: (NumberNode | DateTimeNode)[1],
  options: Intl.NumberFormatOptions | DateTimeOptions,
  invalid: (reason: string) => Error
): [node: NumberNode | DateTimeNode, formatting: MessageFormattingContext] {
  const messageKeys: readonly string[] =
    kind === 'number'
      ? NUMBER_MESSAGE_OPTIONS
      : kind === 'date'
        ? DATE_MESSAGE_OPTIONS
        : TIME_MESSAGE_OPTIONS;
  const contextKeys: readonly string[] =
    kind === 'number' ? NUMBER_CONTEXT_OPTIONS : DATE_TIME_CONTEXT_OPTIONS;
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
    const { style: named, ...fields } = message;
    if (named !== undefined && Object.keys(fields).length) {
      // Intl throws a TypeError for this too.
      throw invalid(`a style name cannot be combined with fields`);
    }
    style = named ?? canonicalStyle(fields);
  }
  return [formattedNode(name, kind, style, invalid), sortRecord(formatting)];
}

/** Each formatted variable's context, empty included, to find conflicts. */
export type FormatBindings = Map<string, MessageFormattingContext>;

/**
 * Binds a variable to its formatting context. `formats` is keyed by variable,
 * so one variable formatted with two contexts throws.
 */
export function bindFormatting(
  bindings: FormatBindings,
  name: string,
  formatting: MessageFormattingContext
): void {
  const bound = bindings.get(name);
  if (bound && JSON.stringify(bound) !== JSON.stringify(formatting)) {
    throw new Error(createConflictingFormatsError(name));
  }
  bindings.set(name, formatting);
}

/** The contexts that hold an option, as `formatMessageTree` takes them. */
export function boundFormats(bindings: FormatBindings): MessageTreeFormats {
  return Object.fromEntries(
    [...bindings].filter(([, formatting]) => Object.keys(formatting).length)
  );
}
