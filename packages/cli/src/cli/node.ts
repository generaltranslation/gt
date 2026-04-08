import { Command } from 'commander';
import { SupportedLibraries } from '../types/index.js';
import { InlineCLI } from './inline.js';
import { Libraries, NODE_LIBRARIES } from '../types/libraries.js';
import { checkMonorepoVersionConsistency } from '../utils/monorepoVersionCheck.js';

/**
 * CLI tool for managing translations with gt-node
 */
export class NodeCLI extends InlineCLI {
  constructor(
    command: Command,
    library: typeof Libraries.GT_NODE,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);

    this.program.hook('preAction', () => {
      if (this.program.opts().skipVersionCheck) return;
      checkMonorepoVersionConsistency(NODE_LIBRARIES);
    });
  }
}
