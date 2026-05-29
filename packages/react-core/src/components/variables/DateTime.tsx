import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { getFormatLocales } from '../../hooks/utils';

type DateTimeProps = {
  children: Date | null | undefined;
  locales?: string[];
  options?: Intl.DateTimeFormatOptions;
  name?: string;
  _locale?: string;
  _enableI18n?: boolean;
};

type ResolvedDateTimeProps = DateTimeProps & {
  _locale: string;
  _enableI18n: boolean;
};

// ===== Shared Logic ===== //

function computeDateTime({
  _enableI18n,
  _locale,
  children,
  options = {},
  locales: localesProp = [],
}: ResolvedDateTimeProps): string | null {
  const locales = getFormatLocales({
    locale: _locale,
    enableI18n: _enableI18n,
    localesProp,
  });
  // TODO: theres a world in which we don't need the i18n cache, if user passes their own params
  const gt = getReactI18nCache().getGTClass();
  if (children == null) return null;
  return gt
    .formatDateTime(children, { locales, ...options })
    .replace(/[\u200F\u202B\u202E]/g, '');
}

// ===== Component ===== //

function GtInternalDateTime({
  _enableI18n,
  _locale,
  ...props
}: DateTimeProps): string | null {
  return computeDateTime({
    ...props,
    _enableI18n: _enableI18n ?? useEnableI18n(),
    _locale: _locale ?? useLocale(),
  });
}

function DateTime(props: DateTimeProps): React.JSX.Element {
  return <GtInternalDateTime {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalDateTime._gtt = 'variable-datetime-automatic';
DateTime._gtt = 'variable-datetime';

// ===== Exports ===== //

export { GtInternalDateTime, DateTime };
