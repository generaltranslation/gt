import { computeCurrency } from './computeCurrency';
import type { CurrencyProps } from './computeCurrency';
import { resolveConditions } from '../../condition-store/resolveConditions';

// ===== Component ===== //

/**
 * RSC version of the `<Currency>` component. Reads locale/enableI18n from the
 * readonly condition store instead of React context.
 */
function RscCurrency({
  _locale,
  _enableI18n,
  ...props
}: CurrencyProps): string | null {
  return computeCurrency({
    ...props,
    ...resolveConditions({ _locale, _enableI18n }),
  });
}

/** @internal _gtt - The GT transformation for the component. */
RscCurrency._gtt = 'variable-currency';

// ===== Exports ===== //

export { RscCurrency };
