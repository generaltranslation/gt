// React Server Component tagged-template translation surface. No t: it is
// client-rendered (SPA) only, and a server component's useGT() loads the
// request locale first.

import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import type { GT } from 'gt-i18n/unstable';
import { getGT } from 'gt-i18n/unstable/internal';
import { use } from 'react';

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
} from 'gt-i18n/unstable';

/** Returns a GT bound to the request locale once its translations load. */
export function useGT(): GT {
  const conditionStore = getReadonlyConditionStore();
  return use(
    getGT({
      locale: conditionStore.getLocale(),
      enableI18n: conditionStore.getEnableI18n(),
    })
  );
}
