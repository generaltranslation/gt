import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { computeCurrency, type CurrencyProps } from './Currency.shared';
import type { GTMarker } from '../../utils/marker';

// ===== Component ===== //

function GtInternalCurrency(props: CurrencyProps): string | null {
  return computeCurrency({
    ...props,
    _enableI18n: useEnableI18n(),
    _locale: useLocale(),
  });
}

function Currency(props: CurrencyProps): React.JSX.Element {
  return <GtInternalCurrency {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalCurrency._gtt = {
  kind: 'variable',
  variableType: 'c',
  automatic: true,
} satisfies GTMarker;
Currency._gtt = { kind: 'variable', variableType: 'c' } satisfies GTMarker;

// ===== Exports ===== //

export { GtInternalCurrency, Currency };
