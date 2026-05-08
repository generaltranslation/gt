import type { ReactNode } from 'react';

// ===== Component ===== //

function Derive<T extends ReactNode>({ children }: { children: T }): T {
  return children;
}

function Static<T extends ReactNode>(props: { children: T }): T {
  return Derive(props);
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
Static._gtt = 'derive';
GtInternalDerive._gtt = 'derive-automatic';

// ===== Exports ===== //

export { GtInternalDerive, Derive, Static };
