// React Server Component tagged-template translation surface.

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
  t,
  type Fragment,
  type GT,
  type GTOptions,
  type Placeholder,
} from '@generaltranslation/react-core/unstable-rsc';

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
