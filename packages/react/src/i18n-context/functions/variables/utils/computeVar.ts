import { ReactNode } from 'react';

/**
 * Internal implementation of Var component for standardization
 * @internal
 */
export function computeVar<T extends ReactNode>({
  children,
}: {
  children: T;
}): T {
  return children;
}
