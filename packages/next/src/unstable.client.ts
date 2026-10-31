'use client';

import { initializeGTClient } from './setup/initGT.client';
initializeGTClient();

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
