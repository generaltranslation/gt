'use client';

import { initializeGT } from './setup/initGT';
// Same setup as index.server: no AsyncConditionStore, cache expiry enforced.
initializeGT();

export {
  date,
  derive,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  useGT,
  type Fragment,
  type GT,
  type GTOptions,
  type Placeholder,
} from 'gt-react/unstable';
