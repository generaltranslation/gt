/**
 * Retrieves the value of an environment variable as a string.
 *
 * This function checks if the `process` object is defined and if the specified environment
 * variable is set. If both conditions are met, it returns the value of the environment
 * variable. If not, it returns an empty string.
 *
 * @param {string} VARIABLE - The name of the environment variable to retrieve.
 * @returns {string} The value of the environment variable, or an empty string if the variable is not set.
 */
export default function getDefaultFromEnv(VARIABLE: string): string {
  if (typeof process !== 'undefined' && process?.env?.[VARIABLE]) {
    return process.env[VARIABLE] as string;
  }
  return '';
}
