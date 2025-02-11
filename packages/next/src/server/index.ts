import T from './inline/T';
import tx from './strings/tx';
import getLocale from '../request/getLocale';
import getI18NConfig from '../config/getI18NConfig';
import { getGT } from './getGT';

export function getDefaultLocale(): string {
  return getI18NConfig().getDefaultLocale();
}

export { T, tx, getLocale, getGT };
