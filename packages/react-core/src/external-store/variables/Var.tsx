import type { ReactNode } from 'react';

// ===== Shared Logic ===== //

function computeVar<T extends ReactNode>({ children }: { children: T }): T {
  return children;
}

// ===== Component ===== //

/**
 * External-store version of the `<Var>` component.
 */
function Var<T extends ReactNode>({
  children,
}: {
  children: T;
  name?: string;
}): T {
  return computeVar({ children });
}

function GtInternalVar<T extends ReactNode>({
  children,
}: {
  children: T;
  name?: string;
}): T {
  return computeVar({ children });
}

/** @internal _gtt - The GT transformation for the component. */
Var._gtt = 'variable-variable';
GtInternalVar._gtt = 'variable-variable-automatic';

// ===== Exports ===== //

export { GtInternalVar, Var, computeVar };
