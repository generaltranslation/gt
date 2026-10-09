import { computeCurrency, type ResolvedCurrencyProps } from './Currency.shared';
import type { GTComponentMetadata } from '../../utils/types';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscGtInternalCurrency(props: ResolvedCurrencyProps): string | null {
  return computeCurrency(props);
}

function RscCurrency(props: ResolvedCurrencyProps): React.JSX.Element {
  return <RscGtInternalCurrency {...props} />;
}

/** @internal _gtt - The GT metadata for the component. */
RscCurrency._gtt = {
  kind: 'variable',
  variableType: 'currency',
} satisfies GTComponentMetadata;
RscGtInternalCurrency._gtt = {
  kind: 'variable',
  variableType: 'currency',
  injection: 'automatic',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { RscCurrency, RscGtInternalCurrency };
