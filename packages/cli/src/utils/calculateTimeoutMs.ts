import { DEFAULT_TIMEOUT_SECONDS } from './constants.js';

/**
 * Calculate timeout in ms with validation
 */
export function calculateTimeoutMs(
  timeout: string | number | undefined
): number {
  const value =
    timeout !== undefined ? Number(timeout) : DEFAULT_TIMEOUT_SECONDS;
  return (Number.isFinite(value) ? value : DEFAULT_TIMEOUT_SECONDS) * 1000;
}
