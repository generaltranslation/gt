import { buildResolutionGraph, normalizeFileId } from './buildResolutionGraph';
import type {
  FileId,
  ModuleResolver,
  NativeResolver,
  ResolutionCache,
  WatchFile,
} from './types';

export function createResolutionCache(): ResolutionCache {
  return {
    resolutions: new Map(),
    pending: new Map(),
    completed: new Set(),
  };
}

/**
 * Create a synchronous import resolver backed by a cached resolution graph.
 */
export async function createResolver(
  id: FileId,
  nativeResolver: NativeResolver,
  cache: ResolutionCache,
  watchFile?: WatchFile
): Promise<ModuleResolver> {
  await buildResolutionGraph(id, nativeResolver, cache, watchFile);
  while (cache.pending.size > 0) {
    await Promise.all(cache.pending.values());
  }

  return function resolveImport(source, importer) {
    return (
      cache.resolutions.get(normalizeFileId(importer))?.get(source) ?? null
    );
  };
}

export function clearResolutionCache(cache: ResolutionCache): void {
  cache.resolutions.clear();
  cache.pending.clear();
  cache.completed.clear();
}
