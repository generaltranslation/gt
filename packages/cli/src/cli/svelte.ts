import type { Command } from 'commander';
import type { SupportedLibraries, TranslateFlags } from '../types/index.js';
import { Libraries } from '../types/libraries.js';
import { displayHeader } from '../console/logging.js';
import { logger } from '../console/logger.js';
import { attachInlineTranslateFlags, attachTranslateFlags } from './flags.js';
import { InlineCLI } from './inline.js';
import {
  attachConfigureFlags,
  type ConfigureOptions,
} from '../setup/onboarding.js';

const SVELTE_SOURCE_HELP =
  "Space-separated list of glob patterns containing the app's source code; defaults cover .svelte files and JavaScript/TypeScript modules in src";

/** CLI commands for an application whose inline runtime is gt-svelte. */
export class SvelteCLI extends InlineCLI {
  public constructor(
    command: Command,
    additionalModules?: SupportedLibraries[]
  ) {
    super(command, Libraries.GT_SVELTE, additionalModules);
  }

  public override init(): void {
    this.setupSetupProjectCommand();
    super.init();
  }

  protected override getInlineSourceHelp(): string {
    return SVELTE_SOURCE_HELP;
  }

  protected override getInlineLibrary(): typeof Libraries.GT_SVELTE {
    return Libraries.GT_SVELTE;
  }

  /** Configure Svelte without entering the React application setup wizard. */
  protected override setupInitCommand(): void {
    attachConfigureFlags(
      this.program
        .command('init')
        .description(
          'Configure a gt-svelte project for General Translation without modifying application source. Flags answer its questions; unanswered ones are asked, or listed as missing with --no-interactive'
        ),
      SVELTE_SOURCE_HELP
    ).action((options: ConfigureOptions) =>
      this.handleConfigureCommand(options, 'init')
    );
  }

  /** Uploads inline sources with the same targeting flags as extraction. */
  protected override setupSetupProjectCommand(): void {
    attachInlineTranslateFlags(
      attachTranslateFlags(
        this.program
          .command('setup')
          .description(
            'Upload source files and setup the project for translation'
          )
      ),
      this.getInlineSourceHelp()
    ).action(async (options: TranslateFlags) => {
      displayHeader('Uploading source files and setting up project...');
      await this.handleSetupProject(options);
      logger.endCommand('Done!');
    });
  }
}
