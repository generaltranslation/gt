import type { RefMap } from '../utils/resolveMintlifyRefs.js';

let storedRefMap: RefMap = new Map();

export function storeRefMap(refMap: RefMap): void {
  for (const [key, value] of refMap.entries()) {
    storedRefMap.set(key, value);
  }
}

export function getStoredRefMap(): RefMap | null {
  return storedRefMap.size > 0 ? storedRefMap : null;
}

export function clearStoredRefMap(): void {
  storedRefMap = new Map();
}
