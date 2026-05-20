import { getReactI18nManager } from '../../i18n-manager/singleton-operations';
import { useFormatLocales } from '../../hooks/utils';

type DateTimeProps = {
  children: Date | null | undefined;
  locales?: string[];
  options?: Intl.DateTimeFormatOptions;
  name?: string;
};

// ===== Component ===== //

function GtInternalDateTime({
  children,
  options = {},
  locales: localesProp = [],
}: DateTimeProps): string | null {
  const locales = useFormatLocales(localesProp);
  // TODO: theres a world in which we don't need the i18n manager, if user passes their own params
  const gt = getReactI18nManager().getGTClass();
  if (children == null) return null;
  return gt
    .formatDateTime(children, { locales, ...options })
    .replace(/[\u200F\u202B\u202E]/g, '');
}

function DateTime(props: DateTimeProps): React.JSX.Element {
  return <GtInternalDateTime {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalDateTime._gtt = 'variable-datetime-automatic';
DateTime._gtt = 'variable-datetime';

// ===== Exports ===== //

export { GtInternalDateTime, DateTime };
