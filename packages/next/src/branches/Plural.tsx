import { RscPlural } from 'gt-react/context';
import { withRequestConditions } from '../request/asyncConditionStore';
import type { ReactNode } from 'react';

type PluralProps = Parameters<typeof RscPlural>[0];

export async function Plural(props: PluralProps): Promise<ReactNode> {
  return withRequestConditions(() => RscPlural(props));
}

/** @internal _gtt - The GT transformation for the component. */
Plural._gtt = 'plural';
