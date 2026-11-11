import {
  LocaleConfig as ResolvedLocaleConfig,
  type LocaleConfigConstructorParams as ResolvedLocaleConfigParams,
} from '@generaltranslation/format';
import { libraryDefaultLocale } from './settings/settings';
import { hostTimeZone } from './utils/hostTimeZone';

export type LocaleConfigConstructorParams = Partial<ResolvedLocaleConfigParams>;

/**
 * The locale and formatting primitives of `@generaltranslation/format`, with
 * its settings resolved: that package takes each of them as an argument.
 */
export class LocaleConfig extends ResolvedLocaleConfig {
  constructor(params: LocaleConfigConstructorParams = {}) {
    super({
      ...params,
      defaultLocale: params.defaultLocale ?? libraryDefaultLocale,
      locales: params.locales ?? [],
      timeZone: params.timeZone ?? hostTimeZone(),
    });
  }
}
