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
  type MessageFormats,
} from '../settings/formatOptions';
import { canonicalStyle, sortRecord } from './canonical';
import type { DateTimeNode, NumberNode } from './messageTree';
import { formattedNode } from './validateMessageTree';

// A time's options are among a date's, and each kind's are checked when split.
export type DateTimeOptions = DateMessageOptions & DateTimeFormattingContext;

/**
 * Splits a formatted placeholder's Intl options in two: its tree node, from
 * the options that are part of the message, like the style, and its
 * formatting context, sorted, from the rest. A tagged template's options and
 * an ICU string's are split here alike.
 */
export function splitOptions(
  name: string,
  kind: (NumberNode | DateTimeNode)[1],
  options: Intl.NumberFormatOptions | DateTimeOptions,
  fail: (reason: string) => Error
): [node: NumberNode | DateTimeNode, context: MessageFormattingContext] {
  const messageKeys: readonly string[] =
    kind === 'number'
      ? NUMBER_MESSAGE_OPTIONS
      : kind === 'date'
        ? DATE_MESSAGE_OPTIONS
        : TIME_MESSAGE_OPTIONS;
  const contextKeys: readonly string[] =
    kind === 'number' ? NUMBER_CONTEXT_OPTIONS : DATE_TIME_CONTEXT_OPTIONS;
  const messageOptions: Record<string, unknown> = {};
  const context: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    // Intl reads an undefined option as an absent one.
    if (value === undefined) continue;
    if (messageKeys.includes(key)) messageOptions[key] = value;
    else if (contextKeys.includes(key)) context[key] = value;
    else throw fail(`a ${kind} has no "${key}" option`);
  }

  let style: unknown;
  if (kind === 'number') {
    // Intl ignores `unit` without a unit style, so it would not be in the message.
    if (messageOptions.unit !== undefined && messageOptions.style !== 'unit') {
      throw fail(`"unit" needs style: 'unit'`);
    }
    style =
      messageOptions.style === 'unit'
        ? { style: 'unit', unit: messageOptions.unit }
        : messageOptions.style === 'decimal'
          ? undefined
          : messageOptions.style;
  } else {
    const { style: styleName, ...fields } = messageOptions;
    if (styleName !== undefined && Object.keys(fields).length) {
      // Intl throws a TypeError for this too.
      throw fail(`a style name cannot be combined with fields`);
    }
    style = styleName ?? canonicalStyle(fields);
  }
  return [formattedNode(name, kind, style, fail), sortRecord(context)];
}

/** Each formatted variable's context, empty included, to find conflicts. */
export type ContextByVariable = Map<string, MessageFormattingContext>;

/**
 * Adds a variable's formatting context. `formats` is keyed by variable, so
 * one variable formatted with two contexts throws.
 */
export function addContext(
  contexts: ContextByVariable,
  name: string,
  context: MessageFormattingContext
): void {
  const existing = contexts.get(name);
  if (existing && JSON.stringify(existing) !== JSON.stringify(context)) {
    throw new Error(createConflictingFormatsError(name));
  }
  contexts.set(name, context);
}

/** A message's `formats`: each variable's context that holds an option. */
export function toFormats(contexts: ContextByVariable): MessageFormats {
  return Object.fromEntries(
    [...contexts].filter(([, context]) => Object.keys(context).length)
  );
}
