import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import {
  computeRelativeTime,
  type RelativeTimeProps,
} from './RelativeTime.shared';
import type { GTMarker } from '../../utils/marker';

// ===== Component ===== //

function GtInternalRelativeTime(props: RelativeTimeProps): string | null {
  return computeRelativeTime({
    ...props,
    _enableI18n: useEnableI18n(),
    _locale: useLocale(),
  });
}

function RelativeTime(props: RelativeTimeProps): React.JSX.Element {
  return <GtInternalRelativeTime {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalRelativeTime._gtt = {
  kind: 'variable',
  variableType: 'rt',
  automatic: true,
} satisfies GTMarker;
RelativeTime._gtt = { kind: 'variable', variableType: 'rt' } satisfies GTMarker;

// ===== Exports ===== //

export { GtInternalRelativeTime, RelativeTime };
