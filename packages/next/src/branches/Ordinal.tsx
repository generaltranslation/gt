import { Ordinal as RscOrdinal, type PluralProps } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';
import type { GTMarker } from '@generaltranslation/react-core/pure';

export async function Ordinal(props: PluralProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscOrdinal {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Ordinal._gtt = { kind: 'ordinal' } satisfies GTMarker;
