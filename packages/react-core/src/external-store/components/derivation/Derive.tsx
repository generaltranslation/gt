import type { ReactNode } from 'react';

// ===== Component ===== //

function Derive<T extends ReactNode>({ children }: { children: T }): T {
  return children;
}

function GtInternalDerive<T extends ReactNode>({
  children,
}: {
  children: T;
}): T {
  return children;
}

/** @internal _gtt - The GT transformation for the component. */
Derive._gtt = 'derive';
GtInternalDerive._gtt = 'derive-automatic';

// ===== Exports ===== //

export { GtInternalDerive, Derive };
