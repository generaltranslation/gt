import { useI18nManager } from '../../provider/GTContext';
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
  const gt = useI18nManager().getGTClass();
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
