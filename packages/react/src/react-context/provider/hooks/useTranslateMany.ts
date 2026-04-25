import { useMemo } from 'react';
import type { TranslateManyFunction } from '@generaltranslation/react-core';
import type { CustomMapping } from 'generaltranslation/types';

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
  customMapping?: CustomMapping;
  environment: 'development' | 'production' | 'test';
}): TranslateManyFunction | undefined {
  return useMemo<TranslateManyFunction | undefined>(() => {
    if (!devApiKey || environment !== 'development') return undefined;
    let cachedGT: ReturnType<typeof Object.create> = null;
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
  }, [
    devApiKey,
    defaultLocale,
    projectId,
    runtimeUrl,
    customMapping,
    environment,
  ]);
}
