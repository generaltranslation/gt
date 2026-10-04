import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { computeDateTime, type DateTimeProps } from './DateTime.shared';
import type { GTComponentMetadata } from '../../utils/types';

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

/** @internal _gtt - The GT metadata for the component. */
GtInternalDateTime._gtt = {
  kind: 'variable',
  variableType: 'datetime',
  injection: 'automatic',
} satisfies GTComponentMetadata;
DateTime._gtt = {
  kind: 'variable',
  variableType: 'datetime',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { GtInternalDateTime, DateTime };
