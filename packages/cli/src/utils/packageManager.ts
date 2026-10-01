// This file is MIT licensed and was adapted from https://github.com/getsentry/sentry-wizard/blob/master/src/utils/package-manager.ts and https://github.com/getsentry/sentry-wizard/blob/master/src/utils/clack/index.ts
import * as fs from 'fs';
import * as path from 'path';
import micromatch from 'micromatch';
import { parse } from 'semver';
import YAML from 'yaml';
import { getPackageJson, updatePackageJson } from './packageJson.js';
import { promptSelect } from '../console/logging.js';

export interface PackageManager {
  id: string;
  name: string;
  label: string;
  installCommand: string;
  installAllCommand: string;
  buildCommand: string;
  /* The command that the package manager uses to run a script from package.json */
  runScriptCommand: string;
  flags: string;
  forceInstallFlag: string;
  devDependencyFlag: string;
  registry?: string;
  detect: (cwd: string) => boolean;
  addOverride: (pkgName: string, pkgVersion: string) => Promise<void>;
}

export class NoPackageManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoPackageManagerError';
  }
}

export const BUN: PackageManager = {
  id: 'bun',
  name: 'bun',
  label: 'Bun',
  installCommand: 'add',
  installAllCommand: 'bun install',
  buildCommand: 'bun run build',
  runScriptCommand: 'bun run',
  flags: '',
  forceInstallFlag: '--force',
  devDependencyFlag: '--dev',
  detect: (cwd: string) =>
    ['bun.lockb', 'bun.lock'].some((lockFile) => {
      try {
        return fs.existsSync(path.join(cwd, lockFile));
      } catch {
        return false;
      }
    }),
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    if (!packageDotJson) {
      return;
    }
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
  installAllCommand: 'deno install',
  buildCommand: 'deno task build',
  runScriptCommand: 'deno task',
  flags: '',
  forceInstallFlag: '--force',
  devDependencyFlag: '--dev',
  registry: 'npm',
  detect: (cwd: string) => {
    try {
      return fs.existsSync(path.join(cwd, 'deno.lock'));
    } catch {
      return false;
    }
  },
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    if (!packageDotJson) {
      return;
    }
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
  installAllCommand: 'yarn install',
  buildCommand: 'yarn build',
  runScriptCommand: 'yarn',
  flags: '--ignore-workspace-root-check',
  forceInstallFlag: '--force',
  devDependencyFlag: '--dev',
  detect: (cwd: string) => {
    try {
      return fs
        .readFileSync(path.join(cwd, 'yarn.lock'), 'utf-8')
        .slice(0, 500)
        .includes('yarn lockfile v1');
    } catch {
      return false;
    }
  },
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    if (!packageDotJson) {
      return;
    }
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
  installAllCommand: 'yarn install',
  buildCommand: 'yarn build',
  runScriptCommand: 'yarn',
  flags: '',
  forceInstallFlag: '--force',
  devDependencyFlag: '--dev',
  detect: (cwd: string) => {
    try {
      return fs
        .readFileSync(path.join(cwd, 'yarn.lock'), 'utf-8')
        .slice(0, 500)
        .includes('__metadata');
    } catch {
      return false;
    }
  },
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    if (!packageDotJson) {
      return;
    }
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
  installAllCommand: 'pnpm install',
  buildCommand: 'pnpm build',
  runScriptCommand: 'pnpm',
  flags: '--ignore-workspace-root-check',
  forceInstallFlag: '--force',
  devDependencyFlag: '--save-dev',
  detect: (cwd: string) => {
    try {
      return fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'));
    } catch {
      return false;
    }
  },
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    if (!packageDotJson) {
      return;
    }
    const pnpm =
      (packageDotJson.pnpm as
        | { overrides?: Record<string, string> }
        | undefined) || {};
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
  installAllCommand: 'npm ci',
  buildCommand: 'npm run build',
  runScriptCommand: 'npm run',
  flags: '',
  forceInstallFlag: '--force',
  devDependencyFlag: '--save-dev',
  detect: (cwd: string) => {
    try {
      return ['package-lock.json', 'npm-shrinkwrap.json'].some((lockFile) =>
        fs.existsSync(path.join(cwd, lockFile))
      );
    } catch {
      return false;
    }
  },
  addOverride: async (pkgName, pkgVersion): Promise<void> => {
    const packageDotJson = await getPackageJson();
    if (!packageDotJson) {
      return;
    }
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

export function _detectPackageManger(cwd: string): PackageManager | null {
  const foundPackageMangers = packageManagers.filter((packageManager) =>
    packageManager.detect(cwd)
  );

  // Only consider a package manager detected if we found exactly one.
  // If we find more than one, we should not make any assumptions.
  if (foundPackageMangers.length === 1) {
    return foundPackageMangers[0];
  }

  return null;
}

// A fresh scaffold can declare its manager before a lockfile exists.
// The npx launcher's manager says nothing about the target project.
function getDeclaredPackageManager(
  declaration: unknown
): PackageManager | undefined {
  const match =
    typeof declaration === 'string' && /^([^@]+)@(.+)$/.exec(declaration);
  const version = match && parse(match[2]);
  if (!match || !version) return undefined;
  const id =
    match[1] === 'yarn'
      ? version.major <= 1
        ? YARN_V1.id
        : YARN_V2.id
      : match[1];
  return packageManagers.find((manager) => manager.id === id);
}

// pnpm reads members from pnpm-workspace.yaml; the others from package.json.
function isWorkspaceMember(
  root: string,
  member: string,
  packageManager: PackageManager,
  packageJson: Record<string, unknown> | null
): boolean {
  let workspaces: unknown = packageJson?.workspaces;
  if (packageManager.id === PNPM.id) {
    try {
      workspaces = YAML.parse(
        fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')
      )?.packages;
    } catch {
      return false;
    }
  }
  const patterns = Array.isArray(workspaces)
    ? workspaces
    : (workspaces as { packages?: unknown } | undefined)?.packages;
  if (!Array.isArray(patterns)) return false;
  const relative = path.relative(root, member).split(path.sep).join('/');
  return micromatch([relative], patterns.map(String)).length > 0;
}

export async function getPackageManager(
  cwd: string = process.cwd(),
  specifiedPackageManager?: string,
  errorIfNotFound: boolean = false
): Promise<PackageManager> {
  if (specifiedPackageManager) {
    const packageManager = packageManagers.find(
      (packageManager) => packageManager.id === specifiedPackageManager
    );
    if (packageManager) return packageManager;
  }

  // Workspace members usually have neither a declaration nor a lockfile, so
  // walk up to the nearest directory that has either. A parent only counts
  // when its workspace patterns include cwd, so an unrelated parent project
  // cannot claim a standalone app.
  const start = path.resolve(cwd);
  for (let dir = start; ; dir = path.dirname(dir)) {
    const packageJson = await getPackageJson(dir);
    const lockfileManagers = packageManagers.filter((packageManager) =>
      packageManager.detect(dir)
    );
    if (packageJson?.packageManager !== undefined || lockfileManagers.length) {
      const packageManager =
        getDeclaredPackageManager(packageJson?.packageManager) ??
        (lockfileManagers.length === 1 ? lockfileManagers[0] : null);
      if (
        packageManager &&
        (dir === start ||
          isWorkspaceMember(dir, start, packageManager, packageJson))
      ) {
        return packageManager;
      }
      break;
    }
    if (path.dirname(dir) === dir) break;
  }

  if (errorIfNotFound) {
    throw new NoPackageManagerError('No package manager found');
  }

  return promptSelect<PackageManager>({
    message: 'Select your package manager.',
    options: packageManagers.map((packageManager) => ({
      value: packageManager,
      label: packageManager.label,
    })),
  });
}
