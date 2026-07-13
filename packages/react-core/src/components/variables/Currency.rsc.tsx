import { computeCurrency, type ResolvedCurrencyProps } from './Currency.shared';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscGtInternalCurrency(props: ResolvedCurrencyProps): string | null {
  return computeCurrency(props);
}

function RscCurrency(props: ResolvedCurrencyProps): React.JSX.Element {
  return <RscGtInternalCurrency {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
RscCurrency._gtt = 'variable-currency';
RscGtInternalCurrency._gtt = 'variable-currency-automatic';

// ===== Exports ===== //

export { RscCurrency, RscGtInternalCurrency };
