import { useEffect, useState } from 'react';

function getNewRegion({
  _region,
  regionCookieName,
}: {
  _region: string | undefined;
  regionCookieName: string;
}) {
  // Check for region in cookie
  const cookieRegion =
    typeof document !== 'undefined'
      ? document.cookie
          .split('; ')
          .find((row) => row.startsWith(`${regionCookieName}=`))
          ?.split('=')[1]
      : undefined;

  const newRegion = _region || cookieRegion;

  // if cookie not valid, change it to newRegion
  if (
    cookieRegion &&
    cookieRegion !== newRegion &&
    typeof document !== 'undefined'
  ) {
    document.cookie = `${regionCookieName}=${newRegion};path=/`;
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
    ssr
      ? undefined
      : getNewRegion({
          _region,
          regionCookieName,
        })
  );
  const setRegion = (region: string | undefined) => {
    _setRegion(region);
    if (typeof document !== 'undefined') {
      document.cookie = `${regionCookieName}=${region};path=/`;
    }
  };
  useEffect(() => {
    _setRegion(getNewRegion({ _region, regionCookieName }));
  }, [_region, regionCookieName]);
  return {
    region,
    setRegion,
  };
}
