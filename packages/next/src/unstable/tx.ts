import { createTx, type TX } from 'gt-i18n/unstable/internal';
import { getRequestConditions } from '../request/getRequestConditions';

/**
 * Translates in the request locale, sending a missing translation for
 * runtime translation and waiting for it.
 *
 * @example
 * const label = await tx({ context: 'button' })`Save`;
 */
export const tx: TX = /* @__PURE__ */ createTx(async () => {
  const conditions = await getRequestConditions();
  return { locale: conditions._locale, enableI18n: conditions._enableI18n };
});
