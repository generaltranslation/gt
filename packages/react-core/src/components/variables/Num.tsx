import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { computeNum, type NumProps } from './Num.shared';

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

/** @internal _gtt - The GT transformation for the component. */
GtInternalNum._gtt = 'variable-number-automatic';
Num._gtt = 'variable-number';

// ===== Exports ===== //

export { GtInternalNum, Num };
