import { Num as RscNum, type NumProps } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

export async function Num(props: NumProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscNum {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Num._gtt = 'variable-number';
