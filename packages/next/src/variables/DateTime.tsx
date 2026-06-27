import {
  DateTime as RscDateTime,
  type DateTimeProps,
} from '@generaltranslation/react-core/components-rsc';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

export async function DateTime(props: DateTimeProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscDateTime {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
DateTime._gtt = 'variable-datetime';
