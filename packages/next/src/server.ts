import T from './server-dir/inline/T';
import tx from './server-dir/strings/tx';
import getLocale from './request/getLocale';
import getI18NConfig from './config-dir/getI18NConfig';
import { getGT } from './server-dir/getGT';
import GTProvider from './provider/GTProvider';
// import TX from './server-dir/inline/TX';

export function getDefaultLocale(): string {
  return getI18NConfig().getDefaultLocale();
}

export { GTProvider, T, tx, getLocale, getGT };
