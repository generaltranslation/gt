import { RelativeTime as CoreRelativeTime } from 'gt-react/context';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

type RelativeTimeProps = Parameters<typeof CoreRelativeTime>[0];

export async function RelativeTime(
  props: RelativeTimeProps
): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreRelativeTime {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
RelativeTime._gtt = 'variable-relative-time';
