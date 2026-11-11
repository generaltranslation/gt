import { createHash } from 'node:crypto';
import path from 'node:path';
import { findDirectoriesContaining } from '../project/files.js';

/**
 * Paraglide's virtual-modules mode (its Vite plugin's default) keeps message
 * modules in memory. Its plugin resolves `<outdir>/messages.js` and
 * `<outdir>/messages/…` to `\0virtual:paraglide/<hash>/<path>`, where the hash
 * identifies the outdir.
 */
const VIRTUAL_ID = /^\0?virtual:paraglide\/([0-9a-f]{16})\/([^?]+)/;

/** The hash in the virtual ids of a virtual-modules outdir. */
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

/** Maps virtual ids back to where their modules would be on disk, so targets match them. */
export class VirtualModules {
  /** Outdirs by hash; undefined once a hash was searched for and not found. */
  private readonly outdirs = new Map<string, string | undefined>();

  /** @param searchRoots Where outdirs are looked for, e.g. the project and workspace roots. */
  constructor(
    private readonly searchRoots: readonly string[],
    private readonly knownOutdirs: readonly string[] = []
  ) {}

  /** Whether `id` is one of Paraglide's virtual ids. */
  static isVirtualId(id: string): boolean {
    return VIRTUAL_ID.test(id);
  }

  /** The file a virtual id stands for, if its outdir is found. */
  async fileOf(id: string): Promise<string | undefined> {
    const match = VIRTUAL_ID.exec(id);
    if (!match) return undefined;
    const [, hash, name] = match as unknown as [string, string, string];
    if (!this.outdirs.has(hash)) await this.search(hash);
    const outdir = this.outdirs.get(hash);
    return outdir && path.join(outdir, ...name.split('/'));
  }

  private async search(hash: string): Promise<void> {
    const directories = await findDirectoriesContaining(
      [...new Set(this.searchRoots)],
      'messages.js'
    );
    for (const directory of [...directories, ...this.knownOutdirs]) {
      this.outdirs.set(outdirHash(directory), directory);
    }
    // Not searched again.
    if (!this.outdirs.has(hash)) this.outdirs.set(hash, undefined);
  }
}
