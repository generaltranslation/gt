import { withDefaultDateStyle } from 'generaltranslation/internal';
import { getI18nConfig } from 'gt-i18n/internal';
import { getFormatLocales } from '../../hooks/utils/getFormatLocales';

// Pure compute logic shared by the hook-based and RSC implementations. This
// module must stay free of hook/context imports so it can be reached from the
// components-rsc entrypoint.

type DateTimeProps = {
  children: Date | number | null | undefined;
  options?: Intl.DateTimeFormatOptions;
  name?: string;
};

type ResolvedDateTimeProps = DateTimeProps & {
  _locale: string;
  _enableI18n: boolean;
};

function computeDateTime({
  _enableI18n,
  _locale,
  children,
  options,
}: ResolvedDateTimeProps): string | null {
  const locales = getFormatLocales({
    locale: _locale,
    enableI18n: _enableI18n,
  });
  // TODO: theres a world in which we don't need the i18n cache, if user passes their own params
  const i18nConfig = getI18nConfig();
  if (children == null) return null;
  return i18nConfig.formatDateTime(children, {
    locales,
    ...withDefaultDateStyle(options),
  });
}

export { computeDateTime };
export type { DateTimeProps, ResolvedDateTimeProps };
