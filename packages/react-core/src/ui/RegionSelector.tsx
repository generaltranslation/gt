import React from 'react';
import { RegionSelectorProps } from './types';
import { createInternalUsageError } from '../errors-dir/internalErrors';

/**
 * @deprecated - this function is to always be overridden by a wrapper react package
 */
export default function RegionSelector<
  Regions extends string[],
>({}: RegionSelectorProps<Regions>): React.JSX.Element | null {
  throw createInternalUsageError('RegionSelector');
}
