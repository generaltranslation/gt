import { createDiagnosticMessage } from 'generaltranslation/internal';
import { logger } from '../console/logger.js';
import { REACT_LIBRARIES } from '../types/libraries.js';
import { getPackageJson, getPackageVersion } from './packageJson.js';

const MINIMUM_REACT_PACKAGE_MAJOR = 11;

function getDeclaredMajor(version: string): number | undefined {
  const match = version.trim().match(/^[~^]?\s*(\d+)(?:\.|$)/);
  return match ? Number(match[1]) : undefined;
}

export async function checkReactPackageCompatibility(
  ignoreCompatibilityChecks: boolean = false,
  cwd: string = process.cwd()
): Promise<void> {
  if (ignoreCompatibilityChecks) return;

  try {
    const packageJson = await getPackageJson(cwd);
    if (!packageJson) return;

    const incompatiblePackages = REACT_LIBRARIES.flatMap((packageName) => {
      const version = getPackageVersion(packageName, packageJson);
      if (!version) return [];

      const major = getDeclaredMajor(version);
      return major !== undefined && major < MINIMUM_REACT_PACKAGE_MAJOR
        ? [`${packageName}@${version}`]
        : [];
    });
    if (incompatiblePackages.length === 0) return;

    logger.error(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'GT React packages must be version 11 or later',
        why: 'older versions include the ID parameter in translation keys and may cause retranslation',
        fix: 'Upgrade the listed packages or use an older compatible version of the GT CLI',
        wayOut:
          'rerun with --ignore-compatibility-checks to continue at your own risk',
        details: incompatiblePackages,
      })
    );
    process.exit(1);
  } catch {
    // Compatibility detection is best-effort and must not block the CLI.
  }
}
