import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { computeCurrency, type CurrencyProps } from './Currency.shared';

// ===== Component ===== //

function GtInternalCurrency({
  _enableI18n,
  _locale,
  ...props
}: CurrencyProps): string | null {
  return computeCurrency({
    ...props,
    _enableI18n: _enableI18n ?? useEnableI18n(),
    _locale: _locale ?? useLocale(),
  });
}

function Currency(props: CurrencyProps): React.JSX.Element {
  return <GtInternalCurrency {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalCurrency._gtt = 'variable-currency-automatic';
Currency._gtt = 'variable-currency';

// ===== Exports ===== //

export { GtInternalCurrency, Currency };
