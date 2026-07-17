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
type TagFormatter = (parts: string[]) => unknown;

export function formatMessage(
  message: string,
  locales: string | string[] = 'en',
  variables: MessageVariables = {}
): string {
  const locale = resolveLocale(locales);
  const ast = parse(message, { locale });
  return formatElements(ast, locales, variables);
}

function formatElements(
  elements: MessageFormatElement[],
  locales: string | string[],
  variables: MessageVariables,
  currentPluralValue?: PluralValue
): string {
  let result = '';

  for (const element of elements) {
    switch (element.type) {
      case TYPE.literal:
        result += element.value;
        break;
      case TYPE.pound:
        if (currentPluralValue !== undefined) {
          result += new Intl.NumberFormat(locales).format(currentPluralValue);
        }
        break;
      case TYPE.argument:
        result += formatArgument(requireVariable(variables, element.value));
        break;
      case TYPE.number: {
        const value = requireVariable(variables, element.value);
        const options = numberOptions(element.style);
        const { scale, ...intlOptions } = options;
        const scaledValue = applyScale(value, scale);
        result += new Intl.NumberFormat(locales, intlOptions).format(
          scaledValue as number
        );
        break;
      }
      case TYPE.date:
      case TYPE.time: {
        const value = requireVariable(variables, element.value);
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
        result += new Intl.DateTimeFormat(locales, options).format(
          value as number | Date
        );
        break;
      }
      case TYPE.select: {
        const value = String(requireVariable(variables, element.value));
        const option =
          ownOption(element.options, value) ?? element.options.other;
        if (!option)
          throw invalidSelection(element.value, value, element.options);
        result += formatElements(option.value, locales, variables);
        break;
      }
      case TYPE.plural: {
        const value = requirePluralValue(
          requireVariable(variables, element.value),
          element.value
        );
        const exactSelector = `=${String(value)}`;
        let option = ownOption(element.options, exactSelector);
        const adjustedValue = subtractOffset(value, element.offset);
        if (!option) {
          const category = new Intl.PluralRules(locales, {
            type: element.pluralType,
          }).select(Number(adjustedValue));
          option =
            ownOption(element.options, category) ?? element.options.other;
        }
        if (!option) {
          throw invalidSelection(element.value, value, element.options);
        }
        result += formatElements(
          option.value,
          locales,
          variables,
          adjustedValue
        );
        break;
      }
      case TYPE.tag: {
        const formatter = requireVariable(variables, element.value);
        if (typeof formatter !== 'function') {
          throw new TypeError(
            `The ICU tag variable "${element.value}" must be a function.`
          );
        }
        const children = formatElements(
          element.children,
          locales,
          variables,
          currentPluralValue
        );
        const formatted = (formatter as TagFormatter)([children]);
        result += stringifyTagValue(formatted);
        break;
      }
    }
  }

  return result;
}

function requireVariable(variables: MessageVariables, name: string): unknown {
  if (!Object.hasOwn(variables, name)) {
    throw new Error(`The ICU message variable "${name}" was not provided.`);
  }
  return variables[name];
}

function formatArgument(value: unknown): string {
  if (value === false || value === null || value === undefined) return '';
  return String(value);
}

function stringifyTagValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(stringifyTagValue).join('');
  return String(value ?? '');
}

function numberOptions(
  style: NumberElement['style']
): ExtendedNumberFormatOptions {
  if (typeof style === 'string') return NUMBER_STYLES[style] ?? {};
  if (style?.type === SKELETON_TYPE.number) return style.parsedOptions;
  return {};
}

function applyScale(value: unknown, scale = 1): number | bigint {
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

function requirePluralValue(value: unknown, name: string): PluralValue {
  if (typeof value !== 'number' && typeof value !== 'bigint') {
    throw new TypeError(`The ICU plural variable "${name}" must be numeric.`);
  }
  return value;
}

function subtractOffset(value: PluralValue, offset: number): PluralValue {
  return typeof value === 'bigint' ? value - BigInt(offset) : value - offset;
}

function ownOption<T>(options: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(options, key) ? options[key] : undefined;
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
