import { getI18nConfig } from 'gt-i18n/internal';
import { getFormatLocales } from '../../hooks/utils/getFormatLocales';

// Pure compute logic shared by the hook-based and RSC implementations. This
// module must stay free of hook/context imports so it can be reached from the
// components-rsc entrypoint.

type RelativeTimeProps = {
  children?: Date | null | undefined;
  name?: string;
  value?: number;
  unit?: Intl.RelativeTimeFormatUnit;
  baseDate?: Date;
  options?: Intl.RelativeTimeFormatOptions;
};

type ResolvedRelativeTimeProps = RelativeTimeProps & {
  _locale: string;
  _enableI18n: boolean;
};

function computeRelativeTime({
  _enableI18n,
  _locale,
  children,
  value,
  unit,
  baseDate,
  options = {},
}: ResolvedRelativeTimeProps): string | null {
  const locales = getFormatLocales({
    locale: _locale,
    enableI18n: _enableI18n,
  });
  const i18nConfig = getI18nConfig();

  if (process.env.NODE_ENV === 'development' && value !== undefined && !unit) {
    // eslint-disable-next-line no-console
    console.warn(
      '<RelativeTime>: `value` was provided without `unit`. The `value` prop will be ignored.'
    );
  }

  if (value !== undefined && unit) {
    return i18nConfig.formatRelativeTime(value, unit, {
      locales,
      numeric: options.numeric,
      style: options.style,
      localeMatcher: options.localeMatcher,
    });
  }

  if (children != null) {
    return i18nConfig.formatRelativeTimeFromDate(children, {
      locales,
      baseDate: baseDate ?? new Date(),
      numeric: options.numeric,
      style: options.style,
      localeMatcher: options.localeMatcher,
    });
  }

  return null;
}

export { computeRelativeTime };
export type { RelativeTimeProps, ResolvedRelativeTimeProps };
