import type { ReactNode } from 'react';
import type { GTComponentMetadata } from '../../utils/types';

type VarProps<T extends ReactNode> = {
  children: T;
  name?: string;
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

function GtInternalVar<T extends ReactNode>({ children }: VarProps<T>): T {
  return computeVar({ children });
}

/** @internal _gtt - The GT metadata for the component. */
Var._gtt = {
  kind: 'variable',
  variableType: 'variable',
} satisfies GTComponentMetadata;
GtInternalVar._gtt = {
  kind: 'variable',
  variableType: 'variable',
  injection: 'automatic',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { GtInternalVar, Var, computeVar };
