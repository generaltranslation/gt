import { getRequestConditions } from '../../request/getRequestConditions';
import { T as ContextT } from 'gt-react/context';
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

type ContextTComponent = (
  props: TProps & {
    locale: string;
    enableI18n: boolean;
  }
) => ReactNode | Promise<ReactNode>;

/**
 * Build-time translation component that renders its children in the user's given locale.
 */
export async function T(props: TProps): Promise<ReactNode> {
  const { _locale: locale, _enableI18n: enableI18n } =
    await getRequestConditions();
  const renderT = ContextT as ContextTComponent;
  return renderT({ ...props, locale, enableI18n });
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';
