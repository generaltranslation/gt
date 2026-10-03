import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { computeNum, type NumProps } from './Num.shared';
import type { GTComponentMetadata } from '../../utils/types';

// ===== Component ===== //

function GtInternalNum({
  _enableI18n,
  _locale,
  ...props
}: NumProps): string | null {
  return computeNum({
    ...props,
    _enableI18n: _enableI18n ?? useEnableI18n(),
    _locale: _locale ?? useLocale(),
  });
}

function Num(props: NumProps): React.JSX.Element {
  return <GtInternalNum {...props} />;
}

/** @internal _gtt - The GT metadata for the component. */
GtInternalNum._gtt = {
  kind: 'variable',
  variableType: 'number',
  injection: 'automatic',
} satisfies GTComponentMetadata;
Num._gtt = {
  kind: 'variable',
  variableType: 'number',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { GtInternalNum, Num };
