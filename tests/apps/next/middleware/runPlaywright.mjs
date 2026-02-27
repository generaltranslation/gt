import { execSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');
const GT_NEXT_DIR = join(ROOT, 'packages/next');
const PKG_PATH = join(__dirname, 'package.json');

const useCases = ['main', 'prefix-default', 'path-config', 'no-routing'];

// --- Step 1: Build all packages ---
console.log('\n=== Building packages ===\n');
execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' });

// --- Step 2: Pack gt-next ---
console.log('\n=== Packing gt-next ===\n');

// Clean old tarballs
for (const f of readdirSync(__dirname)) {
  if (f.endsWith('.tgz')) {
    unlinkSync(join(__dirname, f));
  }
}

const packOutput = execSync(`pnpm pack --pack-destination ${__dirname}`, {
  cwd: GT_NEXT_DIR,
  encoding: 'utf-8',
}).trim();

// pnpm pack outputs the full path to the tarball
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

  // --- Step 5: Run tests per use case ---
  for (const useCase of useCases) {
    console.log(`\n=== ${useCase} ===\n`);
    execSync(
      `NEXT_PUBLIC_USE_CASE=${useCase} pnpm build && NEXT_PUBLIC_USE_CASE=${useCase} TEST_MATCH=${useCase}.spec.ts npx playwright test`,
      { cwd: __dirname, stdio: 'inherit' }
    );
  }
} finally {
  // --- Step 6: Restore workspace dependency ---
  console.log('\n=== Restoring workspace dependency ===\n');
  writeFileSync(PKG_PATH, originalPkg);
  execSync('pnpm install --no-frozen-lockfile', { cwd: ROOT, stdio: 'inherit' });
}
