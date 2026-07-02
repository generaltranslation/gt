import { computeDateTime as computeDateTimeBase } from 'gt-i18n/internal';

// Pure compute logic shared by the hook-based and RSC implementations. This
// module must stay free of hook/context imports so it can be reached from the
// components-rsc entrypoint.

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
  options,
  locales,
}: ResolvedDateTimeProps): string | null {
  return computeDateTimeBase({
    value: children,
    options,
    locales,
    locale: _locale,
    enableI18n: _enableI18n,
  });
}

export { computeDateTime };
export type { DateTimeProps, ResolvedDateTimeProps };
