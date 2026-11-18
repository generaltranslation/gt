import { getContext, hasContext, setContext } from 'svelte';
import { GT, type CreateGTOptions } from './GT.svelte.js';
import {
  missingGTDiagnostic,
  moduleLookupDiagnostic,
  notCompiledDiagnostic,
  serverInitializeDiagnostic,
} from './diagnostics.js';

const gtContextKey = Symbol.for('gt-svelte.runtime');

let browserGT: GT | undefined;

export function createGT(options?: CreateGTOptions): GT {
  return new GT(options);
}

/** Provides `gt` to the calling component and its descendants. */
export function setGT(gt: GT): GT {
  setContext(gtContextKey, gt);
  return gt;
}

/** Builds the `context` option for Svelte's `mount()`, `hydrate()` or `render()`. */
export function gtContext(gt: GT): Map<symbol, GT> {
  return new Map([[gtContextKey, gt]]);
}

/** Must run during component initialization, like any Svelte context read. */
export function getGT(): GT {
  if (hasContext(gtContextKey)) return getContext<GT>(gtContextKey);
  if (browserGT) return browserGT;
  throw new Error(missingGTDiagnostic);
}

/**
 * Creates the page's browser runtime and loads the active locale's catalog,
 * so the first render already shows translated text.
 */
export async function initializeGT(options?: CreateGTOptions): Promise<GT> {
  if (typeof window === 'undefined') {
    throw new Error(serverInitializeDiagnostic);
  }
  const gt = new GT(options);
  await gt.loadTranslations(gt.locale);
  browserGT = gt;
  return gt;
}

/**
 * Translates a string without plugin support.
 *
 * The gt-svelte Vite plugin replaces every call with a precomputed lookup, so
 * reaching this function means the call was not compiled.
 */
export function gt(
  _message: string,
  _options?: {
    $context?: string;
    $maxChars?: number;
    $requiresReview?: boolean;
  }
): string {
  throw new Error(notCompiledDiagnostic('gt()'));
}

/** Lookup target of a `gt()` call compiled at module scope. */
export function lookupString(hash: string, source: string): string {
  if (!browserGT) throw new Error(moduleLookupDiagnostic);
  return browserGT.string(hash, source);
}
