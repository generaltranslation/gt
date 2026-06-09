import type { ReactNode } from 'react';
import { computeVar } from './Var';

type VarProps<T extends ReactNode> = {
  children: T;
  name?: string;
  _locale?: string;
  _enableI18n?: boolean;
};

// ===== Component ===== //

/**
 * RSC version of the `<Var>` component. Raw variables are locale-independent,
 * so this simply returns its children.
 */
function RscVar<T extends ReactNode>({ children }: VarProps<T>): T {
  return computeVar({ children });
}

/** @internal _gtt - The GT transformation for the component. */
RscVar._gtt = 'variable-variable';

// ===== Exports ===== //

export { RscVar };
