import { ReactNode } from 'react';
import { computeVar } from './utils/computeVar';

/**
 * Equivalent to the `<Var>` component, but used for auto insertion
 */
function GtInternalVar<T extends ReactNode>({
  children,
}: {
  children: T;
  name?: string;
}): T {
  return computeVar({ children });
}

/**
 * User facing version of the Var component
 */
function Var<T extends ReactNode>({
  children,
}: {
  children: T;
  name?: string;
}): T {
  return computeVar({ children });
}

/** @internal _gtt - The GT transformation and injection identifier for the component. */
Var._gtt = 'variable-variable';
GtInternalVar._gtt = 'variable-variable-automatic';

export { GtInternalVar, Var };
