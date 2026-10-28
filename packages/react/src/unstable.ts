'use client';

// Tagged-template translation entrypoint for client and SSR React runtimes.
// Named exports only: React client boundaries do not support `export *`.

export { t, useGT, useMessages } from '@generaltranslation/react-core/unstable';
export {
  date,
  derive,
  mFallback,
  msg,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  type Fragment,
  type GT,
  type GTOptions,
  type M,
  type Msg,
  type Placeholder,
} from 'gt-i18n/unstable';
