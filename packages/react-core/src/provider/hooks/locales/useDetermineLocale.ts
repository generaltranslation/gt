import { createInternalUsageError } from '../../../errors-dir/internalErrors';
import { UseDetermineLocaleParams, UseDetermineLocaleReturn } from './types';

/**
 * @deprecated - this function is to always be overridden by a wrapper react package
 */
export function useDetermineLocale({}: UseDetermineLocaleParams): UseDetermineLocaleReturn {
  throw createInternalUsageError('useDetermineLocale');
}
