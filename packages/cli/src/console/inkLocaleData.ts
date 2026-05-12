import { listSupportedLocales } from '@generaltranslation/supported-locales';
import { getLocaleProperties } from 'generaltranslation';
import type { LocaleOption } from './inkTypes.js';

let localeOptionsCache: LocaleOption[] | undefined;
let localeCodeWidthCache: number | undefined;

export function getLocaleOptions(): LocaleOption[] {
  localeOptionsCache ??= listSupportedLocales().map((code) => {
    const properties = getLocaleProperties(code);
    const label =
      properties.name === properties.nativeName
        ? `${code}  ${properties.name}`
        : `${code}  ${properties.name} / ${properties.nativeName}`;

    return {
      code,
      label,
      name: properties.name,
      nativeName: properties.nativeName,
      searchable:
        `${code} ${properties.name} ${properties.nativeName}`.toLowerCase(),
    };
  });
  return localeOptionsCache;
}

export function getLocaleCodeWidth(): number {
  localeCodeWidthCache ??= getLocaleOptions().reduce(
    (max, option) => Math.max(max, option.code.length),
    0
  );
  return localeCodeWidthCache;
}

export function getFilteredLocaleOptions(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const options = getLocaleOptions();
  if (!normalizedQuery) return options;

  return options.filter((option) =>
    option.searchable.includes(normalizedQuery)
  );
}
