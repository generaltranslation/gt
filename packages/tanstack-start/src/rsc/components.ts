import {
  Currency as RscCurrency,
  DateTime as RscDateTime,
  N as RscN,
  Num as RscNum,
  Ordinal as RscOrdinal,
  Plural as RscPlural,
  RelativeTime as RscRelativeTime,
  T as RscT,
  withRequestConditions,
  type RequestConditions,
} from '@generaltranslation/react-core/components-rsc';
import { getServerConditionStore } from 'gt-tanstack-start/internal/initializeGT.server';

function getRequestConditions(): RequestConditions {
  const store = getServerConditionStore();
  return { _locale: store.getLocale(), _enableI18n: store.getEnableI18n() };
}

export const T = withRequestConditions(RscT, getRequestConditions);
export const GtInternalTranslateJsx = withRequestConditions(
  RscT,
  getRequestConditions,
  { kind: 'translate', automatic: true }
);
export const N = withRequestConditions(RscN, getRequestConditions);
export const Num = withRequestConditions(RscNum, getRequestConditions);
export const Currency = withRequestConditions(
  RscCurrency,
  getRequestConditions
);
export const DateTime = withRequestConditions(
  RscDateTime,
  getRequestConditions
);
export const RelativeTime = withRequestConditions(
  RscRelativeTime,
  getRequestConditions
);
export const Plural = withRequestConditions(RscPlural, getRequestConditions);
export const Ordinal = withRequestConditions(RscOrdinal, getRequestConditions);
