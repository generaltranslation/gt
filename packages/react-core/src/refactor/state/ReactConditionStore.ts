import type {
  ConditionStoreConfig,
  WritableConditionStore,
  LocaleCandidates,
} from "gt-i18n/internal/types";
import { createLocaleResolver } from "gt-i18n/internal";

export type ReactConditionStoreParams = ConditionStoreConfig & {
  locale: string;
};

export class ReactConditionStore implements WritableConditionStore {
  private locale: string;
  private resolveLocale: (candidates?: LocaleCandidates) => string;

  constructor({
    locale,
    defaultLocale,
    locales,
    customMapping,
  }: ReactConditionStoreParams) {
    this.locale = locale;
    this.resolveLocale = createLocaleResolver({
      defaultLocale,
      locales,
      customMapping,
    });
  }

  getLocale(): string {
    return this.locale;
  }

  setLocale(locale: string): void {
    this.locale = this.resolveLocale(locale);
  }
}
