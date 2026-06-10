import { DateTime as CoreDateTime, type DateTimeProps } from 'gt-react/context';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

export async function DateTime(props: DateTimeProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreDateTime {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
DateTime._gtt = 'variable-datetime';
