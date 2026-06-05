import {
  getReadonlyConditionStoreWithFallback,
  GtInternalRelativeTime,
} from '@generaltranslation/react-core/context';

type RelativeTimeProps = Parameters<typeof GtInternalRelativeTime>[0];

// ===== Component ===== //

function RscRelativeTime({
  _enableI18n,
  _locale,
  ...props
}: RelativeTimeProps): React.JSX.Element {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return (
    <GtInternalRelativeTime
      {...props}
      _enableI18n={_enableI18n ?? conditionStore.getEnableI18n()}
      _locale={_locale ?? conditionStore.getLocale()}
    />
  );
}

/** @internal _gtt - The GT transformation for the component. */
RscRelativeTime._gtt = 'variable-relative-time';

// ===== Exports ===== //

export { RscRelativeTime };
