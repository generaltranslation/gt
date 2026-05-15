import type { WritableConditionStore as WritableConditionStoreContract } from "../types";
import {
  ReadonlyConditionStore,
  type ReadonlyConditionStoreParams,
} from "./ReadonlyConditionStore";

export type WritableConditionStoreParams = ReadonlyConditionStoreParams;

export class WritableConditionStore
  extends ReadonlyConditionStore
  implements WritableConditionStoreContract
{
  setLocale = (locale: string): void => {
    this.locale = this.resolveLocale(locale);
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.enableI18n = enableI18n;
  };
}
