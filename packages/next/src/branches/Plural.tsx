import { Plural as CorePlural, type PluralProps } from 'gt-react/context-rsc';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

export async function Plural(props: PluralProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CorePlural {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Plural._gtt = 'plural';
