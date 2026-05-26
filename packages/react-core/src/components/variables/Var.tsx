import type { ReactNode } from 'react';

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
function GtInternalVar<T extends ReactNode>({ children }: VarProps<T>): T {
  return computeVar({ children });
}

function Var<T extends ReactNode>(props: VarProps<T>): React.JSX.Element {
  return <GtInternalVar {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Var._gtt = 'variable-variable';
GtInternalVar._gtt = 'variable-variable-automatic';

// ===== Exports ===== //

export { GtInternalVar, Var, computeVar };
