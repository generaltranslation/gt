import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');
const PKG_PATH = join(__dirname, 'package.json');
const ROOT_PKG_PATH = join(ROOT, 'package.json');
const INSTALL_ARGS = ['install', '--no-frozen-lockfile'];
const FORCE_INSTALL_ARGS = process.env.CI ? [] : ['--force'];
// Keep package realpaths under the repo while Turbopack uses the repo root.
const PACKED_INSTALL_ARGS = [
  ...INSTALL_ARGS,
  ...FORCE_INSTALL_ARGS,
  '--config.enable-global-virtual-store=false',
];
const RESTORE_INSTALL_ARGS = [...INSTALL_ARGS, ...FORCE_INSTALL_ARGS];

const PACKED_WORKSPACE_DEPENDENCIES = [
  ['@generaltranslation/compiler', 'packages/compiler'],
  ['@generaltranslation/format', 'packages/format'],
  ['@generaltranslation/icu', 'packages/icu'],
  ['generaltranslation', 'packages/core'],
  ['@generaltranslation/supported-locales', 'packages/supported-locales'],
  ['gt-react', 'packages/react'],
  ['@generaltranslation/react-core', 'packages/react-core'],
  ['gt-i18n', 'packages/i18n'],
];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function logSection(message) {
  log(`\n=== ${message} ===\n`);
}

function runPnpm(args, options) {
  return execFileSync('pnpm', args, options);
}

function packWorkspacePackage(name, dir) {
  const packOutput = runPnpm(['pack', '--pack-destination', __dirname], {
    cwd: join(ROOT, dir),
    encoding: 'utf-8',
  }).trim();

  const tarballName = packOutput.split('\n').pop()?.split('/').pop();
  if (tarballName == null || tarballName.length === 0) {
    throw new Error(`Failed to pack ${name}`);
  }

  log(`Packed: ${name} ${tarballName}`);
  return tarballName;
}

function removePackedTarballs() {
  for (const file of readdirSync(__dirname)) {
    if (file.endsWith('.tgz')) {
      unlinkSync(join(__dirname, file));
    }
  }
}

// --- Step 1: Build all packages ---
logSection('Building packages');
runPnpm(['build'], { cwd: ROOT, stdio: 'inherit' });

// --- Step 2: Pack gt-next and its local workspace dependency closure ---
logSection('Packing gt-next workspace package closure');

removePackedTarballs();

const gtNextTarballName = packWorkspacePackage('gt-next', 'packages/next');
const dependencyOverrides = Object.fromEntries(
  PACKED_WORKSPACE_DEPENDENCIES.map(([name, dir]) => [
    name,
    `file:./tests/apps/next/middleware/${packWorkspacePackage(name, dir)}`,
  ])
);

// --- Step 3: Swap dependency to tarball and pin local workspace deps ---
const originalPkg = readFileSync(PKG_PATH, 'utf-8');
const originalRootPkg = readFileSync(ROOT_PKG_PATH, 'utf-8');
const pkg = JSON.parse(originalPkg);
const rootPkg = JSON.parse(originalRootPkg);
let pkgWasWritten = false;
let rootPkgWasWritten = false;
let installNeedsRestore = false;

try {
  pkg.dependencies['gt-next'] = `file:./${gtNextTarballName}`;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
  pkgWasWritten = true;

  rootPkg.pnpm = {
    ...rootPkg.pnpm,
    overrides: {
      ...rootPkg.pnpm?.overrides,
      ...dependencyOverrides,
    },
  };
  writeFileSync(ROOT_PKG_PATH, JSON.stringify(rootPkg, null, 2) + '\n');
  rootPkgWasWritten = true;

  // --- Step 4: Install with tarball ---
  logSection('Installing with packed gt-next workspace package closure');
  installNeedsRestore = true;
  runPnpm(PACKED_INSTALL_ARGS, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // --- Step 5: Build + run benchmark ---
  logSection('Building app');
  runPnpm(['build'], {
    cwd: __dirname,
    env: { ...process.env, NEXT_PUBLIC_USE_CASE: 'main' },
    stdio: 'inherit',
  });

  logSection('Installing Playwright browser');
  runPnpm(['exec', 'playwright', 'install', 'chromium-headless-shell'], {
    cwd: __dirname,
    stdio: 'inherit',
  });

  logSection('Running e2e benchmarks');
  runPnpm(
    ['exec', 'playwright', 'test', '--config=benchmarks/playwright.config.ts'],
    {
      cwd: __dirname,
      stdio: 'inherit',
    }
  );
} finally {
  // --- Step 6: Restore workspace dependency ---
  logSection('Restoring workspace dependency');
  if (pkgWasWritten) writeFileSync(PKG_PATH, originalPkg);
  if (rootPkgWasWritten) writeFileSync(ROOT_PKG_PATH, originalRootPkg);

  try {
    if (installNeedsRestore) {
      runPnpm(RESTORE_INSTALL_ARGS, {
        cwd: ROOT,
        stdio: 'inherit',
      });
    }
  } finally {
    removePackedTarballs();
  }
}
