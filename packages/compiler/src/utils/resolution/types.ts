/**
 * Absolute path to a file in the module graph.
 */
export type FileId = string;

/**
 * Raw import source string, such as './helpers'.
 */
export type SourceId = string;

/**
 * Bundler-normalized resolution result.
 */
export interface ResolvedId {
  id: FileId;
  external?: boolean | 'absolute';
}

/**
 * Bundler-backed resolve function.
 */
export type NativeResolver = (
  source: SourceId,
  importer?: FileId
) => Promise<ResolvedId | null>;

/**
 * Synchronous lookup against the compiler's prebuilt resolution graph.
 */
export type ModuleResolver = (
  source: SourceId,
  importer: FileId
) => ResolvedId | null;

export interface ResolutionCache {
  resolutions: Map<FileId, Map<SourceId, ResolvedId>>;
  pending: Map<FileId, Promise<void>>;
  completed: Set<FileId>;
}

export type WatchFile = (id: FileId) => void;
