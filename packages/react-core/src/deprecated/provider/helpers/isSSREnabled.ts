import { createInternalUsageError } from '../../errors-dir/internalErrors';

/**
 * @deprecated - this function is to always be overridden by a wrapper react package
 */
export function isSSREnabled(): boolean {
  throw createInternalUsageError('isSSREnabled');
}
