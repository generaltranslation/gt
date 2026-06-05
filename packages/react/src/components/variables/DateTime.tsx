import {
  getReadonlyConditionStoreWithFallback,
  GtInternalDateTime,
} from '@generaltranslation/react-core/context';

type DateTimeProps = Parameters<typeof GtInternalDateTime>[0];

// ===== Component ===== //

function RscDateTime({
  _enableI18n,
  _locale,
  ...props
}: DateTimeProps): React.JSX.Element {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return (
    <GtInternalDateTime
      {...props}
      _enableI18n={_enableI18n ?? conditionStore.getEnableI18n()}
      _locale={_locale ?? conditionStore.getLocale()}
    />
  );
}

/** @internal _gtt - The GT transformation for the component. */
RscDateTime._gtt = 'variable-datetime';

// ===== Exports ===== //

export { RscDateTime };
