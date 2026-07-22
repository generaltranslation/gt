#!/usr/bin/env node

// Generates and publishes the per-platform binary packages that the `bin`
// release of a CLI package depends on through optionalDependencies. Each
// generated package wraps a single compiled binary from binaries/, so package
// managers only download the binary matching the user's platform.
//
// Run from the CLI package directory (packages/cli or packages/gtx-cli):
//   node ../../scripts/platform-packages.js generate
//   node ../../scripts/platform-packages.js publish [--dry-run]

import { execFileSync } from 'child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

export const TARGETS = [
  { target: 'darwin-x64', os: 'darwin', cpu: 'x64' },
  { target: 'darwin-arm64', os: 'darwin', cpu: 'arm64' },
  { target: 'linux-x64', os: 'linux', cpu: 'x64', libc: 'glibc' },
  { target: 'linux-arm64', os: 'linux', cpu: 'arm64', libc: 'glibc' },
  { target: 'win32-x64', os: 'win32', cpu: 'x64' },
];

export function platformPackageName(cliName, target) {
  return `@generaltranslation/${cliName}-${target}`;
}

export function binaryFileName(cliName, target) {
  const suffix = target === 'win32-x64' ? '.exe' : '';
  return `${cliName}-${target}${suffix}`;
}

// The bin release publishes as X.Y.Z-bin.N; platform packages use plain X.Y.Z
export function baseVersion(version) {
  return version.replace(/-bin\.\d+$/, '');
}

export function generatePlatformPackage(entry, options) {
  const { cliPackageJson, binariesDir, outDir } = options;
  const cliName = cliPackageJson.name;
  const name = platformPackageName(cliName, entry.target);
  const binFile = binaryFileName(cliName, entry.target);
  const binaryPath = join(binariesDir, binFile);

  if (!existsSync(binaryPath)) {
    throw new Error(
      `Missing binary for ${entry.target} at ${binaryPath}; run build:bin first`
    );
  }

  const dir = join(outDir, entry.target);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const packageJson = {
    name,
    version: baseVersion(cliPackageJson.version),
    description: `The ${entry.os} ${entry.cpu} binary for ${cliName}.`,
    repository: cliPackageJson.repository,
    license: cliPackageJson.license,
    author: cliPackageJson.author,
    homepage: cliPackageJson.homepage,
    bugs: cliPackageJson.bugs,
    os: [entry.os],
    cpu: [entry.cpu],
    ...(entry.libc ? { libc: [entry.libc] } : {}),
    files: [binFile],
    // Yarn PnP must extract the package so the binary exists on disk
    preferUnplugged: true,
  };

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf8'
  );
  copyFileSync(binaryPath, join(dir, binFile));
  if (!binFile.endsWith('.exe')) {
    chmodSync(join(dir, binFile), 0o755);
  }
  return dir;
}

function readCliPackageJson(cliDir) {
  return JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8'));
}

function generateAll(cliDir) {
  const cliPackageJson = readCliPackageJson(cliDir);
  const outDir = join(cliDir, 'npm');
  for (const entry of TARGETS) {
    const dir = generatePlatformPackage(entry, {
      cliPackageJson,
      binariesDir: join(cliDir, 'binaries'),
      outDir,
    });
    process.stdout.write(`Generated ${dir}\n`);
  }
}

function versionExistsOnNpm(name, version) {
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function publishAll(cliDir, { dryRun }) {
  const cliPackageJson = readCliPackageJson(cliDir);
  const version = baseVersion(cliPackageJson.version);
  for (const entry of TARGETS) {
    const name = platformPackageName(cliPackageJson.name, entry.target);
    const dir = join(cliDir, 'npm', entry.target);
    if (!existsSync(join(dir, 'package.json'))) {
      throw new Error(`${dir} not generated; run the generate step first`);
    }
    // Idempotent so an interrupted release can be resumed
    if (!dryRun && versionExistsOnNpm(name, version)) {
      process.stdout.write(`Skipping ${name}@${version} (already published)\n`);
      continue;
    }
    const args = ['publish', '--access', 'public'];
    if (dryRun) {
      args.push('--dry-run');
    }
    execFileSync('npm', args, { cwd: dir, stdio: 'inherit' });
    process.stdout.write(`Published ${name}@${version}\n`);
  }
}

function main() {
  const cliDir = process.cwd();
  const command = process.argv[2];
  if (command === 'generate') {
    generateAll(cliDir);
  } else if (command === 'publish') {
    publishAll(cliDir, { dryRun: process.argv.includes('--dry-run') });
  } else {
    console.error(
      'Usage: node scripts/platform-packages.js <generate|publish> [--dry-run]'
    );
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
