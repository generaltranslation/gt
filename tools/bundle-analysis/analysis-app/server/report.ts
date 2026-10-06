import { gtBytes, packageSizes } from '../shared/summary.ts';
import type {
  BundleKind,
  BundleReport,
  ExampleState,
  ModuleSize,
} from '../shared/types.ts';

/**
 * JSON shapes for the agent API. Sizes are uncompressed bytes of emitted
 * JavaScript; `gtBytes` counts modules from General Translation packages.
 */

const percent = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

export interface BundleSummary {
  totalBytes: number;
  gzipBytes: number;
  gtBytes: number;
  gtPercent: number;
  files: number;
  /** Change since the previous build, or null when there is none. */
  change: { totalBytes: number; gtBytes: number } | null;
  gtPackages: { name: string; bytes: number }[];
  topPackages: { name: string; bytes: number; gt: boolean }[];
}

export function summarizeBundle(
  report: BundleReport,
  previous: BundleReport | undefined
): BundleSummary {
  const gt = gtBytes(report);
  const packages = packageSizes(report);
  return {
    totalBytes: report.totalBytes,
    gzipBytes: report.gzipBytes,
    gtBytes: gt,
    gtPercent: percent(gt, report.totalBytes),
    files: report.files.length,
    change: previous
      ? {
          totalBytes: report.totalBytes - previous.totalBytes,
          gtBytes: gt - gtBytes(previous),
        }
      : null,
    gtPackages: packages
      .filter((pkg) => pkg.gt)
      .map(({ name, bytes }) => ({ name, bytes })),
    topPackages: packages
      .slice(0, 10)
      .map(({ name, bytes, gt: isGt }) => ({ name, bytes, gt: isGt })),
  };
}

export function summarizeExample(state: ExampleState, stale: boolean) {
  const current = state.current;
  return {
    example: state.example,
    title: state.title,
    status: state.status.state,
    ...(state.status.state === 'error'
      ? { error: state.status.message, log: state.status.log.slice(-4000) }
      : {}),
    /** True when sources changed after the last build. */
    stale,
    settings: state.settings,
    builtAt: current?.builtAt ?? null,
    buildMs: current?.buildMs ?? null,
    bundles: Object.fromEntries(
      state.bundles.flatMap((kind) => {
        const report = current?.bundles[kind];
        return report
          ? [[kind, summarizeBundle(report, state.previous?.bundles[kind])]]
          : [];
      })
    ) as Partial<Record<BundleKind, BundleSummary>>,
  };
}

/**
 * Packages in one bundle, or with `pkg` the files of one package. `query`
 * filters files by a case-insensitive substring of `package/path`.
 */
export function bundleDetail(
  report: BundleReport,
  options: { pkg?: string; query?: string; limit?: number }
) {
  const limit = options.limit ?? 50;
  const query = options.query?.toLowerCase();
  if (!options.pkg && !query) {
    return {
      totalBytes: report.totalBytes,
      gtBytes: gtBytes(report),
      packages: packageSizes(report).slice(0, limit),
    };
  }
  const modules = report.modules
    .filter((module) => !options.pkg || module.pkg === options.pkg)
    .filter((module) => !query || module.id.toLowerCase().includes(query));
  return {
    totalBytes: report.totalBytes,
    matchedBytes: modules.reduce((sum, module) => sum + module.bytes, 0),
    matchedFiles: modules.length,
    files: modules.slice(0, limit).map(({ pkg, path, gt, bytes }) => ({
      package: pkg,
      path,
      gt,
      bytes,
    })),
  };
}

export interface FileChange {
  package: string;
  path: string;
  gt: boolean;
  before: number;
  after: number;
  change: number;
}

/** Files whose size changed between two builds, largest change first. */
export function diffBundles(
  current: BundleReport,
  previous: BundleReport
): { totalChange: number; gtChange: number; files: FileChange[] } {
  const before = new Map<string, ModuleSize>(
    previous.modules.map((module) => [module.id, module])
  );
  const after = new Map<string, ModuleSize>(
    current.modules.map((module) => [module.id, module])
  );
  const files: FileChange[] = [];
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(id);
    const b = after.get(id);
    const change = (b?.bytes ?? 0) - (a?.bytes ?? 0);
    if (change === 0) continue;
    const module = (b ?? a)!;
    files.push({
      package: module.pkg,
      path: module.path,
      gt: module.gt,
      before: a?.bytes ?? 0,
      after: b?.bytes ?? 0,
      change,
    });
  }
  files.sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
  return {
    totalChange: current.totalBytes - previous.totalBytes,
    gtChange: gtBytes(current) - gtBytes(previous),
    files,
  };
}
