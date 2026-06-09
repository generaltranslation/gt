import { RscT } from 'gt-react/context';
import type { ReactNode } from 'react';
import { withRequestConditions } from '../../request/asyncConditionStore';

type TProps = {
  children: ReactNode;
  id?: string;
  context?: string;
  _hash?: string;
  $id?: string;
  $context?: string;
  $maxChars?: number;
  [key: string]: ReactNode;
};

/**
 * Build-time translation component that renders its children in the user's given locale.
 */
export async function T(props: TProps): Promise<ReactNode> {
  return withRequestConditions(({ locale, enableI18n }) =>
    RscT({ ...props, locale, enableI18n })
  );
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';
