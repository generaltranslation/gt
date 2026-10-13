import type { BundleReport } from './types.ts';

/** Bytes that GT packages contribute to a bundle. */
export function gtBytes(report: BundleReport): number {
  return report.modules.reduce(
    (sum, module) => sum + (module.gt ? module.bytes : 0),
    0
  );
}

export interface PackageSize {
  name: string;
  gt: boolean;
  bytes: number;
  files: number;
}

/** Module sizes rolled up by package, largest first. */
export function packageSizes(report: BundleReport): PackageSize[] {
  const packages = new Map<string, PackageSize>();
  for (const module of report.modules) {
    const entry = packages.get(module.pkg) ?? {
      name: module.pkg,
      gt: module.gt,
      bytes: 0,
      files: 0,
    };
    entry.bytes += module.bytes;
    entry.files += 1;
    packages.set(module.pkg, entry);
  }
  return [...packages.values()].sort((a, b) => b.bytes - a.bytes);
}
