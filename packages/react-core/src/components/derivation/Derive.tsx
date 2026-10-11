import type { ReactNode } from 'react';
import type { GTComponentMetadata } from '../../utils/types';

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

/** @internal _gtt - The GT metadata for the component. */
Derive._gtt = { kind: 'derive' } satisfies GTComponentMetadata;
GtInternalDerive._gtt = {
  kind: 'derive',
  injection: 'automatic',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { GtInternalDerive, Derive };
