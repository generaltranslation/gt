import { RscCurrency } from 'gt-react/context';
import { withRequestConditions } from '../request/asyncConditionStore';
import type { ReactNode } from 'react';

type CurrencyProps = Parameters<typeof RscCurrency>[0];

export async function Currency(props: CurrencyProps): Promise<ReactNode> {
  return withRequestConditions(() => RscCurrency(props));
}

/** @internal _gtt - The GT transformation for the component. */
Currency._gtt = 'variable-currency';
