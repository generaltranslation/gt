import type { Command } from 'commander';
import type { SupportedLibraries } from '../types/index.js';
import { Libraries } from '../types/libraries.js';
import { InlineCLI } from './inline.js';

/** Standard inline CLI command surface for a root gt-vue application. */
export class VueCLI extends InlineCLI {
  public constructor(
    command: Command,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, Libraries.GT_VUE, additionalModules);
  }

  /** Uses generic configuration without running the React setup wizard. */
  protected override setupInitCommand(): void {
    this.program
      .command('init')
      .description(
        'Configure a gt-vue project for General Translation without modifying application source'
      )
      .action(() => this.handleConfigureCommand(true));
  }

  /** Keeps every Vue configuration entry point free of generated loaders. */
  protected override handleConfigureCommand(
    useBundledTranslationDefaults: boolean = true
  ): Promise<void> {
    return super.handleConfigureCommand(useBundledTranslationDefaults);
  }
}

/**
 * Adds Vue inline extraction to an existing file-translation CLI.
 *
 * Historical setup and configuration behavior remains inherited from BaseCLI,
 * while InlineCLI adds Vue-aware validation and source-generation commands.
 */
export class MixedVueCLI extends InlineCLI {
  public constructor(
    command: Command,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, Libraries.GT_VUE, additionalModules);
  }

  /** Preserves BaseCLI's setup command alongside Vue inline commands. */
  public override init(): void {
    this.setupSetupProjectCommand();
    super.init();
  }
}
