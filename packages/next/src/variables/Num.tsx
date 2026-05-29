import { Num as CoreNum } from 'gt-react/context';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

type NumProps = Parameters<typeof CoreNum>[0];

export async function Num(props: NumProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreNum {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Num._gtt = 'variable-number';
