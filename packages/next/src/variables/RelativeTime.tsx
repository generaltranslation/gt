import {
  RelativeTime as CoreRelativeTime,
  type RelativeTimeProps,
} from 'gt-react/context';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

export async function RelativeTime(
  props: RelativeTimeProps
): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreRelativeTime {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
RelativeTime._gtt = 'variable-relative-time';
