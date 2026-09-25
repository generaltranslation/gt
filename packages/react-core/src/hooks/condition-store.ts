import { getReadonlyConditionStore } from '../condition-store/singleton-operations';
import { useGTContext } from '../context/context';

/**
 * Returns the current locale.
 */
export function useLocale(): string {
  const context = useGTContext();
  return context ? context.locale : getReadonlyConditionStore().getLocale();
}

/**
 * Returns the current region, or undefined if no region is set.
 */
export function useRegion(): string | undefined {
  const context = useGTContext();
  return context ? context.region : getReadonlyConditionStore().getRegion();
}

/**
 * Returns the current enableI18n flag.
 */
export function useEnableI18n(): boolean {
  const context = useGTContext();
  return context
    ? context.enableI18n
    : getReadonlyConditionStore().getEnableI18n();
}

export function useSetLocale(): (locale: string) => void {
  const context = useGTContext();
  return context ? context.setLocale : getReadonlyConditionStore().setLocale;
}

export function useSetRegion(): (region: string | undefined) => void {
  const context = useGTContext();
  return context ? context.setRegion : getReadonlyConditionStore().setRegion;
}

export function useSetEnableI18n(): (enabled: boolean) => void {
  const context = useGTContext();
  return context
    ? context.setEnableI18n
    : getReadonlyConditionStore().setEnableI18n;
}
