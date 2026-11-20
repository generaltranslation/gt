import format from 'icu-minify/format';
import { _createCache, _createIntlFormatters } from 'use-intl/core';
import type { Runtime } from '../values.ts';

type Message = Parameters<typeof format>[0];

/**
 * The named styles next-intl passes to icu-minify (`defaultFormats` of
 * use-intl/format-message/format-only); icu-minify itself knows no style
 * names. build.ts asserts this table prints what use-intl's wrapper prints.
 */
const formats = {
  date: {
    short: { month: 'numeric', day: 'numeric', year: '2-digit' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  },
  number: {
    integer: { maximumFractionDigits: 0 },
    currency: { style: 'currency' },
    percent: { style: 'percent' },
  },
} as const;

export const make: Runtime['make'] = (catalog: Record<string, Message>) => {
  const options = {
    formatters: _createIntlFormatters(_createCache()),
    formats,
    timeZone: 'UTC',
  };
  return (key, values) =>
    format(catalog[key]!, 'en', values, options) as string;
};
