import { useRef, type ReactNode } from 'react';
import { getI18nConfig } from 'gt-i18n/internal';

export function useComputeTDev(
  result: ReactNode,
  shouldTranslate: boolean,
  targetFound: boolean
): ReactNode {
  const previousResult = useRef<ReactNode | null>(null);

  if (
    getI18nConfig().isDevHotReloadEnabled() &&
    !targetFound &&
    previousResult.current != null &&
    shouldTranslate
  ) {
    return previousResult.current;
  }

  previousResult.current = result;
  return result;
}
