import { Currency as RscCurrency, type CurrencyProps } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';
import type { GTComponentMetadata } from '@generaltranslation/react-core/pure';

export async function Currency(props: CurrencyProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscCurrency {...props} {...conditions} />;
}

/** @internal _gtt - The GT metadata for the component. */
Currency._gtt = {
  kind: 'variable',
  variableType: 'currency',
} satisfies GTComponentMetadata;
