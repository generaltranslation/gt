import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { analyzeExample } from '../server/builder.ts';
import { examples } from '../server/examples.ts';
import { readWorkspacePackages } from '../server/workspace.ts';
import type { Analysis, BuildSettings } from '../shared/types.ts';

/**
 * Builds the examples the way the analysis server does and checks the
 * measurements. Slow: set BUNDLE_ANALYSIS_INTEGRATION=1 to run.
 */
const run = process.env.BUNDLE_ANALYSIS_INTEGRATION === '1';
const packages = readWorkspacePackages();

function buildAndAnalyze(id: string, settings: BuildSettings): Analysis {
  const example = examples.find((candidate) => candidate.id === id)!;
  const started = Date.now();
  execFileSync('pnpm', ['run', 'build'], {
    cwd: example.dir,
    stdio: 'pipe',
    env: {
      ...process.env,
      GT_ANALYZE: '1',
      GT_ANALYZE_MINIFY: settings.minify ? '1' : '0',
      GT_ANALYZE_TREESHAKE: settings.treeShake ? '1' : '0',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  return analyzeExample(
    example,
    settings,
    packages,
    new Date(started),
    Date.now() - started
  );
}

const EXPECTED_GT: Record<string, string> = {
  'next-app': 'gt-next',
  'tanstack-start': 'gt-tanstack-start',
  'vite-react': 'gt-react',
  'vite-vue': 'gt-vue',
};

describe.skipIf(!run)('example builds', () => {
  for (const example of examples) {
    it(`${example.id}: every byte is attributed and GT packages are found`, () => {
      const analysis = buildAndAnalyze(example.id, {
        minify: true,
        treeShake: true,
      });
      expect(Object.keys(analysis.bundles).sort()).toEqual(
        Object.keys(example.collect).sort()
      );

      for (const report of Object.values(analysis.bundles)) {
        expect(report.files.length).toBeGreaterThan(0);
        const attributed = report.modules.reduce(
          (sum, module) => sum + module.bytes,
          0
        );
        expect(attributed).toBe(report.totalBytes);
        const unmapped = report.modules
          .filter((module) => module.pkg === '(unmapped)')
          .reduce((sum, module) => sum + module.bytes, 0);
        // Source maps should cover nearly the whole bundle.
        expect(unmapped / report.totalBytes).toBeLessThan(0.05);
        expect(report.modules.some((module) => module.gt)).toBe(true);
      }

      const client = analysis.bundles.client!;
      const ownPackage = EXPECTED_GT[example.id]!;
      const appCode = client.modules.filter((module) => module.pkg === '(app)');
      expect(appCode.length).toBeGreaterThan(0);
      const gtPackages = new Set(
        client.modules.filter((m) => m.gt).map((m) => m.pkg)
      );
      expect(gtPackages.size).toBeGreaterThan(1);
      // Next splits gt-next across server and client; the others ship it to the client.
      const everyModule = Object.values(analysis.bundles).flatMap(
        (report) => report.modules
      );
      expect(everyModule.some((module) => module.pkg === ownPackage)).toBe(
        true
      );
    }, 300_000);
  }

  it('vite-react: disabling minification and tree shaking grows the client bundle', () => {
    const base = buildAndAnalyze('vite-react', {
      minify: true,
      treeShake: true,
    });
    const unminified = buildAndAnalyze('vite-react', {
      minify: false,
      treeShake: true,
    });
    const unshaken = buildAndAnalyze('vite-react', {
      minify: true,
      treeShake: false,
    });
    expect(unminified.bundles.client!.totalBytes).toBeGreaterThan(
      base.bundles.client!.totalBytes * 1.3
    );
    expect(unshaken.bundles.client!.totalBytes).toBeGreaterThan(
      base.bundles.client!.totalBytes
    );
    // Restore the default build for anyone viewing the example.
    buildAndAnalyze('vite-react', { minify: true, treeShake: true });
  }, 300_000);

  it('next-app: disabling minification and tree shaking grows the client bundle', () => {
    const base = buildAndAnalyze('next-app', { minify: true, treeShake: true });
    const unminified = buildAndAnalyze('next-app', {
      minify: false,
      treeShake: true,
    });
    const unshaken = buildAndAnalyze('next-app', {
      minify: true,
      treeShake: false,
    });
    expect(unminified.bundles.client!.totalBytes).toBeGreaterThan(
      base.bundles.client!.totalBytes * 1.3
    );
    expect(unshaken.bundles.client!.totalBytes).toBeGreaterThan(
      base.bundles.client!.totalBytes
    );
    buildAndAnalyze('next-app', { minify: true, treeShake: true });
  }, 600_000);
});
