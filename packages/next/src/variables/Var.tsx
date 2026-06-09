import { RscVar } from 'gt-react/context';
import { withRequestConditions } from '../request/asyncConditionStore';
import type { ReactNode } from 'react';

type VarProps = Parameters<typeof RscVar>[0];

export async function Var(props: VarProps): Promise<ReactNode> {
  return withRequestConditions(() => RscVar(props));
}

/** @internal _gtt - The GT transformation for the component. */
Var._gtt = 'variable-variable';
