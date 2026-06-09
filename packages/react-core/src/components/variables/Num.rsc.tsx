import { computeNum } from './computeNum';
import type { NumProps } from './computeNum';
import { resolveConditions } from '../../condition-store/resolveConditions';

// ===== Component ===== //

/**
 * RSC version of the `<Num>` component. Reads locale/enableI18n from the
 * readonly condition store instead of React context.
 */
function RscNum({ _locale, _enableI18n, ...props }: NumProps): string | null {
  return computeNum({
    ...props,
    ...resolveConditions({ _locale, _enableI18n }),
  });
}

/** @internal _gtt - The GT transformation for the component. */
RscNum._gtt = 'variable-number';

// ===== Exports ===== //

export { RscNum };
