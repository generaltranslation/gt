// This file is MIT licensed and was adapted from https://github.com/getsentry/sentry-wizard/blob/master/src/utils/package-manager.ts and https://github.com/getsentry/sentry-wizard/blob/master/src/utils/clack/index.ts
import * as fs from 'fs';
import * as path from 'path';
import { getPackageJson, updatePackageJson } from './packageJson';
import { promptSelect } from '../console';

export interface PackageManager {
  id: string;
  name: string;
  label: string;
  installCommand: string;
  buildCommand: string;
  /* The command that the package manager uses to run a script from package.json */
  runScriptCommand: string;
  flags: string;
  forceInstallFlag: string;
  devDependencyFlag: string;
  registry?: string;
  detect: () => boolean;
  addOverride: (pkgName: string, pkgVersion: string) => Promise<void>;
}

export const BUN: PackageManager = {
  id: 'bun',
  name: 'bun',
  label: 'Bun',
  installCommand: 'add',
  buildCommand: 'bun run build',
  runScriptCommand: 'bun run',
  flags: '',
  forceInstallFlag: '--force',
  devDependencyFlag: '--dev',
  detect: () =>
    ['bun.lockb', 'bun.lock'].some((lockFile) => {
      try {
        return fs.existsSync(path.join(process.cwd(), lockFile));
      } catch (e) {
        return false;
      }
    }),
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    const overrides = packageDotJson.overrides || {};

    await updatePackageJson({
      ...packageDotJson,
      overrides: {
        ...overrides,
        [pkgName]: pkgVersion,
      },
    });
  },
};
export const DENO: PackageManager = {
  id: 'deno',
  name: 'deno',
  label: 'Deno',
  installCommand: 'install',
  buildCommand: 'deno task build',
  runScriptCommand: 'deno task',
  flags: '',
  forceInstallFlag: '--force',
  devDependencyFlag: '--dev',
  registry: 'npm',
  detect: () => {
    try {
      return fs.existsSync(path.join(process.cwd(), 'deno.lock'));
    } catch (e) {
      return false;
    }
  },
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    const overrides = packageDotJson.overrides || {};

    await updatePackageJson({
      ...packageDotJson,
      overrides: {
        ...overrides,
        [pkgName]: pkgVersion,
      },
    });
  },
};
export const YARN_V1: PackageManager = {
  id: 'yarn_v1',
  name: 'yarn',
  label: 'Yarn V1',
  installCommand: 'add',
  buildCommand: 'yarn build',
  runScriptCommand: 'yarn',
  flags: '--ignore-workspace-root-check',
  forceInstallFlag: '--force',
  devDependencyFlag: '--dev',
  detect: () => {
    try {
      return fs
        .readFileSync(path.join(process.cwd(), 'yarn.lock'), 'utf-8')
        .slice(0, 500)
        .includes('yarn lockfile v1');
    } catch (e) {
      return false;
    }
  },
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    const resolutions = packageDotJson.resolutions || {};

    await updatePackageJson({
      ...packageDotJson,
      resolutions: {
        ...resolutions,
        [pkgName]: pkgVersion,
      },
    });
  },
};
/** YARN V2/3/4 */
export const YARN_V2: PackageManager = {
  id: 'yarn_v2',
  name: 'yarn',
  label: 'Yarn V2/3/4',
  installCommand: 'add',
  buildCommand: 'yarn build',
  runScriptCommand: 'yarn',
  flags: '',
  forceInstallFlag: '--force',
  devDependencyFlag: '--dev',
  detect: () => {
    try {
      return fs
        .readFileSync(path.join(process.cwd(), 'yarn.lock'), 'utf-8')
        .slice(0, 500)
        .includes('__metadata');
    } catch (e) {
      return false;
    }
  },
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    const resolutions = packageDotJson.resolutions || {};

    await updatePackageJson({
      ...packageDotJson,
      resolutions: {
        ...resolutions,
        [pkgName]: pkgVersion,
      },
    });
  },
};
export const PNPM: PackageManager = {
  id: 'pnpm',
  name: 'pnpm',
  label: 'PNPM',
  installCommand: 'add',
  buildCommand: 'pnpm build',
  runScriptCommand: 'pnpm',
  flags: '--ignore-workspace-root-check',
  forceInstallFlag: '--force',
  devDependencyFlag: '--save-dev',
  detect: () => {
    try {
      return fs.existsSync(path.join(process.cwd(), 'pnpm-lock.yaml'));
    } catch (e) {
      return false;
    }
  },
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    const pnpm = packageDotJson.pnpm || {};
    const overrides = pnpm.overrides || {};

    await updatePackageJson({
      ...packageDotJson,
      pnpm: {
        ...pnpm,
        overrides: {
          ...overrides,
          [pkgName]: pkgVersion,
        },
      },
    });
  },
};
export const NPM: PackageManager = {
  id: 'npm',
  name: 'npm',
  label: 'NPM',
  installCommand: 'install',
  buildCommand: 'npm run build',
  runScriptCommand: 'npm run',
  flags: '',
  forceInstallFlag: '--force',
  devDependencyFlag: '--save-dev',
  detect: () => {
    try {
      return fs.existsSync(path.join(process.cwd(), 'package-lock.json'));
    } catch (e) {
      return false;
    }
  },
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    const overrides = packageDotJson.overrides || {};

    await updatePackageJson({
      ...packageDotJson,
      overrides: {
        ...overrides,
        [pkgName]: pkgVersion,
      },
    });
  },
};

export const packageManagers = [NPM, YARN_V1, YARN_V2, PNPM, BUN, DENO];

export function _detectPackageManger(
  managers?: PackageManager[]
): PackageManager | null {
  const foundPackageMangers = (managers ?? packageManagers).filter(
    (packageManager) => packageManager.detect()
  );

  // Only consider a package manager detected if we found exactly one.
  // If we find more than one, we should not make any assumptions.
  if (foundPackageMangers.length === 1) {
    return foundPackageMangers[0];
  }

  return null;
}

// Get the package manager for the current project
// Uses a global cache to avoid prompting the user multiple times
export async function getPackageManager(
  specifiedPackageManager?: string
): Promise<PackageManager> {
  const globalWizard: typeof global & {
    _gt_wizard_cached_package_manager?: PackageManager;
  } = global;

  if (globalWizard._gt_wizard_cached_package_manager) {
    return globalWizard._gt_wizard_cached_package_manager;
  }

  if (specifiedPackageManager) {
    const packageManager = packageManagers.find(
      (packageManager) => packageManager.id === specifiedPackageManager
    );
    if (packageManager) {
      globalWizard._gt_wizard_cached_package_manager = packageManager;
      return packageManager;
    }
  }

  const detectedPackageManager = _detectPackageManger();

  if (detectedPackageManager) {
    globalWizard._gt_wizard_cached_package_manager = detectedPackageManager;
    return detectedPackageManager;
  }

  const selectedPackageManager: PackageManager =
    await promptSelect<PackageManager>({
      message: 'Please select your package manager.',
      options: packageManagers.map((packageManager) => ({
        value: packageManager,
        label: packageManager.label,
      })),
    });

  globalWizard._gt_wizard_cached_package_manager = selectedPackageManager;

  return selectedPackageManager;
}
