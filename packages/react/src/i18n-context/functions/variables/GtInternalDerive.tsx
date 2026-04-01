import { ReactNode } from 'react';

/**
 * Equivalent to the `<Derive>` component, but used for auto insertion
 */
function GtInternalDerive<T extends ReactNode>({
  children,
}: {
  children: T;
}): ReactNode {
  return children;
}

export { GtInternalDerive, GtInternalDerive as Derive };
