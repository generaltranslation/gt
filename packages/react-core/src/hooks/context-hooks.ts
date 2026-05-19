import { GTContext, GTContextType } from "../context/GTContext";
import { getRenderStrategy } from "../setup/globals";
import { getWritableConditionStore } from "../condition-store/singleton-operations";
import { useContext } from "react";
import { getReactI18nManager } from "../i18n-manager/singleton-operations";
import type { LocaleProperties } from "@generaltranslation/format/types";
import type { GT } from "generaltranslation";

/**
 * @internal
 */
function useGTContext(property: keyof GTContextType): GTContextType {
  const conditionStore = useContext(GTContext);
  if (!conditionStore) {
    if (getRenderStrategy() === "SPA") {
      // No need for useSyncExternalStore for SPA apps as reload will always trigger a re-render
      const conditionStore = getWritableConditionStore();
      return {
        locale: conditionStore.getLocale(),
        enableI18n: conditionStore.getEnableI18n(),
        setLocale: conditionStore.setLocale,
        setEnableI18n: conditionStore.setEnableI18n,
      };
    }
    throw new Error(
      `use${(property as string).charAt(0).toUpperCase() + (property as string).slice(1)}() is being accessed outside of a <GTProvider>. Make sure to add a <GTProvider> to the top of your component tree.`,
    );
  }
  return conditionStore;
}

export function useLocale(): string {
  return useGTContext("locale").locale;
}

/**
 * Returns the configured GT class instance.
 *
 * @returns {GT} The configured GT class instance.
 *
 * @example
 * const gt = useGTClass();
 * console.log(gt.getLocaleProperties("en-US"));
 */
export function useGTClass(): GT {
  return getReactI18nManager().getGTClass(useLocale());
}

/**
 * Returns the locale properties for the given locale.
 *
 * @param locale - The locale to get the properties for.
 * @returns The locale properties for the given locale.
 *
 * @example
 * const localeProperties = useLocaleProperties("en-US");
 * console.log(localeProperties);
 */
export function useLocaleProperties(locale: string): LocaleProperties {
  return useGTClass().getLocaleProperties(locale);
}

/**
 * Retrieves the text direction ("ltr" or "rtl") for the current or specified locale.
 *
 * If no locale is provided, the direction for the current user's locale is returned.
 *
 * @param locale - Optional locale code (e.g., "ar", "en-US"). If omitted, uses the current locale from context.
 * @returns The text direction for the locale: "rtl" for right-to-left languages, otherwise "ltr".
 *
 * @example
 * const dir = useLocaleDirection(); // e.g., "ltr"
 * const arabicDir = useLocaleDirection("ar"); // "rtl"
 */
export function useLocaleDirection(locale?: string): "ltr" | "rtl" {
  return useGTClass().getLocaleDirection(locale);
}

/**
 * Retrieves the version ID from the `<GTProvider>` context.
 *
 * @returns The version ID for the current source, if set.
 *
 * @example
 * const versionId = useVersionId();
 * console.log(versionId); // "abc123"
 */
export function useVersionId(): string | undefined {
  return getReactI18nManager().getVersionId();
}

export function useSetLocale(): (locale: string) => void {
  return useGTContext("setLocale").setLocale;
}

export function useEnableI18n(): boolean {
  return useGTContext("enableI18n").enableI18n;
}

export function useSetEnableI18n(): (enableI18n: boolean) => void {
  return useGTContext("setEnableI18n").setEnableI18n;
}
