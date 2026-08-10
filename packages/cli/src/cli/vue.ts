import type { Command } from 'commander';
import type { SupportedLibraries } from '../types/index.js';
import { Libraries } from '../types/libraries.js';
import { InlineCLI } from './inline.js';

/** CLI commands for an application whose selected inline runtime is gt-vue. */
export class VueCLI extends InlineCLI {
  public constructor(
    command: Command,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, Libraries.GT_VUE, additionalModules);
  }

  public override init(): void {
    this.setupSetupProjectCommand();
    super.init();
  }

  /** Configure Vue without entering the React application setup wizard. */
  protected override setupInitCommand(): void {
    this.program
      .command('init')
      .description(
        'Configure a gt-vue project for General Translation without modifying application source'
      )
      .action(() => this.handleConfigureCommand());
  }
}
