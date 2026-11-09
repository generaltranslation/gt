import 'server-only';

import { initializeGTServer } from './setup/initGT.server';
initializeGTServer();

export { useGT, useMessages } from './unstable/getGT';
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
  type Fragment,
  type GT,
  type GTOptions,
  type M,
  type Msg,
  type Placeholder,
} from 'gt-i18n/unstable';
