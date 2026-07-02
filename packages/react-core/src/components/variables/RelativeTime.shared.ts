import { computeRelativeTime as computeRelativeTimeBase } from 'gt-i18n/internal';
import type { RelativeTimeFormatOptions } from 'gt-i18n/internal';

// Pure compute logic shared by the hook-based and RSC implementations. This
// module must stay free of hook/context imports so it can be reached from the
// components-rsc entrypoint.

type RelativeTimeProps = {
  date?: Date | null | undefined;
  children?: Date | null | undefined;
  name?: string;
  value?: number;
  unit?: Intl.RelativeTimeFormatUnit;
  baseDate?: Date;
  locales?: string[];
  options?: Intl.RelativeTimeFormatOptions;
  _locale?: string;
  _enableI18n?: boolean;
};

type ResolvedRelativeTimeProps = RelativeTimeProps & {
  _locale: string;
  _enableI18n: boolean;
};

function computeRelativeTime({
  _enableI18n,
  _locale,
  date,
  children,
  value,
  unit,
  baseDate,
  options,
  locales,
}: ResolvedRelativeTimeProps): string | null {
  return computeRelativeTimeBase({
    date: date ?? children,
    value,
    unit,
    baseDate,
    options: options as RelativeTimeFormatOptions | undefined,
    locales,
    locale: _locale,
    enableI18n: _enableI18n,
  });
}

export { computeRelativeTime };
export type { RelativeTimeProps, ResolvedRelativeTimeProps };
