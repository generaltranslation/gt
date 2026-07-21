/*
 * Formatting behavior is compatible with intl-messageformat (BSD-3-Clause)
 * while using only native Intl APIs. See THIRD_PARTY_NOTICES.md.
 */

import { parse } from './parser';
import {
  SKELETON_TYPE,
  TYPE,
  type ExtendedNumberFormatOptions,
  type MessageFormatElement,
  type MessageVariables,
  type NumberElement,
} from './types';

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

const TIME_STYLES: Record<string, Intl.DateTimeFormatOptions> = {
  short: { hour: 'numeric', minute: 'numeric' },
  medium: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
  long: {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'short',
  },
  full: {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'short',
  },
};

type PluralValue = number | bigint;
type TagFormatter = (parts: unknown[]) => unknown;
type FormattedPart = {
  type: 'literal' | 'object';
  value: unknown;
};

type FormatContext = {
  locales: string | string[];
  variables: MessageVariables;
  numberFormats?: Map<string, Intl.NumberFormat>;
  dateTimeFormats?: Map<string, Intl.DateTimeFormat>;
  pluralRules?: Map<Intl.PluralRuleType, Intl.PluralRules>;
};

export function formatMessage(
  message: string,
  locales: string | string[] = 'en',
  variables: MessageVariables = {}
): unknown {
  const locale = resolveLocale(locales);
  const ast = parse(message, { locale });
  return collapseParts(formatElements(ast, { locales, variables }));
}

function formatElements(
  elements: MessageFormatElement[],
  context: FormatContext,
  currentPluralValue?: PluralValue
): FormattedPart[] {
  const result: FormattedPart[] = [];

  for (const element of elements) {
    switch (element.type) {
      case TYPE.literal:
        result.push({ type: 'literal', value: element.value });
        break;
      case TYPE.pound:
        if (currentPluralValue !== undefined) {
          result.push({
            type: 'literal',
            value: getNumberFormat(context).format(currentPluralValue),
          });
        }
        break;
      case TYPE.argument: {
        const value = formatArgument(
          requireVariable(context.variables, element.value)
        );
        result.push({
          type: typeof value === 'string' ? 'literal' : 'object',
          value,
        });
        break;
      }
      case TYPE.number: {
        const value = requireVariable(context.variables, element.value);
        const options = numberOptions(element.style);
        const { scale, ...intlOptions } = options;
        const scaledValue = applyScale(value, scale);
        result.push({
          type: 'literal',
          value: getNumberFormat(context, intlOptions).format(
            scaledValue as number
          ),
        });
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
        result.push({
          type: 'literal',
          value: getDateTimeFormat(context, options).format(
            value as number | Date
          ),
        });
        break;
      }
      case TYPE.select: {
        const value = String(requireVariable(context.variables, element.value));
        const option =
          ownOption(element.options, value) ?? element.options.other;
        if (!option)
          throw invalidSelection(element.value, value, element.options);
        result.push(...formatElements(option.value, context));
        break;
      }
      case TYPE.plural: {
        const rawValue = requireVariable(context.variables, element.value);
        const exactSelector = `=${String(rawValue)}`;
        let option = ownOption(element.options, exactSelector);
        const value = coercePluralValue(rawValue);
        const adjustedValue = subtractOffset(value, element.offset);
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
        result.push(...formatElements(option.value, context, adjustedValue));
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
        ).map(({ value }) => value);
        const formatted = (formatter as TagFormatter)(children);
        const chunks = Array.isArray(formatted) ? formatted : [formatted];
        result.push(
          ...chunks.map<FormattedPart>((value) => ({
            type: typeof value === 'string' ? 'literal' : 'object',
            value,
          }))
        );
        break;
      }
    }
  }

  return mergeLiteralParts(result);
}

function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function requireVariable(variables: MessageVariables, name: string): unknown {
  if (!hasOwn(variables, name)) {
    throw new Error(`The ICU message variable "${name}" was not provided.`);
  }
  return variables[name];
}

function formatArgument(value: unknown): unknown {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (!value) return '';
  return value;
}

function mergeLiteralParts(parts: FormattedPart[]): FormattedPart[] {
  const result: FormattedPart[] = [];
  for (const part of parts) {
    const previous = result[result.length - 1];
    if (previous?.type === 'literal' && part.type === 'literal') {
      previous.value = String(previous.value) + String(part.value);
    } else {
      result.push(part);
    }
  }
  return result;
}

function collapseParts(parts: FormattedPart[]): unknown {
  if (parts.length === 1) return parts[0].value;

  const result: unknown[] = [];
  for (const part of parts) {
    const previous = result[result.length - 1];
    if (part.type === 'literal' && typeof previous === 'string') {
      result[result.length - 1] = previous + String(part.value);
    } else {
      result.push(part.value);
    }
  }
  return result.length <= 1 ? result[0] || '' : result;
}

function numberOptions(
  style: NumberElement['style']
): ExtendedNumberFormatOptions {
  if (typeof style === 'string') return NUMBER_STYLES[style] ?? {};
  if (style?.type === SKELETON_TYPE.number) return style.parsedOptions;
  return {};
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

function getNumberFormat(
  context: FormatContext,
  options: Intl.NumberFormatOptions = {}
): Intl.NumberFormat {
  const cache = (context.numberFormats ??= new Map());
  const key = JSON.stringify(options);
  return getCachedFormatter(cache, key, () => {
    return new Intl.NumberFormat(context.locales, options);
  });
}

function getDateTimeFormat(
  context: FormatContext,
  options?: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const cache = (context.dateTimeFormats ??= new Map());
  const key = options ? JSON.stringify(options) : '';
  return getCachedFormatter(cache, key, () => {
    return new Intl.DateTimeFormat(context.locales, options);
  });
}

function getPluralRules(
  context: FormatContext,
  type: Intl.PluralRuleType
): Intl.PluralRules {
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

function coercePluralValue(value: unknown): PluralValue {
  return typeof value === 'bigint' ? value : Number(value);
}

function subtractOffset(value: PluralValue, offset: number): PluralValue {
  return typeof value === 'bigint' ? value - BigInt(offset) : value - offset;
}

function toPluralRulesNumber(value: PluralValue): number {
  const numberValue = Number(value);
  if (typeof value === 'bigint' && !Number.isSafeInteger(numberValue)) {
    throw new RangeError(
      `Cannot select a plural category for bigint ${value} outside the safe integer range.`
    );
  }
  return numberValue;
}

function hasPluralCategoryOption(options: Record<string, unknown>): boolean {
  return Object.keys(options).some(
    (selector) => selector !== 'other' && !selector.startsWith('=')
  );
}

function ownOption<T>(options: Record<string, T>, key: string): T | undefined {
  return hasOwn(options, key) ? options[key] : undefined;
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

function resolveLocale(locales: string | string[]): Intl.Locale | undefined {
  if (typeof Intl.Locale === 'undefined') return undefined;
  const requested = typeof locales === 'string' ? locales : locales[0];
  if (!requested) return undefined;
  const supported =
    Intl.NumberFormat.supportedLocalesOf(locales)[0] ?? requested;
  return new Intl.Locale(supported);
}
