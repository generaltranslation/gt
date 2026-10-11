import {
  RelativeTime as RscRelativeTime,
  type RelativeTimeProps,
} from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';
import type { GTComponentMetadata } from '@generaltranslation/react-core/pure';

export async function RelativeTime(
  props: RelativeTimeProps
): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscRelativeTime {...props} {...conditions} />;
}

/** @internal _gtt - The GT metadata for the component. */
RelativeTime._gtt = {
  kind: 'variable',
  variableType: 'relative-time',
} satisfies GTComponentMetadata;
