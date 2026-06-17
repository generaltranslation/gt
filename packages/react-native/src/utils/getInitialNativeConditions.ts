import type { WritableConditionStoreParams } from 'gt-i18n/internal/types';
import {
  defaultEnableI18nCookieName as defaultEnableI18nStoreKey,
  defaultRegionCookieName as defaultRegionStoreKey,
} from '@generaltranslation/react-core/internal';
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
  regionStoreKey = defaultRegionStoreKey,
}: InitialRegionParams): string | undefined {
  if (region !== undefined) return region;
  return nativeStoreGet(regionStoreKey) || undefined;
}

export function getInitialEnableI18n({
  enableI18n,
  enableI18nStoreKey = defaultEnableI18nStoreKey,
}: InitialEnableI18nParams): boolean {
  if (enableI18n !== undefined) return enableI18n;
  const storedEnableI18n = nativeStoreGet(enableI18nStoreKey);
  if (storedEnableI18n === null) return true;
  return storedEnableI18n === 'true';
}
