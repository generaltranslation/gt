import type { GTComponentMetadata } from '../types';

/**
 * Reads the `_gtt` metadata a GT component attaches to itself.
 * @param type - A React element's `type`.
 * @returns The metadata, or `undefined` for anything that isn't a GT component.
 */
export function getGTMetadata(type: unknown): GTComponentMetadata | undefined {
  if (typeof type !== 'function') return undefined;
  try {
    const metadata: unknown = (type as { _gtt?: unknown })._gtt;
    return typeof metadata === 'object' && metadata !== null
      ? (metadata as GTComponentMetadata)
      : undefined;
  } catch {
    // Reading a property can throw on some proxied component types.
    return undefined;
  }
}
