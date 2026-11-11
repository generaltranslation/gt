import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * The hash in the virtual ids of a virtual-modules outdir. Paraglide's
 * virtual-modules mode (its Vite plugin's default) keeps message modules in
 * memory, as `virtual:paraglide/<hash>/<path>`; the outdir's `messages.js`
 * imports them by that id.
 */
export function outdirHash(directory: string): string {
  return createHash('sha256')
    .update(path.resolve(directory))
    .digest('hex')
    .slice(0, 16);
}

/** The prefix of the virtual ids of `directory`'s modules, as Paraglide's plugin writes it. */
export function virtualModulePrefix(directory: string): string {
  return `virtual:paraglide/${outdirHash(directory)}/`;
}
