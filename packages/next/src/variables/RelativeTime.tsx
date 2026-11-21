import {
  RelativeTime as RscRelativeTime,
  type RelativeTimeProps,
} from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';
import type { GTMarker } from '@generaltranslation/react-core/pure';

export async function RelativeTime(
  props: RelativeTimeProps
): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscRelativeTime {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
RelativeTime._gtt = { kind: 'variable', variableType: 'rt' } satisfies GTMarker;
