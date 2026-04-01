import { ReactNode } from 'react';

/**
 * Equivalent to the `<Derive>` component, but used for auto insertion
 *
 * TODO: traverse children and remove any injected T components. This will prevent them from
 * executing and perhaps creating a false positive resolution.
 */
function GtInternalDerive<T extends ReactNode>({
  children,
}: {
  children: T;
}): ReactNode {
  return children;
}

export { GtInternalDerive, GtInternalDerive as Derive };
