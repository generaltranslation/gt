import {
  getReadonlyConditionStoreWithFallback,
  GtInternalNum,
} from '@generaltranslation/react-core/context';

type NumProps = Parameters<typeof GtInternalNum>[0];

// ===== Component ===== //

function RscNum({
  _enableI18n,
  _locale,
  ...props
}: NumProps): React.JSX.Element {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return (
    <GtInternalNum
      {...props}
      _enableI18n={_enableI18n ?? conditionStore.getEnableI18n()}
      _locale={_locale ?? conditionStore.getLocale()}
    />
  );
}

/** @internal _gtt - The GT transformation for the component. */
RscNum._gtt = 'variable-number';

// ===== Exports ===== //

export { RscNum };
