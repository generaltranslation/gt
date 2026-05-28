import type { ReactNode } from 'react';
import { ServerT } from 'gt-react/context';
import type { ServerTProps } from 'gt-react/context';
import { getLocale } from '../../request/getLocale';

type TProps = Omit<ServerTProps, 'locale'>;

export async function T(props: TProps): Promise<ReactNode> {
  const locale = await getLocale();
  return <ServerT {...props} locale={locale} />;
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';
