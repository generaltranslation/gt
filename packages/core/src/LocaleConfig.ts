import {
  LocaleConfig as ZonedLocaleConfig,
  type LocaleConfigConstructorParams as ZonedLocaleConfigConstructorParams,
} from '@generaltranslation/format';
import { hostTimeZone } from './utils/hostTimeZone';

export type LocaleConfigConstructorParams = Omit<
  ZonedLocaleConfigConstructorParams,
  'timeZone'
> & {
  /** The time zone of dates and times. Defaults to the host's. */
  timeZone?: string;
};

/**
 * The locale and formatting primitives of `@generaltranslation/format`, with
 * the time zone resolved: that package takes it as an argument.
 */
export class LocaleConfig extends ZonedLocaleConfig {
  constructor(params: LocaleConfigConstructorParams = {}) {
    super({ ...params, timeZone: params.timeZone ?? hostTimeZone() });
  }
}
