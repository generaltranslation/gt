import type { MintlifyRedirectSignals } from '../formats/files/postprocess/localizeMintlifyRedirects.js';

let storedSignals: MintlifyRedirectSignals | null = null;

export function recordRedirectSignals(signals: MintlifyRedirectSignals): void {
  storedSignals = signals;
}

export function getRedirectSignals(): MintlifyRedirectSignals | null {
  return storedSignals;
}

export function clearRedirectSignals(): void {
  storedSignals = null;
}
