import { execSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');
const GT_NEXT_DIR = join(ROOT, 'packages/next');
const PKG_PATH = join(__dirname, 'package.json');

// --- Step 1: Build all packages ---
console.log('\n=== Building packages ===\n');
execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' });

// --- Step 2: Pack gt-next ---
console.log('\n=== Packing gt-next ===\n');

for (const f of readdirSync(__dirname)) {
  if (f.endsWith('.tgz')) {
    unlinkSync(join(__dirname, f));
  }
}

const packOutput = execSync(`pnpm pack --pack-destination ${__dirname}`, {
  cwd: GT_NEXT_DIR,
  encoding: 'utf-8',
}).trim();

const tarballPath = packOutput.split('\n').pop();
const tarballName = tarballPath.split('/').pop();
console.log('Packed:', tarballName);

// --- Step 3: Swap dependency to tarball ---
const originalPkg = readFileSync(PKG_PATH, 'utf-8');
const pkg = JSON.parse(originalPkg);
pkg.dependencies['gt-next'] = `file:./${tarballName}`;
writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

try {
  // --- Step 4: Install with tarball ---
  console.log('\n=== Installing with packed gt-next ===\n');
  execSync('pnpm install --no-frozen-lockfile', { cwd: ROOT, stdio: 'inherit' });

  // --- Step 5: Build + run benchmark ---
  console.log('\n=== Building app ===\n');
  execSync('NEXT_PUBLIC_USE_CASE=main pnpm build', {
    cwd: __dirname,
    stdio: 'inherit',
  });

  console.log('\n=== Running e2e benchmarks ===\n');
  execSync('npx playwright test --config=benchmarks/playwright.config.ts', {
    cwd: __dirname,
    stdio: 'inherit',
  });
} finally {
  // --- Step 6: Restore workspace dependency ---
  console.log('\n=== Restoring workspace dependency ===\n');
  writeFileSync(PKG_PATH, originalPkg);
  execSync('pnpm install --no-frozen-lockfile', { cwd: ROOT, stdio: 'inherit' });
}
