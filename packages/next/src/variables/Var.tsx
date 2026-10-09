import { GtInternalVar as CoreGtInternalVar, Var as CoreVar } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';
import type { GTComponentMetadata } from '@generaltranslation/react-core/pure';

type VarProps = Parameters<typeof CoreVar>[0];

export async function Var(props: VarProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreVar {...props} {...conditions} />;
}

export async function GtInternalVar(props: VarProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreGtInternalVar {...props} {...conditions} />;
}

/** @internal _gtt - The GT metadata for the component. */
Var._gtt = {
  kind: 'variable',
  variableType: 'variable',
} satisfies GTComponentMetadata;
GtInternalVar._gtt = {
  kind: 'variable',
  variableType: 'variable',
  injection: 'automatic',
} satisfies GTComponentMetadata;
