import type { InternalGTProviderProps } from "@generaltranslation/react-core/context";
import type { Dictionary, Translation } from "gt-i18n/types";
import type { Locale, Hash } from "gt-i18n/internal/types";
import { BrowserConditionStoreParams } from "../condition-store/BrowserConditionStore";

/**
 * We force the user to pass translations so they can be synchronously accessed
 */
export type SharedGTProviderProps = InternalGTProviderProps &
  BrowserConditionStoreParams & {
    translations: Record<Locale, Record<Hash, Translation>>;
    dictionary?: Record<Locale, Dictionary>;
  };
