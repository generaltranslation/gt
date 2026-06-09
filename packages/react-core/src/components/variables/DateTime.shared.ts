import { getI18nConfig } from 'gt-i18n/internal';
import { getFormatLocales } from '../../hooks/utils/getFormatLocales';

// Pure compute logic shared by the hook-based and RSC implementations. This
// module must stay free of hook/context imports so it can be reached from the
// context-rsc entrypoint.

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
  const gt = getI18nConfig().getGTClass();
  if (children == null) return null;
  return gt
    .formatDateTime(children, { locales, ...options })
    .replace(/[\u200F\u202B\u202E]/g, '');
}

export { computeDateTime };
export type { DateTimeProps, ResolvedDateTimeProps };
