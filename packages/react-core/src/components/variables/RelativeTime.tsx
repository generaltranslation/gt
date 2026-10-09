import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import {
  computeRelativeTime,
  type RelativeTimeProps,
} from './RelativeTime.shared';
import type { GTComponentMetadata } from '../../utils/types';

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

/** @internal _gtt - The GT metadata for the component. */
GtInternalRelativeTime._gtt = {
  kind: 'variable',
  variableType: 'relative-time',
  injection: 'automatic',
} satisfies GTComponentMetadata;
RelativeTime._gtt = {
  kind: 'variable',
  variableType: 'relative-time',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { GtInternalRelativeTime, RelativeTime };
