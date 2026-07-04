import { ValidationResult } from './types';
import logger from '../../logs/logger';

/**
 * Throw errors if there are any errors and log warnings if there are any warnings
 * @param {ValidationResult[]} results - The results to print
 * @param {string} [prefix] - The prefix to add to the results
 * @param {boolean} [throwOnError] - Whether to throw an error if there are any errors
 *
 * TODO: dedupe messages
 * TODO: logging system
 */
export function publishValidationResults(
  results: ValidationResult[],
  prefix: string = '',
  throwOnError: boolean = true
): void {
  // Log the results
  results.forEach((result) => {
    switch (result.type) {
      case 'error':
        logger.error(prefix + result.message);
        break;
      case 'warning':
        logger.warn(prefix + result.message);
        break;
    }
  });

  // Throw if there are any errors
  if (throwOnError && results.some((result) => result.type === 'error')) {
    throw new Error('Validation errors occurred');
  }
}
