import { GtInternalVar as CoreGtInternalVar, Var as CoreVar } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

type VarProps = Parameters<typeof CoreVar>[0];

export async function Var(props: VarProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreVar {...props} {...conditions} />;
}

export async function GtInternalVar(props: VarProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreGtInternalVar {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Var._gtt = 'variable-variable';
GtInternalVar._gtt = 'variable-variable-automatic';
