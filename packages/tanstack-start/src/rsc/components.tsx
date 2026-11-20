import type { ReactNode } from 'react';
import {
  Currency as RscCurrency,
  DateTime as RscDateTime,
  GtInternalVar as RscGtInternalVar,
  N as RscN,
  Num as RscNum,
  Plural as RscPlural,
  RelativeTime as RscRelativeTime,
  T as RscT,
  Var as RscVar,
  type CurrencyProps,
  type DateTimeProps,
  type NProps,
  type NumProps,
  type PluralProps,
  type RelativeTimeProps,
  type TProps,
} from '@generaltranslation/react-core/components-rsc';
import { getServerConditionStore } from 'gt-tanstack-start/internal/initializeGT.server';

type VarProps = Parameters<typeof RscVar>[0];

// A server component has no context to read the request's locale from, so
// each component is given it from the request.
function getRequestConditions() {
  const store = getServerConditionStore();
  return { _locale: store.getLocale(), _enableI18n: store.getEnableI18n() };
}

export function T(props: TProps): Promise<ReactNode> {
  return RscT({ ...props, ...getRequestConditions() });
}

export function GtInternalTranslateJsx(props: TProps): Promise<ReactNode> {
  return RscT({ ...props, ...getRequestConditions() });
}

export function Var(props: VarProps): ReactNode {
  return <RscVar {...props} {...getRequestConditions()} />;
}

export function GtInternalVar(props: VarProps): ReactNode {
  return <RscGtInternalVar {...props} {...getRequestConditions()} />;
}

export function N(props: NProps): ReactNode {
  return <RscN {...props} {...getRequestConditions()} />;
}

export function Num(props: NumProps): ReactNode {
  return <RscNum {...props} {...getRequestConditions()} />;
}

export function Currency(props: CurrencyProps): ReactNode {
  return <RscCurrency {...props} {...getRequestConditions()} />;
}

export function DateTime(props: DateTimeProps): ReactNode {
  return <RscDateTime {...props} {...getRequestConditions()} />;
}

export function RelativeTime(props: RelativeTimeProps): ReactNode {
  return <RscRelativeTime {...props} {...getRequestConditions()} />;
}

export function Plural(props: PluralProps): ReactNode {
  return <RscPlural {...props} {...getRequestConditions()} />;
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';
GtInternalTranslateJsx._gtt = 'translate-server-automatic';
Var._gtt = 'variable-variable';
GtInternalVar._gtt = 'variable-variable-automatic';
N._gtt = 'variable-count';
Num._gtt = 'variable-number';
Currency._gtt = 'variable-currency';
DateTime._gtt = 'variable-datetime';
RelativeTime._gtt = 'variable-relativetime';
Plural._gtt = 'plural';
