/*
 * Formatting behavior is compatible with intl-messageformat (BSD-3-Clause)
 * while using only native Intl APIs. See THIRD_PARTY_NOTICES.md.
 */

import { intlCache } from '../cache/IntlCache';
import { resolveLocale } from './locale';
import { FALLBACK_BRANCH_KEY, isPluralCategoryKey } from '../settings/syntax';
import type {
  ExtendedNumberFormatOptions,
  MessageVariables,
} from '../types-dir/ast';
import type {
  DateTimeNode,
  MessageBranches,
  MessageTree,
  NumberNode,
  PluralNode,
  SelectNode,
  TagNode,
} from '../tree/messageTree';
import { branchNodes } from '../tree/walk';

const NUMBER_STYLES: Record<string, Intl.NumberFormatOptions> = {
  integer: { maximumFractionDigits: 0 },
  currency: { style: 'currency' },
  percent: { style: 'percent' },
};

const DATE_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  short: { month: 'numeric', day: 'numeric', year: '2-digit' },
  medium: { month: 'short', day: 'numeric', year: 'numeric' },
  long: { month: 'long', day: 'numeric', year: 'numeric' },
  full: {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  },
};

const LONG_TIME_STYLE: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  timeZoneName: 'short',
};

const TIME_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  short: { hour: 'numeric', minute: 'numeric' },
  medium: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
  long: LONG_TIME_STYLE,
  full: LONG_TIME_STYLE,
};

type PluralValue = number | bigint;
type TagFormatter = (parts: unknown[]) => unknown;

/**
 * A value that formats as text, as in a template literal: `true` is
 * `'true'` and `12n` is `'12'`. `null` and `undefined` format as nothing. A
 * Date is formatted by a date or time node, and is `String(date)` elsewhere.
 */
export type MessagePlainValue =
  | string
  | number
  | bigint
  | boolean
  | Date
  | null
  | undefined;

/**
 * Formats a tag's children, such as `(parts) => <b>{parts}</b>`. It returns
 * one part or several; several are spliced into the message, so `R` is the
 * type of one part, not of the array.
 */
export type MessageTagFormatter<R> = (
  parts: Array<string | R>
) => R | Array<string | R>;

/**
 * Values for `formatMessageTree`: plain values, rich values `R` (such as
 * React elements), and tag formatters that return them.
 */
export type MessageTreeValues<R> = Readonly<
  Record<string, MessagePlainValue | R | MessageTagFormatter<R>>
>;

/**
 * A tag's returned array is always several parts, so `R`, the type of one
 * part, cannot be an array, or a union with one, where tags format: `[42]`
 * would reach an outer tag as the number 42, not as one `number[]`.
 */
export type OnePartValues<R> = [Extract<R, readonly unknown[]>] extends [never]
  ? unknown
  : NoInfer<Readonly<Record<string, MessagePlainValue | R>>>;

/**
 * A message with rich values: that value, or the parts around it. Adjacent
 * text is merged, so string-only parts still give one string.
 */
export type FormattedMessage<R> = [R] extends [string]
  ? string
  : string | R | Array<string | R>;

/** What a message is formatted with, besides its locales and values. */
export type FormatMessageTreeOptions = {
  /**
   * The time zone of a date or time whose options set none. It is always
   * passed in: this package does not read the host's.
   */
  timeZone: string;
};

type FormatContext = FormatMessageTreeOptions & {
  message: string;
  locales: string | string[];
  variables: MessageVariables;
};

/**
 * Formats a message tree without parsing, with native Intl. Plain values
 * format as text, so the result is a string:
 *
 *   formatMessageTree(['Hi ', ['name']], 'en', { name: 'Ada' }, { timeZone });
 *   // 'Hi Ada'
 *
 * A rich value, or a tag formatter's result, is kept as a part:
 *
 *   formatMessageTree(
 *     ['Read the ', ['b', 'tag', ['terms']]],
 *     'en',
 *     { b: (parts) => <b>{parts}</b> },
 *     { timeZone }
 *   ); // ['Read the ', <b>terms</b>]
 *
 * Locales are validated the same way as `formatMessage` from
 * `@generaltranslation/icu/parser`.
 */
export function formatMessageTree(
  tree: MessageTree,
  locales: string | string[],
  variables: Readonly<Record<string, MessagePlainValue>>,
  options: FormatMessageTreeOptions
): string;
/**
 * With rich values or tag formatters, the result is a string, a rich value,
 * or the parts around them. TypeScript infers `R` from rich values; a tag
 * formatter alone needs it written, as in
 * `formatMessageTree<ReactNode>(tree, locale, { b: (parts) => <b>{parts}</b> }, options)`,
 * since `R` types its `parts`.
 */
export function formatMessageTree<R>(
  tree: MessageTree,
  locales: string | string[],
  variables: MessageTreeValues<R> & OnePartValues<R>,
  options: FormatMessageTreeOptions
): FormattedMessage<R>;
export function formatMessageTree(
  tree: MessageTree,
  locales: string | string[],
  variables: MessageVariables,
  options: FormatMessageTreeOptions
): unknown {
  resolveLocale(locales);
  return formatParsedTree(tree, '', locales, variables, options);
}

/** Formats a tree whose locales were already validated; `message` is reported on errors. */
export function formatParsedTree(
  tree: MessageTree,
  message: string,
  locales: string | string[],
  variables: MessageVariables,
  { timeZone }: FormatMessageTreeOptions
): unknown {
  // Most messages are plain text, which needs no formatter state.
  if (tree.length === 1 && typeof tree[0] === 'string') return tree[0];
  const parts = formatNodes(tree, {
    message,
    locales,
    variables,
    timeZone,
  });
  if (parts.length === 1) return parts[0];
  return parts.length ? parts : '';
}

// `switch (node[1])` does not narrow a tuple union, so cases cast to these.
type BranchNode = SelectNode | PluralNode;

function formatNodes(
  nodes: MessageTree,
  context: FormatContext,
  currentPluralValue?: PluralValue
): unknown[] {
  const result: unknown[] = [];
  const append = (value: unknown): void => {
    const previous = result[result.length - 1];
    if (typeof previous === 'string' && typeof value === 'string') {
      result[result.length - 1] = previous + value;
    } else {
      result.push(value);
    }
  };

  for (const node of nodes) {
    if (typeof node === 'string') {
      append(node);
      continue;
    }
    if (node === 0) {
      if (currentPluralValue !== undefined) {
        append(
          intlCache
            .get('NumberFormat', context.locales)
            .format(currentPluralValue)
        );
      }
      continue;
    }
    const name = node[0];
    switch (node[1]) {
      case undefined: {
        const value = requireVariable(context.variables, name);
        append(plainValueText(value));
        break;
      }
      case 'number': {
        const value = requireVariable(context.variables, name);
        const style = (node as NumberNode)[2];
        const options: ExtendedNumberFormatOptions =
          typeof style === 'string'
            ? (NUMBER_STYLES[style] ?? {})
            : (style ?? {});
        const { scale, ...intlOptions } = options;
        const scaledValue = applyScale(value, scale);
        append(
          intlCache
            .get('NumberFormat', context.locales, intlOptions)
            .format(scaledValue as number)
        );
        break;
      }
      case 'date':
      case 'time': {
        const value = requireVariable(context.variables, name);
        const isDate = node[1] === 'date';
        const style = (node as DateTimeNode)[2];
        // Own options only: Intl would also read inherited ones.
        const options: Intl.DateTimeFormatOptions = {
          ...(typeof style === 'string'
            ? (isDate ? DATE_STYLES : TIME_STYLES)[style]
            : (style ?? (isDate ? undefined : TIME_STYLES.medium))),
        };
        const timeZone = options.timeZone ?? context.timeZone;
        // The types require one; this is for a caller they do not check.
        if (!timeZone) {
          throw new TypeError(
            `The ICU variable "${name}" is formatted as a ${node[1]}, but no time zone was given.`
          );
        }
        append(
          intlCache
            .get('DateTimeFormat', context.locales, { ...options, timeZone })
            .format(value as number | Date)
        );
        break;
      }
      case 'select': {
        const branches = (node as BranchNode)[2];
        const value = String(requireVariable(context.variables, name));
        const branch =
          ownBranch(branches, value) ??
          ownBranch(branches, FALLBACK_BRANCH_KEY);
        if (!branch) throw invalidSelection(name, value, branches);
        formatNodes(branch, context).forEach(append);
        break;
      }
      case 'plural':
      case 'selectordinal': {
        const [, kind, branches, offset = 0] = node as PluralNode;
        const rawValue = requireVariable(context.variables, name);
        let branch = ownBranch(branches, `=${String(rawValue)}`);
        const value =
          typeof rawValue === 'bigint' ? rawValue : Number(rawValue);
        const adjustedValue =
          typeof value === 'bigint' ? value - BigInt(offset) : value - offset;
        if (!branch && hasPluralCategoryOption(branches)) {
          const category = getPluralRules(
            context,
            kind === 'plural' ? 'cardinal' : 'ordinal'
          ).select(toPluralRulesNumber(adjustedValue));
          branch = ownBranch(branches, category);
        }
        branch ??= ownBranch(branches, FALLBACK_BRANCH_KEY);
        if (!branch) throw invalidSelection(name, rawValue, branches);
        formatNodes(branch, context, adjustedValue).forEach(append);
        break;
      }
      case 'tag': {
        const formatter = requireVariable(context.variables, name);
        if (typeof formatter !== 'function') {
          throw new TypeError(
            `The ICU tag variable "${name}" must be a function.`
          );
        }
        const children = formatNodes(
          (node as TagNode)[2],
          context,
          currentPluralValue
        );
        const formatted = (formatter as TagFormatter)(children);
        if (Array.isArray(formatted)) formatted.forEach(append);
        else append(formatted);
        break;
      }
    }
  }

  return result;
}

function ownBranch(
  branches: MessageBranches,
  key: string
): MessageTree | undefined {
  const branch = ownOption(branches, key);
  return branch === undefined ? undefined : branchNodes(branch);
}

function plainValueText(value: unknown): unknown {
  if (value == null) return '';
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean' ||
    value instanceof Date
    ? String(value)
    : value;
}

function requireVariable(variables: MessageVariables, name: string): unknown {
  // intl-messageformat intentionally used `name in values`, so inherited and
  // proxy-backed records are observable through the public formatting API.
  // Selector option lookup remains own-property-only to avoid prototype
  // collisions with values such as "constructor" and "toString".
  if (!(name in variables)) {
    throw new Error(`The ICU message variable "${name}" was not provided.`);
  }
  return variables[name];
}

function applyScale(value: unknown, scale?: number): unknown {
  // intl-messageformat treated scale/0 as an absent scale. Preserve that
  // observable behavior for existing messages even though multiplying by zero
  // would follow the ICU skeleton definition more literally.
  if (!scale) return value;
  if (typeof value === 'bigint') {
    if (!Number.isInteger(scale)) {
      throw new RangeError(
        `Cannot apply fractional scale ${scale} to a bigint value.`
      );
    }
    return value * BigInt(scale);
  }
  return Number(value) * scale;
}

function getPluralRules(
  context: FormatContext,
  type: Intl.PluralRuleType
): Intl.PluralRules {
  if (typeof Intl.PluralRules !== 'function') {
    const error = new Error(
      'Intl.PluralRules is not available in this environment.\n' +
        'Try polyfilling it using "@formatjs/intl-pluralrules"\n'
    ) as Error & { code: string; originalMessage: string };
    error.code = 'MISSING_INTL_API';
    error.originalMessage = context.message;
    throw error;
  }
  return intlCache.get('PluralRules', context.locales, { type });
}

function toPluralRulesNumber(value: PluralValue): number {
  const numberValue = Number(value);
  if (typeof value === 'bigint' && Math.abs(numberValue) > 0x1fffffffffffff) {
    throw new RangeError(
      `Cannot select a plural category for bigint ${value} outside the safe integer range.`
    );
  }
  return numberValue;
}

function hasPluralCategoryOption(options: Record<string, unknown>): boolean {
  return Object.keys(options).some(isPluralCategoryKey);
}

function ownOption<T>(options: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(options, key)
    ? options[key]
    : undefined;
}

function invalidSelection(
  name: string,
  value: unknown,
  options: Record<string, unknown>
): RangeError {
  return new RangeError(
    `The ICU variable "${name}" value ${JSON.stringify(String(value))} did not match any of: ${Object.keys(options).join(', ')}.`
  );
}
