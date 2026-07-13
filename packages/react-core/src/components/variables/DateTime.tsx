import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { computeDateTime, type DateTimeProps } from './DateTime.shared';

// ===== Component ===== //

function GtInternalDateTime({
  _enableI18n,
  _locale,
  ...props
}: DateTimeProps): string | null {
  return computeDateTime({
    ...props,
    _enableI18n: _enableI18n ?? useEnableI18n(),
    _locale: _locale ?? useLocale(),
  });
}

function DateTime(props: DateTimeProps): React.JSX.Element {
  return <GtInternalDateTime {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalDateTime._gtt = 'variable-datetime-automatic';
DateTime._gtt = 'variable-datetime';

// ===== Exports ===== //

export { GtInternalDateTime, DateTime };
