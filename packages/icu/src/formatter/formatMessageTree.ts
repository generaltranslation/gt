/*
 * Formatting behavior is compatible with intl-messageformat (BSD-3-Clause)
 * while using only native Intl APIs. See THIRD_PARTY_NOTICES.md.
 */

import { intlCache } from '../cache/IntlCache';
import { resolveLocale } from './locale';
import {
  DECIMAL_NUMBER,
  FALLBACK_BRANCH_KEY,
  isPluralCategoryKey,
} from '../settings/syntax';
import type { ExtendedNumberFormatOptions } from '../types-dir/ast';
import type {
  MessageBranches,
  MessageNode,
  MessageTree,
} from '../tree/messageTree';
import type { ParsedNode, ParsedTree } from './formatIcu';
import { messageTreeNodes } from '../tree/walk';
import {
  DATE_FIELD_OPTIONS,
  DATE_TIME_STYLE_NAMES,
  NAMED_NUMBER_STYLES,
  type DateTimeStyleName,
  type MessageFormats,
} from '../settings/formatOptions';

const DATE_TIME_STYLES = new Set<string>(DATE_TIME_STYLE_NAMES);

// ICU formats `{d, date}` and `{t, time}` without a style in the medium style.
const DEFAULT_DATE_TIME_STYLE: DateTimeStyleName = 'medium';

type PluralValue = number | bigint;

/**
 * A value that formats as text, as in a template literal: `true` is
 * `'true'` and `12n` is `'12'`. `null` and `undefined` format as nothing. A
 * Date is formatted by a date or time node, and as the locale's short date
 * and time elsewhere, as in ICU.
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
export type MessageValues<R> = Readonly<
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

/** Formatting context for `formatMessageTree`, kept out of the tree. */
export type FormatMessageTreeOptions = {
  /**
   * Each formatted variable's formatting context, such as a currency or
   * `timeZone`, as `templateToMessage` returns it; `{}` when the message has
   * none. It is merged over the placeholder's style.
   */
  formats: MessageFormats;
  /**
   * The time zone of a date or time whose formats set none. It is always
   * passed in: this package does not read the host's.
   */
  timeZone: string;
};

/** One part of a formatted message: text, or a rich value. */
type Part<R> = string | R;
type MessageValue<R> = MessageValues<R>[string];

type FormatContext<R> = FormatMessageTreeOptions & {
  icu: string;
  locales: string | string[];
  values: MessageValues<R>;
};

/**
 * Formats a message tree without parsing, with native Intl. Plain values
 * format as text, so the result is a string:
 *
 *   formatMessageTree(['Hi ', ['name']], 'en', { name: 'Ada' }, {
 *     formats: {},
 *     timeZone,
 *   }); // 'Hi Ada'
 *
 * A rich value, or a tag formatter's result, is kept as a part:
 *
 *   formatMessageTree(
 *     ['Read the ', ['b', 'tag', 'terms']],
 *     'en',
 *     { b: (parts) => <b>{parts}</b> },
 *     { formats: {}, timeZone }
 *   ); // ['Read the ', <b>terms</b>]
 *
 * Formatting context, like a currency or a time zone, is passed by variable:
 *
 *   formatMessageTree([['total', 'number', 'currency']], 'en', { total: 5 }, {
 *     formats: { total: { currency: 'EUR' } },
 *     timeZone,
 *   }); // '€5.00'
 *
 * Locales are validated the same way as `formatIcu` from
 * `@generaltranslation/icu/parser`.
 */
export function formatMessageTree(
  tree: MessageTree,
  locales: string | string[],
  values: Readonly<Record<string, MessagePlainValue>>,
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
  values: MessageValues<R> & OnePartValues<R>,
  options: FormatMessageTreeOptions
): FormattedMessage<R>;
export function formatMessageTree<R>(
  tree: MessageTree,
  locales: string | string[],
  values: MessageValues<R>,
  options: FormatMessageTreeOptions
): Part<R> | Part<R>[] {
  resolveLocale(locales);
  return formatParsedTree(tree, '', locales, values, options);
}

/** Formats a tree whose locales were already validated; `icu` is reported on errors. */
export function formatParsedTree<R>(
  tree: ParsedTree,
  icu: string,
  locales: string | string[],
  values: MessageValues<R>,
  { formats, timeZone }: FormatMessageTreeOptions
): Part<R> | Part<R>[] {
  // Most messages are plain text, which needs no formatter state.
  if (typeof tree === 'string') return tree;
  const parts = formatNodes(tree, {
    icu,
    locales,
    values,
    formats,
    timeZone,
  });
  if (parts.length === 1) return parts[0];
  return parts.length ? parts : '';
}

function formatNodes<R>(
  nodes: MessageNode<ParsedNode>[],
  context: FormatContext<R>,
  currentPluralValue?: PluralValue
): Part<R>[] {
  const result: Part<R>[] = [];
  const append = (value: Part<R>): void => {
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
        const value = requireVariable(context.values, name);
        append(
          value instanceof Date
            ? intlCache
                .get('DateTimeFormat', context.locales, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: context.timeZone,
                })
                .format(value)
            : plainValueText(value)
        );
        break;
      }
      case 'number': {
        const value = numberValue(name, requireVariable(context.values, name));
        const style = node[2];
        // An ICU string's skeleton may also hold a scale.
        const { scale, ...intlOptions }: ExtendedNumberFormatOptions = {
          ...(typeof style === 'string'
            ? (ownOption(NAMED_NUMBER_STYLES, style) ??
              unknownStyle(name, style))
            : style),
          ...formatsOf(context, name),
        };
        if (intlOptions.style === 'currency' && !intlOptions.currency) {
          throw new TypeError(
            `The ICU variable "${name}" is formatted as currency, but no currency was given.`
          );
        }
        const scaledValue = applyScale(value, scale);
        // Intl prints ∞ past the largest double, where ICU keeps every digit.
        if (
          scale !== undefined &&
          typeof scaledValue !== 'bigint' &&
          Number.isFinite(Number(value)) &&
          !Number.isFinite(Number(scaledValue))
        ) {
          throw new RangeError(
            `The ICU variable "${name}" is too large to format once it is scaled.`
          );
        }
        append(
          intlCache
            .get('NumberFormat', context.locales, intlOptions)
            .format(scaledValue as number)
        );
        break;
      }
      case 'date':
      case 'time': {
        const value = requireVariable(context.values, name);
        if (typeof value !== 'number' && !(value instanceof Date)) {
          throw new TypeError(
            `The ICU variable "${name}" must be a Date or a number.`
          );
        }
        const isDate = node[1] === 'date';
        const style = node[2];
        // Named styles are ICU's: Intl's dateStyle and timeStyle.
        const named = style ?? DEFAULT_DATE_TIME_STYLE;
        const styleOptions: Intl.DateTimeFormatOptions | undefined =
          typeof named === 'string'
            ? DATE_TIME_STYLES.has(named)
              ? { [isDate ? 'dateStyle' : 'timeStyle']: named }
              : unknownStyle(name, named)
            : named;
        const options: Intl.DateTimeFormatOptions = {
          ...styleOptions,
          ...formatsOf(context, name),
        };
        const formatter = intlCache.get('DateTimeFormat', context.locales, {
          ...withLocaleHourPadding(options),
          timeZone: options.timeZone ?? context.timeZone,
        });
        // Intl adds a date to an era or a time zone name with no other field.
        const fields = DATE_FIELD_OPTIONS.filter(
          (field) => options[field] !== undefined
        );
        const alone =
          !options.dateStyle &&
          !options.timeStyle &&
          fields.every((field) => field === 'era' || field === 'timeZoneName');
        if (alone && fields.length > 1) {
          throw new RangeError(
            `The ICU variable "${name}" has an era and a time zone name with no other field, which Intl cannot format without a date.`
          );
        }
        append(
          alone && fields.length
            ? formatter
                .formatToParts(value)
                .filter((part) => part.type === fields[0])
                .map((part) => part.value)
                .join('')
            : formatter.format(value)
        );
        break;
      }
      case 'select': {
        const branches = node[2];
        const value = String(requireVariable(context.values, name));
        const branch =
          ownBranch(branches, value) ??
          ownBranch(branches, FALLBACK_BRANCH_KEY);
        if (!branch) throw invalidSelection(name, value, branches);
        formatNodes(branch, context).forEach(append);
        break;
      }
      case 'plural':
      case 'selectordinal': {
        const [, kind, branches, offset = 0] = node;
        const rawValue = numberValue(
          name,
          requireVariable(context.values, name)
        );
        const value =
          typeof rawValue === 'bigint' ? rawValue : Number(rawValue);
        // ICU compares the number, so "01" matches `=1`.
        let branch = ownBranch(branches, `=${value}`);
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
        const formatter = requireVariable(context.values, name);
        if (typeof formatter !== 'function') {
          throw new TypeError(
            `The ICU tag variable "${name}" must be a function.`
          );
        }
        const children = formatNodes(
          messageTreeNodes(node[2]),
          context,
          currentPluralValue
        );
        const formatted = (formatter as MessageTagFormatter<R>)(children);
        if (Array.isArray(formatted)) formatted.forEach(append);
        else append(formatted);
        break;
      }
    }
  }

  return result;
}

/**
 * Beside an hour, Intl prints two digits for a minute or a second whichever
 * is asked for, but '2-digit' also drops the locale's own padding of the
 * hour: German `::jmm` would be 3:04, where ICU prints 03:04. A '2-digit'
 * hour pads anyway, so it keeps the pattern, which is ICU's: `::HHss` is
 * 03 (second: 5), not 5 (hour: 03).
 */
function withLocaleHourPadding(
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormatOptions {
  if (options.hour !== 'numeric') return options;
  return {
    ...options,
    ...(options.minute && { minute: 'numeric' }),
    ...(options.second && { second: 'numeric' }),
  };
}

function formatsOf<R>(
  context: FormatContext<R>,
  name: string
): MessageFormats[string] | undefined {
  return ownOption(context.formats, name);
}

function ownBranch(
  branches: MessageBranches<ParsedNode>,
  key: string
): MessageNode<ParsedNode>[] | undefined {
  const branch = ownOption(branches, key);
  return branch === undefined ? undefined : messageTreeNodes(branch);
}

function plainValueText<R>(value: MessageValue<R>): Part<R> {
  if (value == null) return '';
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
    ? String(value)
    : // A value that is not plain is a rich one, kept as a part.
      (value as R);
}

function requireVariable<R>(
  values: MessageValues<R>,
  name: string
): MessageValue<R> {
  // Own values only, so a name like "toString" is not found on every object.
  if (!Object.prototype.hasOwnProperty.call(values, name)) {
    throw new Error(`The ICU message variable "${name}" was not provided.`);
  }
  return values[name];
}

/**
 * A number as Intl reads one: a number, a bigint, or a decimal string, which
 * keeps every digit. Any other value would print as `NaN` or as `0`.
 */
function numberValue<R>(
  name: string,
  value: MessageValue<R>
): number | bigint | string {
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    (typeof value === 'string' && DECIMAL_NUMBER.test(value.trim()))
  ) {
    return value;
  }
  throw new TypeError(
    `The ICU variable "${name}" must be a number, a bigint or a numeric string.`
  );
}

/**
 * The value times ICU's `scale`, which ICU multiplies as a decimal. A power
 * of ten moves the decimal point in a string, which Intl reads exactly; as a
 * double, 3 times 0.1 is 0.30000000000000004.
 */
function applyScale<Value>(
  value: Value,
  scale: number | undefined
): Value | number | bigint | string {
  if (scale === undefined) return value;
  const exponent = Math.round(Math.log10(scale));
  // Zero keeps its sign as a number, and needs no exact point.
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  const isDecimalString =
    typeof value === 'string' && DECIMAL_NUMBER.test(value.trim());
  if (
    Number(`1e${exponent}`) === scale &&
    ((isNumber && value !== 0) || typeof value === 'bigint' || isDecimalString)
  ) {
    const [digits, ownExponent = 0] = (
      isNumber ? value.toExponential() : String(value).trim()
    ).split(/e/i);
    return `${digits}e${Number(ownExponent) + exponent}`;
  }
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

function getPluralRules<R>(
  context: FormatContext<R>,
  type: Intl.PluralRuleType
): Intl.PluralRules {
  if (typeof Intl.PluralRules !== 'function') {
    const error = new Error(
      'Intl.PluralRules is not available in this environment.\n' +
        'Try polyfilling it using "@formatjs/intl-pluralrules"\n'
    ) as Error & { code: string; originalMessage: string };
    error.code = 'MISSING_INTL_API';
    error.originalMessage = context.icu;
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

// ICU reads any other style as a pattern, like `#,##0.00` or `yyyy-MM-dd`,
// which Intl cannot format.
function unknownStyle(name: string, style: string): never {
  throw new RangeError(
    `The ICU variable "${name}" has the style "${style}", which is not an ICU style name. ICU patterns are not supported; write a skeleton, like ::.00 or ::yMMMd.`
  );
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
