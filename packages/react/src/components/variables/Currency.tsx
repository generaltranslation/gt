import {
  getReadonlyConditionStoreWithFallback,
  GtInternalCurrency,
} from '@generaltranslation/react-core/context';

type CurrencyProps = Parameters<typeof GtInternalCurrency>[0];

// ===== Component ===== //

function RscCurrency({
  _enableI18n,
  _locale,
  ...props
}: CurrencyProps): React.JSX.Element {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return (
    <GtInternalCurrency
      {...props}
      _enableI18n={_enableI18n ?? conditionStore.getEnableI18n()}
      _locale={_locale ?? conditionStore.getLocale()}
    />
  );
}

/** @internal _gtt - The GT transformation for the component. */
RscCurrency._gtt = 'variable-currency';

// ===== Exports ===== //

export { RscCurrency };
