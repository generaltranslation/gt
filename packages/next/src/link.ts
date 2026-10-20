'use client';

// Match `next/link` so switching to `gt-next/link` only changes the package.
export { Link as default } from './link/Link';
export type { LinkProps } from './link/Link';
export { useLocalizeHref } from './link/useLocalizeHref';
export type { LinkLocale } from './link/localize-utils';
