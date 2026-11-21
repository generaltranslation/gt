import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { computeNum, type NumProps } from './Num.shared';
import type { GTMarker } from '../../utils/marker';

// ===== Component ===== //

function GtInternalNum(props: NumProps): string | null {
  return computeNum({
    ...props,
    _enableI18n: useEnableI18n(),
    _locale: useLocale(),
  });
}

function Num(props: NumProps): React.JSX.Element {
  return <GtInternalNum {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalNum._gtt = {
  kind: 'variable',
  variableType: 'n',
  automatic: true,
} satisfies GTMarker;
Num._gtt = { kind: 'variable', variableType: 'n' } satisfies GTMarker;

// ===== Exports ===== //

export { GtInternalNum, Num };
