import type { StringFormat } from '../types-dir/jsx/content';

const DEFAULT_STRING_FORMAT_GLOBAL = '__GT_DEFAULT_STRING_FORMAT__';

type GlobalWithDefaultStringFormat = typeof globalThis & {
  [DEFAULT_STRING_FORMAT_GLOBAL]?: unknown;
};

export function isStringFormat(value: unknown): value is StringFormat {
  return value === 'ICU' || value === 'I18NEXT' || value === 'STRING';
}

export function getDefaultStringFormat(): StringFormat {
  const value = (globalThis as GlobalWithDefaultStringFormat)[
    DEFAULT_STRING_FORMAT_GLOBAL
  ];
  return isStringFormat(value) ? value : 'ICU';
}
