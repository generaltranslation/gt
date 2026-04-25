import { useMemo } from 'react';
import type { TranslateManyFunction } from '@generaltranslation/react-core';

export function useTranslateMany({
  devApiKey,
  defaultLocale,
  projectId,
  runtimeUrl,
  customMapping,
  environment,
}: {
  devApiKey?: string;
  defaultLocale?: string;
  projectId?: string;
  runtimeUrl?: string | null;
  customMapping?: Record<string, any>;
  environment: 'development' | 'production' | 'test';
}): TranslateManyFunction | undefined {
  return useMemo<TranslateManyFunction | undefined>(() => {
    if (!devApiKey || environment !== 'development') return undefined;
    let cachedGT: any = null;
    return async (sources, options, timeout) => {
      if (!cachedGT) {
        const mod = await import('generaltranslation');
        cachedGT = new mod.GT({
          devApiKey,
          sourceLocale: defaultLocale,
          projectId,
          baseUrl: runtimeUrl || undefined,
          customMapping,
        });
      }
      return cachedGT.translateMany(sources, options, timeout);
    };
  }, [devApiKey, defaultLocale, projectId, runtimeUrl, customMapping, environment]);
}
