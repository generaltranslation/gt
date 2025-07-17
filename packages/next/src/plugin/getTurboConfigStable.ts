import { createUnresolvedNextVersionError } from '../errors/createErrors';

/**
 * Get the next version of the package.
 */
function getNextVersion(): string {
  try {
    const pkg = require('next/package.json');
    return pkg.version;
  } catch (error) {
    throw new Error(createUnresolvedNextVersionError(error as Error));
  }
}

/**
 * Compare two package versions.
 *
 * @param a - The first version.
 * @param b - The second version.
 * @returns True if a is greater than or equal to b, false otherwise.
 */
function comparePackageVersion(a: string, b: string): boolean {
  const aParts = a.split('.');
  const bParts = b.split('.');

  for (let i = 0; i < aParts.length; i++) {
    const aPart = Number(aParts[i]) || 0;
    const bPart = Number(bParts[i]) || 0;

    if (aPart > bPart) {
      return true;
    } else if (aPart < bPart) {
      return false;
    }
  }

  // If all parts are equal, return true
  return true;
}

/**
 * Starting at version next@15.3.0 experimental field in turbo config was deprecated.
 * Shout out to next-intl: https://github.com/amannn/next-intl/pull/1850
 */
const STABLE_TURBO_CONFIG_VERSION = '15.3.0';
export const turboConfigStable = comparePackageVersion(
  getNextVersion(),
  STABLE_TURBO_CONFIG_VERSION
);
