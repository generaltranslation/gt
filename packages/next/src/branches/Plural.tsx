import { Plural as RscPlural, type PluralProps } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';
import type { GTComponentMetadata } from '@generaltranslation/react-core/pure';

export async function Plural(props: PluralProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <RscPlural {...props} {...conditions} />;
}

/** @internal _gtt - The GT metadata for the component. */
Plural._gtt = { kind: 'plural' } satisfies GTComponentMetadata;
