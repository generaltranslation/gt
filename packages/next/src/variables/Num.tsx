import { Num as CoreNum, type NumProps } from 'gt-react/context-rsc';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

export async function Num(props: NumProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreNum {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Num._gtt = 'variable-number';
