import { useEffect, useState } from 'react';
import { getCookieValue, setCookieValue } from '../../../shared/cookies';

function getNewRegion(
  _region: string | undefined,
  regionCookieName: string
) {
  // Check for region in cookie
  const cookieRegion = getCookieValue(regionCookieName);
  const newRegion = _region || cookieRegion;

  // if cookie not valid, change it to newRegion
  if (cookieRegion && cookieRegion !== newRegion) {
    setCookieValue(regionCookieName, newRegion || '');
  }
  return newRegion;
}

export function useRegionState({
  _region,
  ssr,
  regionCookieName,
}: {
  _region: string | undefined;
  ssr: boolean;
  regionCookieName: string;
}) {
  const [region, _setRegion] = useState<string | undefined>(
    ssr ? undefined : getNewRegion(_region, regionCookieName)
  );
  const setRegion = (region: string | undefined) => {
    _setRegion(region);
    setCookieValue(regionCookieName, region || '');
  };
  useEffect(() => {
    _setRegion(getNewRegion(_region, regionCookieName));
  }, [_region, regionCookieName]);
  return {
    region,
    setRegion,
  };
}
