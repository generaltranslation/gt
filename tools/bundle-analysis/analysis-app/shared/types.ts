/** Types shared by the analysis server and the browser UI. */

export type BundleKind = 'client' | 'server' | 'edge';

export const BUNDLE_KINDS: readonly BundleKind[] = ['client', 'server', 'edge'];

export interface BuildSettings {
  minify: boolean;
  treeShake: boolean;
}

export interface ModuleSize {
  /** `${pkg}/${path}`, stable across builds. */
  id: string;
  pkg: string;
  path: string;
  gt: boolean;
  bytes: number;
}

export interface EmittedFile {
  path: string;
  bytes: number;
  gzip: number;
}

export interface BundleReport {
  kind: BundleKind;
  files: EmittedFile[];
  totalBytes: number;
  gzipBytes: number;
  modules: ModuleSize[];
}

export interface Analysis {
  example: string;
  settings: BuildSettings;
  builtAt: string;
  buildMs: number;
  bundles: Partial<Record<BundleKind, BundleReport>>;
}

export interface ExampleSummary {
  id: string;
  title: string;
  pkg: string;
  framework: string;
  description: string;
  bundles: BundleKind[];
  hasPreview: boolean;
  /** Client bytes from the most recent analysis, if one exists. */
  lastClientBytes: number | null;
  /** GT package bytes in that client bundle. */
  lastClientGtBytes: number | null;
}

export type BuildStatus =
  | { state: 'idle' }
  | { state: 'building'; reason: string; startedAt: string }
  | { state: 'error'; message: string; log: string };

/** Everything the analysis page needs, pushed over server-sent events. */
export interface ExampleState {
  example: string;
  title: string;
  /** Bundles this example's framework emits, in display order. */
  bundles: BundleKind[];
  settings: BuildSettings;
  status: BuildStatus;
  current: Analysis | null;
  previous: Analysis | null;
}
