import { useEffect, useState } from 'react';
import type {
  UseRegionStateParams,
  UseRegionStateReturn,
} from '@generaltranslation/react-core/types';
import { nativeStoreGet, nativeStoreSet } from '../../utils/nativeStore';

function getNewRegion({
  _region,
  regionCookieName,
}: {
  _region: string | undefined;
  regionCookieName: string;
}) {
  // Check for region in native store
  const cookieRegion = nativeStoreGet(regionCookieName) || undefined;
  const newRegion = _region || cookieRegion;

  // if state not valid, change it to newRegion
  if (cookieRegion && cookieRegion !== newRegion) {
    nativeStoreSet(regionCookieName, newRegion || '');
  }

  return newRegion;
}

export function useRegionState({
  _region,
  ssr,
  regionCookieName,
}: UseRegionStateParams): UseRegionStateReturn {
  const [region, _setRegion] = useState<string | undefined>(
    ssr
      ? undefined
      : getNewRegion({
          _region,
          regionCookieName,
        })
  );
  const setRegion = (newRegion: string | undefined) => {
    _setRegion(newRegion);
    nativeStoreSet(regionCookieName, newRegion || '');
  };
  useEffect(() => {
    _setRegion(getNewRegion({ _region, regionCookieName }));
  }, [_region, regionCookieName]);
  return {
    region,
    setRegion,
  };
}
