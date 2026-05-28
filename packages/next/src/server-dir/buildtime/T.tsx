import { getLocale } from '../../request/getLocale';
import { RscT } from 'gt-react/context';
import type { ReactNode } from 'react';

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
  const locale = await getLocale();
  return RscT({ ...props, locale });
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';
