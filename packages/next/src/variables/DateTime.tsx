import { RscDateTime } from 'gt-react/context';
import { withRequestConditions } from '../request/asyncConditionStore';
import type { ReactNode } from 'react';

type DateTimeProps = Parameters<typeof RscDateTime>[0];

export async function DateTime(props: DateTimeProps): Promise<ReactNode> {
  return withRequestConditions(() => RscDateTime(props));
}

/** @internal _gtt - The GT transformation for the component. */
DateTime._gtt = 'variable-datetime';
