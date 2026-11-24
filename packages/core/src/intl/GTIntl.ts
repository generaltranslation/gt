import {
  GTIntl as ResolvedGTIntl,
  type LocaleConfig,
} from '@generaltranslation/format';
import type { WithOptional } from '../formatting/formatting';
import { resolveLocaleConfig, withBaseDate } from './LocaleIntl';

type LocaleOption = ConstructorParameters<typeof ResolvedGTIntl>[1];

type RelativeTimeFromDateOptions = Parameters<
  ResolvedGTIntl['formatRelativeTimeFromDate']
>[1];

/**
 * LocaleIntl with formatMessage(), kept a subclass of
 * `@generaltranslation/format`'s GTIntl.
 */
export class GTIntl extends ResolvedGTIntl {
  constructor(localeConfig: LocaleConfig = {}, options?: LocaleOption) {
    super(resolveLocaleConfig(localeConfig), options);
  }

  /** Compares the date with now when no `baseDate` is given. */
  override formatRelativeTimeFromDate(
    date: Date,
    options?: WithOptional<RelativeTimeFromDateOptions, 'baseDate'>
  ): string {
    return super.formatRelativeTimeFromDate(date, withBaseDate(options));
  }
}
