import { createInternalUsageError } from '../../errors-dir/internalErrors';
import { UseRegionStateParams, UseRegionStateReturn } from './types';

/**
 * @deprecated - this function is to always be overridden by a wrapper react package
 */
export function useRegionState(
  _params: UseRegionStateParams
): UseRegionStateReturn {
  throw createInternalUsageError('useRegionState');
}
