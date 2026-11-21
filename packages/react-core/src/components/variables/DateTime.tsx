import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { computeDateTime, type DateTimeProps } from './DateTime.shared';
import type { GTMarker } from '../../utils/marker';

// ===== Component ===== //

function GtInternalDateTime(props: DateTimeProps): string | null {
  return computeDateTime({
    ...props,
    _enableI18n: useEnableI18n(),
    _locale: useLocale(),
  });
}

function DateTime(props: DateTimeProps): React.JSX.Element {
  return <GtInternalDateTime {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalDateTime._gtt = {
  kind: 'variable',
  variableType: 'd',
  automatic: true,
} satisfies GTMarker;
DateTime._gtt = { kind: 'variable', variableType: 'd' } satisfies GTMarker;

// ===== Exports ===== //

export { GtInternalDateTime, DateTime };
