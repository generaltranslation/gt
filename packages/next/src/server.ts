import T from './server-dir/inline/T';
import tx from './server-dir/strings/tx';
import getLocale from './request/getLocale';
import getI18NConfig from './config-dir/getI18NConfig';
import { getGT } from './server-dir/getGT';

export function getDefaultLocale(): string {
  return getI18NConfig().getDefaultLocale();
}

export { T, tx, getLocale, getGT };
