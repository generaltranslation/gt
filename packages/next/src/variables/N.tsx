import { N as RscN, type NProps } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';
import type { GTMarker } from '@generaltranslation/react-core/pure';

export async function N(props: NProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscN {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
N._gtt = { kind: 'variable', variableType: '#' } satisfies GTMarker;
