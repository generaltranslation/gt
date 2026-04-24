import type { RefMap } from '../utils/resolveMintlifyRefs.js';

let storedRefMap: RefMap | null = null;

export function storeRefMap(refMap: RefMap): void {
  storedRefMap = refMap;
}

export function getStoredRefMap(): RefMap | null {
  return storedRefMap;
}

export function clearStoredRefMap(): void {
  storedRefMap = null;
}
