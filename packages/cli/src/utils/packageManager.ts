// This file is MIT licensed and was adapted from https://github.com/getsentry/sentry-wizard/blob/master/src/utils/package-manager.ts and https://github.com/getsentry/sentry-wizard/blob/master/src/utils/clack/index.ts
import * as fs from 'fs';
import * as path from 'path';
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
      return fs.existsSync(path.join(cwd, 'package-lock.json'));
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

/**
 * The workspace member patterns a directory declares: pnpm-workspace.yaml
 * `packages` entries when the file exists (parsed as real YAML, so flow-style
 * arrays work), else the package.json `workspaces` field (array or
 * `{ packages: [...] }`). null when the directory declares no workspace at
 * all.
 */
function workspacePatternsOf(dir: string): string[] | null {
  try {
    const yamlPath = path.join(dir, 'pnpm-workspace.yaml');
    if (fs.existsSync(yamlPath)) {
      const doc = YAML.parse(fs.readFileSync(yamlPath, 'utf-8')) as {
        packages?: unknown;
      } | null;
      if (doc && Array.isArray(doc.packages)) {
        return doc.packages.filter(
          (entry): entry is string => typeof entry === 'string'
        );
      }
      return [];
    }
  } catch {
    // fall through to package.json
  }
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')
    ) as { workspaces?: string[] | { packages?: string[] } };
    if (Array.isArray(pkg.workspaces)) return pkg.workspaces;
    if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) {
      return pkg.workspaces.packages;
    }
  } catch {
    // not a workspace root
  }
  return null;
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function workspacePatternToRegExp(pattern: string): RegExp {
  // `./packages/*` and `packages/*/` are the same pattern.
  const body = pattern.replace(/^\.\//, '').replace(/\/+$/, '');
  const segments = body.split('/');
  let source = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment === '**') {
      // Globstar matches zero or more whole segments, so `packages/**`
      // covers `packages/a/b` (and `packages` itself), and
      // `packages/**/lib` covers `packages/lib`.
      if (i === segments.length - 1) {
        source = source.replace(/\/$/, '');
        source += source ? '(?:/.+)?' : '.*';
      } else {
        source += '(?:[^/]+/)*';
      }
      continue;
    }
    source += segment.split('*').map(escapeRegExp).join('[^/]*');
    if (i < segments.length - 1) source += '/';
  }
  return new RegExp('^' + source + '$');
}

/**
 * Whether a member path (relative to the workspace root) is covered by the
 * root's workspace patterns. Supports the common glob subset: literal paths,
 * `*` for one path segment, `**` for any depth (including zero). Negations
 * subtract: a member matching a `!pattern` is not covered. Targeting an
 * uncovered directory would make the install fail ("npm error No workspaces
 * found"), so an uncovered member is treated as not belonging to that root
 * at all.
 */
function matchesWorkspacePattern(member: string, patterns: string[]): boolean {
  const memberPosix = member.split(path.sep).join('/');
  const positive = patterns.filter((pattern) => !pattern.startsWith('!'));
  const negative = patterns
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => pattern.slice(1));
  return (
    positive.some((pattern) =>
      workspacePatternToRegExp(pattern).test(memberPosix)
    ) &&
    !negative.some((pattern) =>
      workspacePatternToRegExp(pattern).test(memberPosix)
    )
  );
}

/**
 * Resolves the package manager for a directory whose lockfile may live at a
 * monorepo root. Checks `cwd` itself first (same single-match rule as
 * _detectPackageManger); on a miss, walks up looking for a directory with a
 * lockfile that is also a workspace root (a `workspaces` field in its
 * package.json, or a pnpm-workspace.yaml). The workspace requirement keeps a
 * stray lockfile in an unrelated ancestor (e.g. the home directory) from
 * being picked up.
 */
export function detectPackageManagerWithRoot(
  cwd: string
): { packageManager: PackageManager; root: string } | null {
  const resolved = path.resolve(cwd);
  const atLeaf = packageManagers.filter((packageManager) =>
    packageManager.detect(resolved)
  );
  if (atLeaf.length === 1) {
    return { packageManager: atLeaf[0], root: resolved };
  }
  if (atLeaf.length > 1) return null;

  let dir = path.dirname(resolved);
  while (true) {
    const found = packageManagers.filter((packageManager) =>
      packageManager.detect(dir)
    );
    // Ambiguity keeps the no-assumptions rule from _detectPackageManger.
    if (found.length > 1) return null;
    if (found.length === 1) {
      const patterns = workspacePatternsOf(dir);
      // Only a workspace root whose patterns actually cover the member
      // counts; a lockfile-bearing ancestor that merely sits above the
      // directory (a clone dropped inside an unrelated monorepo, a stray
      // workspaces field in the home directory) must not claim it.
      if (
        patterns !== null &&
        matchesWorkspacePattern(path.relative(dir, resolved), patterns)
      ) {
        return { packageManager: found[0], root: dir };
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Get the package manager for the current project
// Uses a global cache to avoid prompting the user multiple times
export async function getPackageManager(
  cwd: string = process.cwd(),
  specifiedPackageManager?: string,
  errorIfNotFound: boolean = false
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

  const detectedPackageManager = _detectPackageManger(cwd);

  if (detectedPackageManager) {
    globalWizard._gt_wizard_cached_package_manager = detectedPackageManager;
    return detectedPackageManager;
  }

  if (errorIfNotFound) {
    throw new NoPackageManagerError('No package manager found');
  }

  const selectedPackageManager: PackageManager =
    await promptSelect<PackageManager>({
      message: 'Select your package manager.',
      options: packageManagers.map((packageManager) => ({
        value: packageManager,
        label: packageManager.label,
      })),
    });

  globalWizard._gt_wizard_cached_package_manager = selectedPackageManager;

  return selectedPackageManager;
}
