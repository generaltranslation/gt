/**
 * `gt-react/experimental` under the `react-server` condition: every gt-react
 * React Server Components export plus the locale twin exports that need no
 * hooks. Locale twins render through the client and SSR entry points
 * (TanStack Start, Vite SPAs); React Server Components keep the regular
 * components.
 *
 * No 'use client' directive: the build keeps the regular entry external.
 */
export * from '../index.rsc';
export {
  GtInternalRegisterLocaleTwin,
  markNavigatingReload,
  msg,
  applyLocaleTwinDocumentHeaders,
  createLocaleTwinDocument,
  getLocaleTwinAssetHeaders,
  getLocaleTwinDocumentHeaders,
  resolveLocaleTwinLocale,
} from 'gt-i18n/internal/experimental';
export type {
  CreateLocaleTwinDocumentOptions,
  LocaleTwinDocument,
  LocaleTwinHeaderRecord,
  LocaleTwinRequestLike,
  ResolveLocaleTwinLocaleOptions,
} from 'gt-i18n/internal/experimental';
