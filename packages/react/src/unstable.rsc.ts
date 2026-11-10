// React Server Component tagged-template translation surface. No t: it is
// client-rendered (SPA) only, and a server component's useGT() and
// useMessages() load the request locale first.

import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import type { GT, M } from 'gt-i18n/unstable';
import { getGT, getMessages } from 'gt-i18n/unstable/internal';
import { use } from 'react';

export {
  date,
  derive,
  mFallback,
  msg,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  time,
  type Fragment,
  type GT,
  type GTOptions,
  type M,
  type Msg,
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

/** Returns an m bound to the request locale once its translations load. */
export function useMessages(): M {
  const conditionStore = getReadonlyConditionStore();
  return use(
    getMessages({
      locale: conditionStore.getLocale(),
      enableI18n: conditionStore.getEnableI18n(),
    })
  );
}
