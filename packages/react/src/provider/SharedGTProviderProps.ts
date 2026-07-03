import type { InternalGTProviderProps } from "@generaltranslation/react-core/context";
import type { Dictionary, Translation } from "gt-i18n/types";
import type {
  Locale,
  Hash,
  ReadonlyConditionStoreParams,
} from "gt-i18n/internal/types";

/**
 * We force the user to pass translations so they can be synchronously accessed
 */
export type SharedGTProviderProps = InternalGTProviderProps &
  ReadonlyConditionStoreParams & {
    translations: Record<Locale, Record<Hash, Translation>>;
    dictionary?: Record<Locale, Dictionary>;
  };
