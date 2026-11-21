import type { ReactNode } from 'react';
import type { GTMarker } from '../../utils/marker';

type VarProps<T extends ReactNode> = {
  children: T;
  name?: string;
};

// ===== Shared Logic ===== //

function computeVar<T extends ReactNode>({ children }: VarProps<T>): T {
  return children;
}

// ===== Component ===== //

/**
 * External-store version of the `<Var>` component.
 */
function Var<T extends ReactNode>({ children }: VarProps<T>): T {
  return computeVar({ children });
}

function GtInternalVar<T extends ReactNode>({ children }: VarProps<T>): T {
  return computeVar({ children });
}

/** @internal _gtt - The GT transformation for the component. */
Var._gtt = { kind: 'variable', variableType: 'v' } satisfies GTMarker;
GtInternalVar._gtt = {
  kind: 'variable',
  variableType: 'v',
  automatic: true,
} satisfies GTMarker;

// ===== Exports ===== //

export { GtInternalVar, Var, computeVar };
