import type { GT } from 'gt-i18n/unstable';
import { getGT as getGTForLocale } from 'gt-i18n/unstable/internal';
import { getRequestConditions } from '../../request/getRequestConditions';
import { use } from '../../utils/use';

/** Loads the request locale's translations, then returns a GT bound to it. */
export async function getGT(): Promise<GT> {
  const conditions = await getRequestConditions();
  return getGTForLocale({
    locale: conditions._locale,
    enableI18n: conditions._enableI18n,
  });
}

export function useGT(): GT {
  return use(getGT());
}
