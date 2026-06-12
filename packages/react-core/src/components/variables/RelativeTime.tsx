import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import {
  computeRelativeTime,
  type RelativeTimeProps,
} from './RelativeTime.shared';

// ===== Component ===== //

function GtInternalRelativeTime({
  _enableI18n,
  _locale,
  ...props
}: RelativeTimeProps): string | null {
  return computeRelativeTime({
    ...props,
    _enableI18n: _enableI18n ?? useEnableI18n(),
    _locale: _locale ?? useLocale(),
  });
}

function RelativeTime(props: RelativeTimeProps): React.JSX.Element {
  return <GtInternalRelativeTime {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalRelativeTime._gtt = 'variable-relative-time-automatic';
RelativeTime._gtt = 'variable-relative-time';

// ===== Exports ===== //

export { GtInternalRelativeTime, RelativeTime };
