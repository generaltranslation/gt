import type { ReactNode } from 'react';

type DeriveProps<T extends ReactNode> = {
  children: T;
};

// ===== Component ===== //

function GtInternalDerive<T extends ReactNode>({
  children,
}: DeriveProps<T>): T {
  return children;
}

function Derive<T extends ReactNode>(props: DeriveProps<T>): React.JSX.Element {
  return <GtInternalDerive {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Derive._gtt = 'derive';
GtInternalDerive._gtt = 'derive-automatic';

// ===== Exports ===== //

export { GtInternalDerive, Derive };
