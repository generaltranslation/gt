import { DateTime as RscDateTime, type DateTimeProps } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

export async function DateTime(props: DateTimeProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscDateTime {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
DateTime._gtt = 'variable-datetime';
