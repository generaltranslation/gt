import type { Command } from 'commander';
import { manifestDirectlyDeclaresGTVue } from '@generaltranslation/vue-extractor/integration';
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

  /** Applies the extractor-owned gt-vue manifest ownership policy. */
  protected override hasInstalledInlineRuntime(
    packageJson: Record<string, unknown>
  ): boolean {
    return (
      super.hasInstalledInlineRuntime(packageJson) ||
      manifestDirectlyDeclaresGTVue(packageJson)
    );
  }
}
