import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { computeCurrency, type CurrencyProps } from './Currency.shared';
import type { GTComponentMetadata } from '../../utils/types';

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

/** @internal _gtt - The GT metadata for the component. */
GtInternalCurrency._gtt = {
  kind: 'variable',
  variableType: 'currency',
  injection: 'automatic',
} satisfies GTComponentMetadata;
Currency._gtt = {
  kind: 'variable',
  variableType: 'currency',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { GtInternalCurrency, Currency };
