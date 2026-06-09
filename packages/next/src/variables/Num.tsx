import { RscNum } from 'gt-react/context';
import { withRequestConditions } from '../request/asyncConditionStore';
import type { ReactNode } from 'react';

type NumProps = Parameters<typeof RscNum>[0];

export async function Num(props: NumProps): Promise<ReactNode> {
  return withRequestConditions(() => RscNum(props));
}

/** @internal _gtt - The GT transformation for the component. */
Num._gtt = 'variable-number';
