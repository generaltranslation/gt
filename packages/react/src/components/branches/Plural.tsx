import {
  getReadonlyConditionStoreWithFallback,
  GtInternalPlural,
} from '@generaltranslation/react-core/context';

type PluralProps = Parameters<typeof GtInternalPlural>[0];

// ===== Component ===== //

function RscPlural({
  _enableI18n,
  _locale,
  ...props
}: PluralProps): React.JSX.Element {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return (
    <GtInternalPlural
      {...props}
      _enableI18n={_enableI18n ?? conditionStore.getEnableI18n()}
      _locale={_locale ?? conditionStore.getLocale()}
    />
  );
}

/** @internal _gtt - The GT transformation for the component. */
RscPlural._gtt = 'plural';

// ===== Exports ===== //

export { RscPlural };
