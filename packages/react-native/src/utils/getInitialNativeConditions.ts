import type { WritableConditionStoreParams } from 'gt-i18n/internal/types';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { nativeStoreGet } from './nativeStore';

type InitialRegionParams = Pick<WritableConditionStoreParams, 'region'> & {
  regionStoreKey?: string;
};

type InitialEnableI18nParams = Pick<
  WritableConditionStoreParams,
  'enableI18n'
> & {
  enableI18nStoreKey?: string;
};

export function getInitialRegion({
  region,
  regionStoreKey = getI18nConfig().getRegionCookieName(),
}: InitialRegionParams): string | undefined {
  if (region !== undefined) return region;
  return nativeStoreGet(regionStoreKey) || undefined;
}

export function getInitialEnableI18n({
  enableI18n,
  enableI18nStoreKey = getI18nConfig().getEnableI18nCookieName(),
}: InitialEnableI18nParams): boolean {
  if (enableI18n !== undefined) return enableI18n;
  const storedEnableI18n = nativeStoreGet(enableI18nStoreKey);
  if (storedEnableI18n === null) return true;
  return storedEnableI18n === 'true';
}
