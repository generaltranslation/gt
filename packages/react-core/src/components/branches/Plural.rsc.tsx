import type { ReactNode } from 'react';
import { computePlural } from './computePlural';
import type { PluralProps } from './computePlural';
import { resolveConditions } from '../../condition-store/resolveConditions';

// ===== Component ===== //

/**
 * RSC version of the `<Plural>` component. Reads locale/enableI18n from the
 * readonly condition store instead of React context.
 */
function RscPlural({ _locale, _enableI18n, ...props }: PluralProps): ReactNode {
  return computePlural({
    ...props,
    ...resolveConditions({ _locale, _enableI18n }),
  });
}

/** @internal _gtt - The GT transformation for the component. */
RscPlural._gtt = 'plural';

// ===== Exports ===== //

export { RscPlural };
