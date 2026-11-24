import { Command } from 'commander';
import { SupportedLibraries } from '../types/index.js';
import { InlineCLI } from './inline.js';
import { Libraries, NODE_LIBRARIES } from '../types/libraries.js';
import { checkMonorepoVersionConsistency } from '../utils/monorepoVersionCheck.js';

/**
 * CLI tool for managing translations with gt-node or gt-i18n alone
 */
export class NodeCLI extends InlineCLI {
  constructor(
    command: Command,
    library: (typeof NODE_LIBRARIES)[number],
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, library, additionalModules);

    this.program.hook('preAction', (_thisCommand, actionCommand) => {
      if (this.program.opts().skipVersionCheck) return;
      if (actionCommand.parent?.name() === 'git') return;
      checkMonorepoVersionConsistency(
        NODE_LIBRARIES,
        actionCommand.opts().config
      );
    });
  }

  public init() {
    super.init();
    // A package with gt-i18n alone had setup, from the base CLI, before it was detected.
    if (this.library === Libraries.GT_I18N) this.setupSetupProjectCommand();
  }
}
