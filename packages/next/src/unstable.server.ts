'use client';

import { initializeGT } from './setup/initGT';
// Same setup as index.server: no AsyncConditionStore, cache expiry enforced.
initializeGT();

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
  useGT,
  useMessages,
  type Fragment,
  type GT,
  type GTOptions,
  type M,
  type Msg,
  type Placeholder,
} from 'gt-react/unstable';
