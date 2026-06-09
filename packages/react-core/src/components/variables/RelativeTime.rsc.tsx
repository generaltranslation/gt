import { computeRelativeTime } from './computeRelativeTime';
import type { RelativeTimeProps } from './computeRelativeTime';
import { resolveConditions } from '../../condition-store/resolveConditions';

// ===== Component ===== //

/**
 * RSC version of the `<RelativeTime>` component. Reads locale/enableI18n from
 * the readonly condition store instead of React context.
 */
function RscRelativeTime({
  _locale,
  _enableI18n,
  ...props
}: RelativeTimeProps): string | null {
  return computeRelativeTime({
    ...props,
    ...resolveConditions({ _locale, _enableI18n }),
  });
}

/** @internal _gtt - The GT transformation for the component. */
RscRelativeTime._gtt = 'variable-relative-time';

// ===== Exports ===== //

export { RscRelativeTime };
