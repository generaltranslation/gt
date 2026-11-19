'use client';

import { initializeGT } from './setup/initGT';
// Same setup as index.server: no AsyncConditionStore, cache expiry enforced.
initializeGT();

export { useGT, useMessages } from 'gt-react/unstable';
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
