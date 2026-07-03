// Region
export type UseRegionStateParams = {
  _region: string | undefined;
  ssr: boolean;
  regionCookieName: string;
};

export type UseRegionStateReturn = {
  region: string | undefined;
  setRegion: (region: string | undefined) => void;
};

// Enable I18n
export type UseEnableI18nParams = {
  enableI18n: boolean;
  enableI18nCookieName: string;
  enableI18nLoaded?: boolean;
  ssr: boolean;
};

export type UseEnableI18nReturn = {
  enableI18n: boolean;
};
