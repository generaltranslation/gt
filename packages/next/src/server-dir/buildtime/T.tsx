import { getLocale } from '../../request/getLocale';
import { ServerT as CoreServerT } from 'gt-react/context';
import type { TProps } from 'gt-react/context';
import type { ReactNode } from 'react';

/**
 * Next.js RSC wrapper for the core server translation component.
 */
export async function T(props: TProps): Promise<ReactNode> {
  const locale = await getLocale();
  return <CoreServerT locale={locale} {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';
