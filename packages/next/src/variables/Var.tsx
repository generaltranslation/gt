import { Var as CoreVar } from 'gt-react/context-rsc';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

type VarProps = Parameters<typeof CoreVar>[0];

export async function Var(props: VarProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreVar {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Var._gtt = 'variable-variable';
