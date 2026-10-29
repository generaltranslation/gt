/*
 * Formatting behavior is compatible with intl-messageformat (BSD-3-Clause)
 * while using only native Intl APIs. See THIRD_PARTY_NOTICES.md.
 */

import { resolveLocale } from './locale';
import { libraryDefaultLocale } from '../settings/settings';
import {
  SKELETON_TYPE,
  TYPE,
  type ExtendedNumberFormatOptions,
  type MessageFormatElement,
  type MessageVariables,
} from '../types-dir/ast';

export const NUMBER_STYLES: Record<string, Intl.NumberFormatOptions> = {
  integer: { maximumFractionDigits: 0 },
  currency: { style: 'currency' },
  percent: { style: 'percent' },
};

export const DATE_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
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

export const TIME_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  short: { hour: 'numeric', minute: 'numeric' },
  medium: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
  long: LONG_TIME_STYLE,
  full: LONG_TIME_STYLE,
};

export type PluralValue = number | bigint;
export type TagFormatter = (parts: unknown[]) => unknown;

export type FormatContext = {
  message: string;
  locales: string | string[];
  variables: MessageVariables;
  numberFormats?: Map<string, Intl.NumberFormat>;
  dateTimeFormats?: Map<string, Intl.DateTimeFormat>;
  pluralRules?: Map<Intl.PluralRuleType, Intl.PluralRules>;
};

/**
 * Formats an ICU syntax tree without parsing. Locales are validated the same
 * way as `formatMessage` from `@generaltranslation/icu/parser`.
 */
export function formatAst(
  ast: MessageFormatElement[],
  locales: string | string[] = libraryDefaultLocale,
  variables: MessageVariables = {}
): unknown {
  resolveLocale(locales);
  return formatParsedAst(ast, '', locales, variables);
}

/** Formats a tree whose locales were already validated; `message` is reported on errors. */
export function formatParsedAst(
  ast: MessageFormatElement[],
  message: string,
  locales: string | string[],
  variables: MessageVariables
): unknown {
  const parts = formatElements(ast, { message, locales, variables });
  if (parts.length === 1) return parts[0];
  return parts.length ? parts : '';
}

function formatElements(
  elements: MessageFormatElement[],
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

  for (const element of elements) {
    switch (element.type) {
      case TYPE.literal:
        append(element.value);
        break;
      case TYPE.pound:
        if (currentPluralValue !== undefined) {
          append(getNumberFormat(context).format(currentPluralValue));
        }
        break;
      case TYPE.argument: {
        const value = requireVariable(context.variables, element.value);
        append(
          typeof value === 'string' || typeof value === 'number'
            ? String(value)
            : value || ''
        );
        break;
      }
      case TYPE.number: {
        const value = requireVariable(context.variables, element.value);
        const options: ExtendedNumberFormatOptions =
          typeof element.style === 'string'
            ? (NUMBER_STYLES[element.style] ?? {})
            : element.style?.type === SKELETON_TYPE.number
              ? element.style.parsedOptions
              : {};
        const { scale, ...intlOptions } = options;
        const scaledValue = applyScale(value, scale);
        append(
          getNumberFormat(context, intlOptions).format(scaledValue as number)
        );
        break;
      }
      case TYPE.date:
      case TYPE.time: {
        const value = requireVariable(context.variables, element.value);
        const namedStyles =
          element.type === TYPE.date ? DATE_STYLES : TIME_STYLES;
        const options =
          typeof element.style === 'string'
            ? namedStyles[element.style]
            : element.style?.type === SKELETON_TYPE.dateTime
              ? element.style.parsedOptions
              : element.type === TYPE.time
                ? TIME_STYLES.medium
                : undefined;
        append(
          getDateTimeFormat(context, options).format(value as number | Date)
        );
        break;
      }
      case TYPE.select: {
        const value = String(requireVariable(context.variables, element.value));
        const option =
          ownOption(element.options, value) ?? element.options.other;
        if (!option)
          throw invalidSelection(element.value, value, element.options);
        formatElements(option.value, context).forEach(append);
        break;
      }
      case TYPE.plural: {
        const rawValue = requireVariable(context.variables, element.value);
        const exactSelector = `=${String(rawValue)}`;
        let option = ownOption(element.options, exactSelector);
        const value =
          typeof rawValue === 'bigint' ? rawValue : Number(rawValue);
        const adjustedValue =
          typeof value === 'bigint'
            ? value - BigInt(element.offset)
            : value - element.offset;
        if (!option && hasPluralCategoryOption(element.options)) {
          const category = getPluralRules(
            context,
            element.pluralType ?? 'cardinal'
          ).select(toPluralRulesNumber(adjustedValue));
          option = ownOption(element.options, category);
        }
        option ??= element.options.other;
        if (!option) {
          throw invalidSelection(element.value, rawValue, element.options);
        }
        formatElements(option.value, context, adjustedValue).forEach(append);
        break;
      }
      case TYPE.tag: {
        const formatter = requireVariable(context.variables, element.value);
        if (typeof formatter !== 'function') {
          throw new TypeError(
            `The ICU tag variable "${element.value}" must be a function.`
          );
        }
        const children = formatElements(
          element.children,
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

export function requireVariable(
  variables: MessageVariables,
  name: string
): unknown {
  // intl-messageformat intentionally used `name in values`, so inherited and
  // proxy-backed records are observable through the public formatting API.
  // Selector option lookup remains own-property-only to avoid prototype
  // collisions with values such as "constructor" and "toString".
  if (!(name in variables)) {
    throw new Error(`The ICU message variable "${name}" was not provided.`);
  }
  return variables[name];
}

export function applyScale(value: unknown, scale?: number): unknown {
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

export function getNumberFormat(
  context: FormatContext,
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  const cache = (context.numberFormats ??= new Map());
  const key = JSON.stringify(options);
  return getCachedFormatter(cache, key, () => {
    return new Intl.NumberFormat(context.locales, options);
  });
}

export function getDateTimeFormat(
  context: FormatContext,
  options?: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const cache = (context.dateTimeFormats ??= new Map());
  const key = options ? JSON.stringify(options) : '';
  return getCachedFormatter(cache, key, () => {
    return new Intl.DateTimeFormat(context.locales, options);
  });
}

export function getPluralRules(
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
  const cache = (context.pluralRules ??= new Map());
  return getCachedFormatter(cache, type, () => {
    return new Intl.PluralRules(context.locales, { type });
  });
}

function getCachedFormatter<Key, Value>(
  cache: Map<Key, Value>,
  key: Key,
  create: () => Value
): Value {
  const cached = cache.get(key);
  if (cached) return cached;
  const formatter = create();
  cache.set(key, formatter);
  return formatter;
}

export function toPluralRulesNumber(value: PluralValue): number {
  const numberValue = Number(value);
  if (typeof value === 'bigint' && Math.abs(numberValue) > 0x1fffffffffffff) {
    throw new RangeError(
      `Cannot select a plural category for bigint ${value} outside the safe integer range.`
    );
  }
  return numberValue;
}

export function hasPluralCategoryOption(
  options: Record<string, unknown>
): boolean {
  return Object.keys(options).some(
    (selector) => selector !== 'other' && selector[0] !== '='
  );
}

export function ownOption<T>(
  options: Record<string, T>,
  key: string
): T | undefined {
  return Object.prototype.hasOwnProperty.call(options, key)
    ? options[key]
    : undefined;
}

export function invalidSelection(
  name: string,
  value: unknown,
  options: Record<string, unknown>
): RangeError {
  return new RangeError(
    `The ICU variable "${name}" value ${JSON.stringify(String(value))} did not match any of: ${Object.keys(options).join(', ')}.`
  );
}
