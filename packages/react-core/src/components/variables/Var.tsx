import type { ReactNode } from 'react';

type VarProps<T extends ReactNode> = {
  children: T;
  name?: string;
};

type GtInternalVarProps<T extends ReactNode> = VarProps<T> & {
  /** Accepted for renderVariable parity; raw variables are locale-independent. */
  _locale?: string;
  _enableI18n?: boolean;
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

function GtInternalVar<T extends ReactNode>({
  children,
}: GtInternalVarProps<T>): T {
  return computeVar({ children });
}

/** @internal _gtt - The GT transformation for the component. */
Var._gtt = 'variable-variable';
GtInternalVar._gtt = 'variable-variable-automatic';

// ===== Exports ===== //

export { GtInternalVar, Var, computeVar };
