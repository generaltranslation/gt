import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { lt, minVersion } from 'semver';
import { logger } from '../console/logger.js';
import { REACT_LIBRARIES } from '../types/libraries.js';
import { getPackageJson, getPackageVersion } from './packageJson.js';

const MINIMUM_REACT_PACKAGE_VERSION = '11.0.0';

/**
 * Whether a dependency range permits any version below `minimum`. Invalid
 * ranges (workspace:*, tags, URLs) fail open.
 */
export function permitsVersionBelow(range: string, minimum: string): boolean {
  try {
    const lowest = minVersion(range);
    return lowest !== null && lt(lowest, minimum);
  } catch {
    return false;
  }
}

export async function warnReactPackageCompatibility(
  suppressWarning: boolean = false,
  cwd: string = process.cwd()
): Promise<void> {
  if (suppressWarning) return;

  try {
    const packageJson = await getPackageJson(cwd);
    if (!packageJson) return;

    const incompatiblePackages = REACT_LIBRARIES.flatMap((packageName) => {
      const version = getPackageVersion(packageName, packageJson);
      if (!version) return [];

      return permitsVersionBelow(version, MINIMUM_REACT_PACKAGE_VERSION)
        ? [`${packageName}@${version}`]
        : [];
    });
    if (incompatiblePackages.length === 0) return;

    logger.warn(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Warning',
        whatHappened:
          'This GT CLI may be incompatible with the listed React packages',
        why: 'versions before 11 include the ID parameter in translation keys and may cause retranslation',
        fix: 'Upgrade the listed packages to version 11 or later or install gt@2.14.58',
        wayOut:
          'rerun with --suppress-id-compatibility-warning to hide this warning',
        details: incompatiblePackages,
      })
    );
  } catch {
    // Compatibility detection is best-effort and must not block the CLI.
  }
}
