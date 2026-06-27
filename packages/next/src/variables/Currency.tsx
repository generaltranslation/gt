import {
  Currency as RscCurrency,
  type CurrencyProps,
} from '@generaltranslation/react-core/components-rsc';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

export async function Currency(props: CurrencyProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscCurrency {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Currency._gtt = 'variable-currency';
