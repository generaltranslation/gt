import crypto from 'crypto';

/**
 * Hashes a string using SHA-256 algorithm.
 * @param {string} string - The string to be hashed.
 * @returns {string} The hashed string.
 */
export function hashStringSync(string: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(string);
  return hash.digest('hex');
}
