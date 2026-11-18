import type { Command } from 'commander';
import type { SupportedLibraries } from '../types/index.js';
import { Libraries } from '../types/libraries.js';
import { InlineCLI } from './inline.js';

const SVELTE_SOURCE_HELP =
  'Ignored for gt-svelte: its Vite plugin writes the translatable entries to the manifest during vite build';

/** CLI commands for an application whose inline runtime is gt-svelte. */
export class SvelteCLI extends InlineCLI {
  public constructor(
    command: Command,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, Libraries.GT_SVELTE, additionalModules);
  }

  protected override getInlineSourceHelp(): string {
    return SVELTE_SOURCE_HELP;
  }

  protected override getInlineLibrary(): typeof Libraries.GT_SVELTE {
    return Libraries.GT_SVELTE;
  }
}
