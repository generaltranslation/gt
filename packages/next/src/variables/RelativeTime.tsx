import {
  RelativeTime as RscRelativeTime,
  type RelativeTimeProps,
} from '@generaltranslation/react-core/components-rsc';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

export async function RelativeTime(
  props: RelativeTimeProps
): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscRelativeTime {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
RelativeTime._gtt = 'variable-relative-time';
