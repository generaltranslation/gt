import fs from 'node:fs';
import path from 'node:path';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { logger } from '../console/logger.js';
import { REACT_LIBRARIES, type ReactLibrary } from '../types/libraries.js';
import { getPackageVersion } from './packageJson.js';

const MINIMUM_REACT_PACKAGE_MAJOR_VERSION = 11;

type PackageJson = Record<string, unknown> & {
  version?: string;
};

type IncompatiblePackage = {
  name: ReactLibrary;
  version: string;
};

function readPackageJson(packageJsonPath: string): PackageJson | null {
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;
  } catch {
    return null;
  }
}

function getInstalledPackageVersion(
  packageName: ReactLibrary,
  cwd: string
): string | undefined {
  let directory = cwd;
  while (true) {
    const packageJson = readPackageJson(
      path.join(directory, 'node_modules', packageName, 'package.json')
    );
    if (packageJson?.version) return packageJson.version;

    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/**
 * Returns the first major version allowed by common package-manager specs.
 * Installed versions take precedence, so this is primarily a fallback for
 * projects whose dependencies have not been installed yet.
 */
function getMinimumMajorVersion(versionSpec: string): number | undefined {
  const normalized = versionSpec.trim().replace(/^workspace:/, '');
  if (!normalized || normalized === '*') return undefined;

  const alternatives = normalized.split(/\s*\|\|\s*/);
  const minimumMajors = alternatives.flatMap((alternative) => {
    const trimmed = alternative.trim();
    const match = trimmed.match(/^(\^|~|>=?|<=?|=)?\s*v?(\d+)/);
    if (!match) return [];

    const operator = match[1];
    const major = Number(match[2]);
    if (operator === '<' || operator === '<=') return [0];
    return [major];
  });

  if (minimumMajors.length !== alternatives.length) return undefined;
  return Math.min(...minimumMajors);
}

function findIncompatiblePackages(cwd: string): IncompatiblePackage[] {
  const projectPackageJson = readPackageJson(path.join(cwd, 'package.json'));
  if (!projectPackageJson) return [];

  return REACT_LIBRARIES.flatMap((packageName) => {
    const declaredVersion = getPackageVersion(packageName, projectPackageJson);
    if (!declaredVersion) return [];

    const installedVersion = getInstalledPackageVersion(packageName, cwd);
    const versionToCheck = installedVersion ?? declaredVersion;
    const major = getMinimumMajorVersion(versionToCheck);
    if (major === undefined || major >= MINIMUM_REACT_PACKAGE_MAJOR_VERSION) {
      return [];
    }

    return [{ name: packageName, version: versionToCheck }];
  });
}

function createCompatibilityError(packages: IncompatiblePackage[]): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: 'GT React packages must be version 11 or later',
    why: 'older versions include the ID parameter in translation keys and may cause retranslation',
    fix: 'Upgrade the listed packages',
    wayOut:
      'rerun with --ignore-compatibility-checks to continue at your own risk',
    details: packages.map(({ name, version }) => `${name}@${version}`),
  });
}

/**
 * Prevent current CLI hashing semantics from being used with pre-v11 React
 * packages, which still rely on ID-based translation keys.
 */
export function checkReactPackageCompatibility(
  ignoreCompatibilityChecks: boolean = false,
  cwd: string = process.cwd()
): void {
  if (ignoreCompatibilityChecks) return;

  const incompatiblePackages = findIncompatiblePackages(cwd);
  if (incompatiblePackages.length === 0) return;

  logger.error(createCompatibilityError(incompatiblePackages));
  process.exit(1);
}
