import type { ReactNode } from 'react';

type VarProps<T extends ReactNode> = {
  children: T;
  name?: string;
};

/**
 * Equivalent to the `<Var>` component, but used for auto insertion
 */
function GtInternalVar<T extends ReactNode>({ children }: VarProps<T>): T {
  return children;
}

/**
 * User facing version of the Var component
 */
function Var<T extends ReactNode>({ children }: VarProps<T>): T {
  return children;
}

/** @internal _gtt - The GT transformation and injection identifier for the component. */
Var._gtt = 'variable-variable';
GtInternalVar._gtt = 'variable-variable-automatic';

export { GtInternalVar, Var };
