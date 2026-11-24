import { formatIcu } from '@generaltranslation/icu/parser';
import type { FormatVariables } from '../types';
import type { StringFormat } from '../types-dir/jsx/content';
import type { LocaleIntl, WithLocales } from './LocaleIntl';

/** formatMessage() options. */
export type IntlMessageOptions = WithLocales<{
  variables?: FormatVariables;
  dataFormat?: StringFormat;
}>;

/**
 * Formats an ICU message string in an instance's locales and time zone. Kept
 * apart from LocaleIntl so its subclasses leave the ICU parser out of
 * bundles that format none.
 */
export function formatIntlMessage(
  intl: LocaleIntl,
  message: string,
  options: IntlMessageOptions = {}
): string {
  const { locale, locales, variables, dataFormat } = options;
  if (dataFormat === 'STRING') return message;
  return formatIcu(
    message,
    intl.getFormattingLocales(locale, locales),
    variables ?? {},
    { timeZone: intl.timeZone }
  );
}
