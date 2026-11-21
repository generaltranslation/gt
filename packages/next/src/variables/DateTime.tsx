import { DateTime as RscDateTime, type DateTimeProps } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';
import type { GTMarker } from '@generaltranslation/react-core/pure';

export async function DateTime(props: DateTimeProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscDateTime {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
DateTime._gtt = { kind: 'variable', variableType: 'd' } satisfies GTMarker;
