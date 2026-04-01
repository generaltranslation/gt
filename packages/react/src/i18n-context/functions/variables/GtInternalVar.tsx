import { ReactNode } from 'react';

/**
 * Equivalent to the `<Var>` component, but used for auto insertion
 */
function GtInternalVar<T extends ReactNode>({
  children,
}: {
  children: T;
  name?: string;
}): T {
  return children;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalVar._gtt = 'variable-variable';

export { GtInternalVar };
