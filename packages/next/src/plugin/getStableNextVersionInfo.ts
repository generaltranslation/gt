import { createRequire } from 'module';

import {
  createUnresolvedNextVersionError,
  createUnresolvedReactVersionError,
} from '../errors/createErrors';
import {
  BABEL_PLUGIN_SUPPORT,
  ROOT_PARAM_STABILITY,
  STABLE_TURBO_CONFIG_VERSION,
  SWC_PLUGIN_SUPPORT,
} from './constants';

// @ts-expect-error gt-next declaration emit still uses CommonJS, but the ESM
// config build needs import.meta.url because Node config files do not define require.
const moduleRequire = createRequire(import.meta.url);

/**
 * Get the next version of the package.
 */
function getPackageVersion(packageName: string): string {
  const packageJsonPath = `${packageName}/package.json`;

  try {
    const resolvedPackageJsonPath = moduleRequire.resolve(packageJsonPath, {
      paths: [process.cwd()],
    });
    return moduleRequire(resolvedPackageJsonPath).version;
  } catch (_error) {
    return moduleRequire(packageJsonPath).version;
  }
}

function getNextVersion(): string {
  try {
    return getPackageVersion('next');
  } catch (error) {
    throw new Error(createUnresolvedNextVersionError(error as Error));
  }
}

/**
 * Get the react version of the package.
 * I am wary of dynamic imports
 */
function getReactVersion(): string {
  try {
    return getPackageVersion('react');
  } catch (error) {
    throw new Error(createUnresolvedReactVersionError(error as Error));
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
export const turboConfigStable = comparePackageVersion(
  getNextVersion(),
  STABLE_TURBO_CONFIG_VERSION
);

export type RootParam = 'unsupported' | 'unstable' | 'experimental' | 'stable';

export const rootParamStability: RootParam = (() => {
  const nextVersion = getNextVersion();

  // Check if experimental
  if (comparePackageVersion(nextVersion, ROOT_PARAM_STABILITY.experimental)) {
    return 'experimental';
  }

  // Check if unstable
  if (comparePackageVersion(nextVersion, ROOT_PARAM_STABILITY.unstable)) {
    return 'unstable';
  }

  // return unsupported
  return 'unsupported';
})();

export const swcPluginCompatible = comparePackageVersion(
  getNextVersion(),
  SWC_PLUGIN_SUPPORT
);

// disable babel plugin if using react <= 16
export const babelPluginCompatible = comparePackageVersion(
  getReactVersion(),
  BABEL_PLUGIN_SUPPORT
);
