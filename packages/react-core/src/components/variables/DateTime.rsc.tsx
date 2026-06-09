import { computeDateTime } from './computeDateTime';
import type { DateTimeProps } from './computeDateTime';
import { resolveConditions } from '../../condition-store/resolveConditions';

// ===== Component ===== //

/**
 * RSC version of the `<DateTime>` component. Reads locale/enableI18n from the
 * readonly condition store instead of React context.
 */
function RscDateTime({
  _locale,
  _enableI18n,
  ...props
}: DateTimeProps): string | null {
  return computeDateTime({
    ...props,
    ...resolveConditions({ _locale, _enableI18n }),
  });
}

/** @internal _gtt - The GT transformation for the component. */
RscDateTime._gtt = 'variable-datetime';

// ===== Exports ===== //

export { RscDateTime };
