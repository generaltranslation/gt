// Lightweight entry point exposing only the default cookie-name constants.
// Kept separate from `pure` so edge/middleware consumers can import these
// without pulling in the full pure runtime bundle.
export {
  defaultLocaleCookieName,
  defaultRegionCookieName,
  defaultEnableI18nCookieName,
  defaultResetLocaleCookieName,
} from './utils/cookies';
