import { Plural as CorePlural } from 'gt-react/context';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

type PluralProps = Parameters<typeof CorePlural>[0];

export async function Plural(props: PluralProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CorePlural {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Plural._gtt = 'plural';
