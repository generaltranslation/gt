import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { useFormatLocales } from '../../hooks/utils';

// ===== Component ===== //

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
  const locales = useFormatLocales(localesProp);
  // TODO: theres a world in which we don't need the i18n cache, if user passes their own params
  const gt = getReactI18nCache().getGTClass();
  if (children == null) return null;
  return gt
    .formatDateTime(children, { locales, ...options })
    .replace(/[\u200F\u202B\u202E]/g, '');
}

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

// ===== Exports ===== //

export { GtInternalDateTime, DateTime };
