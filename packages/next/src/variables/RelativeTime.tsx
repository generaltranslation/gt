import { RscRelativeTime } from 'gt-react/context';
import { withRequestConditions } from '../request/asyncConditionStore';
import type { ReactNode } from 'react';

type RelativeTimeProps = Parameters<typeof RscRelativeTime>[0];

export async function RelativeTime(
  props: RelativeTimeProps
): Promise<ReactNode> {
  return withRequestConditions(() => RscRelativeTime(props));
}

/** @internal _gtt - The GT transformation for the component. */
RelativeTime._gtt = 'variable-relative-time';
