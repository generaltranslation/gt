import T from "./server/inline/T";
import tx from "./server/strings/tx";
import getLocale from "./request/getLocale";
import getI18NConfig from "./utils/getI18NConfig";
import { getGT } from "./server/getGT";

export function getDefaultLocale(): string {
    return getI18NConfig().getDefaultLocale();
}

export {
    T, tx, getLocale, getGT
}