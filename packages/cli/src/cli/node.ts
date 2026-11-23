import { Command } from 'commander';
import { SupportedLibraries } from '../types/index.js';
import { InlineCLI } from './inline.js';
import { Libraries, NODE_LIBRARIES, NodeLibrary } from '../types/libraries.js';
import { checkMonorepoVersionConsistency } from '../utils/monorepoVersionCheck.js';

/**
 * CLI tool for managing translations with gt-node or standalone gt-i18n
 */
export class NodeCLI extends InlineCLI {
  constructor(
    command: Command,
    library: NodeLibrary,
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

  public override init(): void {
    super.init();
    if (this.library === Libraries.GT_I18N) {
      this.setupSetupProjectCommand();
    }
  }
}
