import { Num as RscNum, type NumProps } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';
import type { GTComponentMetadata } from '@generaltranslation/react-core/pure';

export async function Num(props: NumProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscNum {...props} {...conditions} />;
}

/** @internal _gtt - The GT metadata for the component. */
Num._gtt = {
  kind: 'variable',
  variableType: 'number',
} satisfies GTComponentMetadata;
