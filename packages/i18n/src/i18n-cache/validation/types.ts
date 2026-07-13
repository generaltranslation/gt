/**
 * Response from a validation operation
 */
export type ValidationResult = {
  type: 'warning' | 'error';
  message: string;
};
