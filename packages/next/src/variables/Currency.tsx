import { Currency as CoreCurrency } from 'gt-react/context';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

type CurrencyProps = Parameters<typeof CoreCurrency>[0];

export async function Currency(props: CurrencyProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreCurrency {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Currency._gtt = 'variable-currency';
