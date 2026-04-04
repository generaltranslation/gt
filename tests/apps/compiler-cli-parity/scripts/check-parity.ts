/**
 * Parity check script: compares compiler debug manifest with CLI generate output.
 *
 * Usage: tsx scripts/check-parity.ts
 *
 * 1. Cleans previous outputs
 * 2. Runs `pnpm vite build` (produces _gt_debug_hash_manifest.json)
 * 3. Runs `pnpm exec gt generate` (produces src/_gt/en.json)
 * 4. Compares manifests with Derive filtering
 * 5. Reports results, exits 1 on mismatch
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COMPILER_MANIFEST = path.join(ROOT, '_gt_debug_hash_manifest.json');
const CLI_MANIFEST = path.join(ROOT, 'src', '_gt', 'en.json');

// --- Derive detection ---

/**
 * Recursively check if a jsxChildren value contains Derive/Static content.
 * The compiler doesn't extract Derive, so these entries are expected to differ.
 */
function containsDerive(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' || typeof value === 'number') return false;
  if (typeof value === 'boolean') return false;

  if (Array.isArray(value)) {
    return value.some(containsDerive);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Check element type — 's' is minified Derive/Static
    if (obj.t === 's' || obj.t === 'Derive' || obj.t === 'Static') return true;
    // Recurse into children
    if (containsDerive(obj.c)) return true;
    // Recurse into branch data
    if (obj.d && typeof obj.d === 'object') {
      const d = obj.d as Record<string, unknown>;
      if (d.b && typeof d.b === 'object') {
        return Object.values(d.b as Record<string, unknown>).some(containsDerive);
      }
    }
    return false;
  }

  return false;
}

// --- Deep equality ---

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as object).sort();
    const keysB = Object.keys(b as object).sort();
    if (!deepEqual(keysA, keysB)) return false;
    return keysA.every((k) =>
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k]
      )
    );
  }

  return false;
}

// --- Main ---

function main() {
  // 1. Clean previous outputs
  if (fs.existsSync(COMPILER_MANIFEST)) fs.unlinkSync(COMPILER_MANIFEST);
  const gtDir = path.dirname(CLI_MANIFEST);
  if (fs.existsSync(gtDir)) fs.rmSync(gtDir, { recursive: true });

  // 2. Run compiler (vite build)
  console.log('\n📦 Running vite build...\n');
  execSync('pnpm vite build', { cwd: ROOT, stdio: 'inherit' });

  // 3. Run CLI (gt generate)
  console.log('\n📝 Running gt generate...\n');
  execSync('pnpm exec gt generate', { cwd: ROOT, stdio: 'inherit' });

  // 4. Load manifests
  if (!fs.existsSync(COMPILER_MANIFEST)) {
    console.error('ERROR: Compiler manifest not found at', COMPILER_MANIFEST);
    process.exit(1);
  }
  if (!fs.existsSync(CLI_MANIFEST)) {
    console.error('ERROR: CLI manifest not found at', CLI_MANIFEST);
    process.exit(1);
  }

  const compilerData: Record<string, unknown> = JSON.parse(
    fs.readFileSync(COMPILER_MANIFEST, 'utf8')
  );
  const cliData: Record<string, unknown> = JSON.parse(
    fs.readFileSync(CLI_MANIFEST, 'utf8')
  );

  // 5. Compare
  let matched = 0;
  let mismatched = 0;
  let skippedDerive = 0;
  let compilerOnly = 0;
  let cliOnly = 0;
  const mismatches: Array<{
    hash: string;
    compiler: unknown;
    cli: unknown;
    reason: string;
  }> = [];

  const allHashes = new Set([
    ...Object.keys(compilerData),
    ...Object.keys(cliData),
  ]);

  for (const hash of allHashes) {
    const inCompiler = hash in compilerData;
    const inCLI = hash in cliData;

    if (inCompiler && inCLI) {
      // Both have it — skip if Derive-related, otherwise compare
      if (containsDerive(compilerData[hash]) || containsDerive(cliData[hash])) {
        skippedDerive++;
        continue;
      }
      if (deepEqual(compilerData[hash], cliData[hash])) {
        matched++;
      } else {
        mismatched++;
        mismatches.push({
          hash,
          compiler: compilerData[hash],
          cli: cliData[hash],
          reason: 'values differ',
        });
      }
    } else if (inCompiler && !inCLI) {
      if (containsDerive(compilerData[hash])) {
        skippedDerive++;
      } else {
        compilerOnly++;
        mismatches.push({
          hash,
          compiler: compilerData[hash],
          cli: undefined,
          reason: 'only in compiler',
        });
      }
    } else {
      // inCLI && !inCompiler
      if (containsDerive(cliData[hash])) {
        skippedDerive++;
      } else {
        cliOnly++;
        mismatches.push({
          hash,
          compiler: undefined,
          cli: cliData[hash],
          reason: 'only in CLI',
        });
      }
    }
  }

  // 6. Report
  console.log('\n' + '='.repeat(50));
  console.log('  Parity Check Results');
  console.log('='.repeat(50));
  console.log(`  Matched:          ${matched}`);
  console.log(`  Mismatched:       ${mismatched}`);
  console.log(`  Compiler-only:    ${compilerOnly}`);
  console.log(`  CLI-only:         ${cliOnly}`);
  console.log(`  Skipped (Derive): ${skippedDerive}`);
  console.log(`  Total hashes:     ${allHashes.size}`);
  console.log('='.repeat(50));

  if (mismatches.length > 0) {
    console.log('\n--- Mismatches ---\n');
    for (const m of mismatches) {
      console.log(`Hash: ${m.hash}  (${m.reason})`);
      if (m.compiler !== undefined) {
        console.log('  Compiler:', JSON.stringify(m.compiler, null, 4).replace(/\n/g, '\n  '));
      }
      if (m.cli !== undefined) {
        console.log('  CLI:     ', JSON.stringify(m.cli, null, 4).replace(/\n/g, '\n  '));
      }
      console.log();
    }
    process.exit(1);
  }

  if (matched === 0) {
    console.log('\nWARNING: Zero matches found. Check that both tools are configured correctly.\n');
    process.exit(1);
  }

  console.log('\nAll entries match! Parity confirmed.\n');
  process.exit(0);
}

main();
