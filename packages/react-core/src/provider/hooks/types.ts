export type UseRegionStateParams = {
  _region: string | undefined;
  ssr: boolean;
  regionCookieName: string;
};

export type UseRegionStateReturn = {
  region: string | undefined;
  setRegion: (region: string | undefined) => void;
};
