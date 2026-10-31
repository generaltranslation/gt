import 'server-only';

import { initializeGTServer } from './setup/initGT.server';
initializeGTServer();

export { useGT } from './server-dir/buildtime/unstableStrings';
export {
  date,
  derive,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  type Fragment,
  type GT,
  type GTOptions,
  type Placeholder,
} from '@generaltranslation/react-core/unstable-rsc';
