import { I18nManager } from "gt-i18n/internal";
import type { I18nManagerConstructorParams } from "gt-i18n/internal/types";
import type { Translation } from "gt-i18n/types";

/**
 * initialTranslations required
 */
export type ReactI18nManagerConstructorParams =
  I18nManagerConstructorParams<Translation> &
    Required<
      Pick<I18nManagerConstructorParams<Translation>, "initialTranslations">
    >;

export class ReactI18nManager extends I18nManager<Translation> {
  constructor(config: ReactI18nManagerConstructorParams) {
    super(config);
  }
}
