import { getI18nManager } from 'gt-i18n/internal';
import { getDefaultLocale, getLocale } from '../locale-operations';

/**
 * Equivalent to the `<DateTime>` component, but used for auto insertion
 */
function GtInternalDateTime({
  children,
  options = {},
  locales: localesProp = [],
}: {
  children: Date | null | undefined;
  locales?: string[];
  options?: Intl.DateTimeFormatOptions;
  name?: string;
}): string | null {
  // Parse input
  if (children == null) return null;
  const locales = [...localesProp, getLocale(), getDefaultLocale()];

  // Apply formatting
  const i18nManager = getI18nManager();
  const gt = i18nManager.getGTClass();
  const result = gt
    .formatDateTime(children, { locales, ...options })
    .replace(/[\u200F\u202B\u202E]/g, '');

  // Return formatted date
  return result;
}

/**
 * User facing component for the `<DateTime>` variable
 */
function DateTime(props: {
  children: Date | null | undefined;
  locales?: string[];
  options?: Intl.DateTimeFormatOptions;
  name?: string;
}): string | null {
  return GtInternalDateTime(props);
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalDateTime._gtt = 'variable-datetime-automatic';
DateTime._gtt = 'variable-datetime';

export { GtInternalDateTime, DateTime };
