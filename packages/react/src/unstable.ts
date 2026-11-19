'use client';

// Tagged-template translation entrypoint for client and SSR React runtimes.
// Named exports only: React client boundaries do not support `export *`.

export {
  m,
  t,
  useGT,
  useMessages,
} from '@generaltranslation/react-core/unstable';
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
  time,
  type GT,
  type GTOptions,
  type M,
  type Msg,
  type Part,
  type Placeholder,
} from 'gt-i18n/unstable';
