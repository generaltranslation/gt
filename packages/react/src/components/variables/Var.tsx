import { GtInternalVar } from '@generaltranslation/react-core/context';
import type { ReactNode } from 'react';

type VarProps<T extends ReactNode> = Parameters<typeof GtInternalVar<T>>[0];

// ===== Component ===== //

function RscVar<T extends ReactNode>(props: VarProps<T>): T {
  return GtInternalVar(props);
}

/** @internal _gtt - The GT transformation for the component. */
RscVar._gtt = 'variable-variable';

// ===== Exports ===== //

export { RscVar };
