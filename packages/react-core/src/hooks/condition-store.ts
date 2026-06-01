import { useGTContext } from '../context/context';

/**
 * NOTE: useSetLocale() and useSetEnableI18n() are not implemented in @generaltranslation/react-core
 * Some server environments are read only, so we cannot implement these hooks.
 */

/**
 * Returns the current locale.
 */
export function useLocale(): string {
  const { conditionStore } = useGTContext();
  return conditionStore.getLocale();
}

/**
 * Returns the current enableI18n flag.
 */
export function useEnableI18n(): boolean {
  const { conditionStore } = useGTContext();
  return conditionStore.getEnableI18n();
}
