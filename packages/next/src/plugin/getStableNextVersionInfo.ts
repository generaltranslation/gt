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

/**
 * Get the next version of the package.
 */
function getPackageVersion(packageName: string): string {
  const packageJsonPath = `${packageName}/package.json`;

  try {
    const resolvedPackageJsonPath = require.resolve(packageJsonPath, {
      paths: [process.cwd()],
    });
    return require(resolvedPackageJsonPath).version;
  } catch (_error) {
    return require(packageJsonPath).version;
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

/**
 * Classify the stability of root params for a Next.js version.
 *
 * @param nextVersion - The Next.js version to classify.
 * @returns The root params stability tier for the supplied version.
 */
export function getRootParamStability(nextVersion: string): RootParam {
  // Check stable before experimental because each threshold is a lower bound.
  if (comparePackageVersion(nextVersion, ROOT_PARAM_STABILITY.stable)) {
    return 'stable';
  }

  if (comparePackageVersion(nextVersion, ROOT_PARAM_STABILITY.experimental)) {
    return 'experimental';
  }

  if (comparePackageVersion(nextVersion, ROOT_PARAM_STABILITY.unstable)) {
    return 'unstable';
  }

  return 'unsupported';
}

export const rootParamStability = getRootParamStability(getNextVersion());

export const swcPluginCompatible = comparePackageVersion(
  getNextVersion(),
  SWC_PLUGIN_SUPPORT
);

// disable babel plugin if using react <= 16
export const babelPluginCompatible = comparePackageVersion(
  getReactVersion(),
  BABEL_PLUGIN_SUPPORT
);
