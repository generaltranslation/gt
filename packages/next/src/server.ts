import T from './server-dir/buildtime/T';
import tx from './server-dir/runtime/tx';
import getLocale from './request/getLocale';
import getI18NConfig from './config-dir/getI18NConfig';
import getDict from './server-dir/buildtime/getDict';
import GTProvider from './provider/GTProvider';
import Tx from './server-dir/runtime/_Tx';
import getGT from './server-dir/buildtime/getGT';

export function getDefaultLocale(): string {
  return getI18NConfig().getDefaultLocale();
}

export {
  GTProvider,
  T,
  getGT,
  tx,
  Tx,
  getLocale, // getDefaultLocale
  getDict,
};
